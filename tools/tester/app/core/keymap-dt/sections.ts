// Section boundary detector.
//
// Walks the token stream from `lexer.ts`, tracks brace depth, and reports the
// byte ranges of every recognized section. Anything not recognized is left for
// `patch.ts` to preserve byte-for-byte.

import { skipTrivia, tokenize } from './lexer'
import type { Section, SectionKind, Token } from './types'

type Frame =
  | { kind: 'root' }
  | { kind: 'keymap'; startIdx: number; bodyStartIdx: number }
  | { kind: 'combos'; startIdx: number; bodyStartIdx: number }
  | { kind: 'macros'; startIdx: number; bodyStartIdx: number }
  | { kind: 'behaviors'; startIdx: number; bodyStartIdx: number }

// Layers are detected structurally: any named block inside the `keymap {}`
// container frame is a layer entry. We intentionally do NOT keep a whitelist
// of layer names so the editor can add/remove user-named layers without a
// matching code change here.

const MOUSE_GESTURE_REFS = new Set(['zip_mouse_gesture'])
// Matched by prefix rather than a name whitelist: per-OS gesture nodes get added
// as the keymap grows, and a whitelist would silently hide them from the editor.
const MOUSE_GESTURE_NAMED_PREFIX = 'zip_mouse_gesture_'

export function detectSections(source: string): { tokens: Token[]; sections: Section[] } {
  const tokens = tokenize(source)
  const sections: Section[] = []
  const stack: Frame[] = [{ kind: 'root' }]

  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]

    // Track brace pops: but root-level sections own the entire `name { ... };`
    // span. The detector handles them by lookahead at their start; standalone
    // `rbrace` only affects container frames (keymap/combos/macros/behaviors).
    if (t.kind === 'rbrace' && stack.length > 1) {
      const top = stack[stack.length - 1]
      if (top.kind === 'keymap' || top.kind === 'combos' || top.kind === 'macros' || top.kind === 'behaviors') {
        // Close container.
        const end = findSemiAfter(tokens, i)
        sections.push({
          kind: `${top.kind}-container` === 'keymap-container' ? 'keymap-root' : (`${top.kind}-container` as SectionKind),
          range: [tokens[top.startIdx].range[0], end],
          headerRange: [tokens[top.startIdx].range[0], tokens[top.bodyStartIdx - 1].range[1]],
          bodyRange: [tokens[top.bodyStartIdx].range[1], tokens[i].range[0]],
        })
        stack.pop()
        i++
        continue
      }
    }

    const top = stack[stack.length - 1]

    // Root-level constructs.
    if (top.kind === 'root') {
      // `&mt { ... };`
      if (t.kind === 'ampersand') {
        const next = peekIdent(tokens, i + 1)
        if (next && (next.value === 'mt' || next.value === 'lt')) {
          const block = consumeBlockAfterRef(tokens, i, next.value === 'mt' ? 'root-mt' : 'root-lt')
          if (block) {
            sections.push(block.section)
            i = block.endIdx + 1
            continue
          }
        }
        if (next && MOUSE_GESTURE_REFS.has(next.value)) {
          const block = consumeBlockAfterRef(tokens, i, 'mouse-gesture-root')
          if (block) {
            sections.push(block.section)
            i = block.endIdx + 1
            continue
          }
        }
      }
      // `name: zip_mouse_gesture_mac { ... };` (lives under `/ { ... };`).
    }

    // Inside `/ { ... };` and below — top.kind already updated by frames.
    // Note: dax6.keymap uses two `/ { ... };` root blocks plus `&zip_mouse_gesture`.
    // We do NOT model the outer `/` blocks as their own sections; we descend
    // into them token-by-token and pick out children at any depth.

    if (t.kind === 'identifier') {
      // Container blocks: keymap { ... }; combos { ... }; macros { ... }; behaviors { ... };
      if (
        t.value === 'keymap' ||
        t.value === 'combos' ||
        t.value === 'macros' ||
        t.value === 'behaviors'
      ) {
        const j = skipTrivia(tokens, i + 1)
        if (j !== -1 && tokens[j].kind === 'lbrace') {
          stack.push({ kind: t.value as Frame['kind'], startIdx: i, bodyStartIdx: j })
          i = j + 1
          continue
        }
      }

      // Inside the `keymap { ... }` frame, every named block is a layer entry
      // (no name whitelist — see comment at top of file).
      if (top.kind === 'keymap') {
        const block = consumeNamedBlock(tokens, i, t.value, 'layer')
        if (block) {
          sections.push(block.section)
          i = block.endIdx + 1
          continue
        }
      }

      // Inside containers: pick up entries.
      if (top.kind === 'combos') {
        const entry = consumeNamedBlock(tokens, i, t.value, 'combo-entry')
        if (entry) {
          sections.push(entry.section)
          i = entry.endIdx + 1
          continue
        }
      }
      if (top.kind === 'macros') {
        const entry = consumeNamedBlock(tokens, i, t.value, 'macro-entry')
        if (entry) {
          sections.push(entry.section)
          i = entry.endIdx + 1
          continue
        }
      }
      if (top.kind === 'behaviors') {
        const entry = consumeNamedBlock(tokens, i, t.value, 'behavior-entry')
        if (entry) {
          sections.push(entry.section)
          i = entry.endIdx + 1
          continue
        }
      }

      // `name: zip_mouse_gesture_mac { ... };` lives at the same level as
      // combos/macros/behaviors (inside an outer `/ { ... };`).
      const namedMg = tryConsumeNamedMouseGesture(tokens, i)
      if (namedMg) {
        sections.push(namedMg.section)
        i = namedMg.endIdx + 1
        continue
      }
    }

    i++
  }

  return { tokens, sections }
}

function peekIdent(tokens: Token[], from: number): Token | null {
  const idx = skipTrivia(tokens, from)
  if (idx === -1) return null
  return tokens[idx].kind === 'identifier' ? tokens[idx] : null
}

function findLBraceFrom(tokens: Token[], from: number): number {
  let i = from
  while (i < tokens.length) {
    const k = tokens[i].kind
    if (k === 'lbrace') return i
    if (k === 'semi') return -1
    i++
  }
  return -1
}

function findMatchingRBrace(tokens: Token[], lbraceIdx: number): number {
  let depth = 0
  for (let i = lbraceIdx; i < tokens.length; i++) {
    if (tokens[i].kind === 'lbrace') depth++
    else if (tokens[i].kind === 'rbrace') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function findSemiAfter(tokens: Token[], rbraceIdx: number): number {
  for (let i = rbraceIdx + 1; i < tokens.length; i++) {
    if (tokens[i].kind === 'semi') return tokens[i].range[1]
    if (tokens[i].kind !== 'whitespace' && tokens[i].kind !== 'newline') {
      // Be lenient: return after rbrace if no semi found immediately.
      return tokens[rbraceIdx].range[1]
    }
  }
  return tokens[rbraceIdx].range[1]
}

function consumeNamedBlock(
  tokens: Token[],
  nameIdx: number,
  name: string,
  kind: SectionKind,
): { section: Section; endIdx: number } | null {
  const lbrace = findLBraceFrom(tokens, nameIdx + 1)
  if (lbrace === -1) return null
  // Verify no semicolon between name and lbrace (would mean it's a property, not a block).
  for (let k = nameIdx + 1; k < lbrace; k++) {
    if (tokens[k].kind === 'semi') return null
  }
  const rbrace = findMatchingRBrace(tokens, lbrace)
  if (rbrace === -1) return null
  const endByte = findSemiAfter(tokens, rbrace)
  return {
    section: {
      kind,
      name,
      range: [tokens[nameIdx].range[0], endByte],
      headerRange: [tokens[nameIdx].range[0], tokens[lbrace].range[1]],
      bodyRange: [tokens[lbrace].range[1], tokens[rbrace].range[0]],
    },
    endIdx: tokenIdxAtByte(tokens, endByte) ?? rbrace + 1,
  }
}

function consumeBlockAfterRef(
  tokens: Token[],
  ampIdx: number,
  kind: SectionKind,
): { section: Section; endIdx: number } | null {
  // `&` `ident` `{ ... };`
  const identIdx = skipTrivia(tokens, ampIdx + 1)
  if (identIdx === -1 || tokens[identIdx].kind !== 'identifier') return null
  const lbrace = findLBraceFrom(tokens, identIdx + 1)
  if (lbrace === -1) return null
  for (let k = identIdx + 1; k < lbrace; k++) {
    if (tokens[k].kind === 'semi') return null
  }
  const rbrace = findMatchingRBrace(tokens, lbrace)
  if (rbrace === -1) return null
  const endByte = findSemiAfter(tokens, rbrace)
  return {
    section: {
      kind,
      name: tokens[identIdx].value,
      range: [tokens[ampIdx].range[0], endByte],
      headerRange: [tokens[ampIdx].range[0], tokens[lbrace].range[1]],
      bodyRange: [tokens[lbrace].range[1], tokens[rbrace].range[0]],
    },
    endIdx: tokenIdxAtByte(tokens, endByte) ?? rbrace + 1,
  }
}

function tryConsumeNamedMouseGesture(
  tokens: Token[],
  nameIdx: number,
): { section: Section; endIdx: number } | null {
  // `name : type { ... };`
  const colonIdx = skipTrivia(tokens, nameIdx + 1)
  if (colonIdx === -1 || tokens[colonIdx].kind !== 'colon') return null
  const typeIdx = skipTrivia(tokens, colonIdx + 1)
  if (typeIdx === -1 || tokens[typeIdx].kind !== 'identifier') return null
  if (!tokens[typeIdx].value.startsWith(MOUSE_GESTURE_NAMED_PREFIX)) return null
  const lbrace = findLBraceFrom(tokens, typeIdx + 1)
  if (lbrace === -1) return null
  const rbrace = findMatchingRBrace(tokens, lbrace)
  if (rbrace === -1) return null
  const endByte = findSemiAfter(tokens, rbrace)
  return {
    section: {
      kind: 'mouse-gesture-named',
      name: tokens[nameIdx].value,
      range: [tokens[nameIdx].range[0], endByte],
      headerRange: [tokens[nameIdx].range[0], tokens[lbrace].range[1]],
      bodyRange: [tokens[lbrace].range[1], tokens[rbrace].range[0]],
    },
    endIdx: tokenIdxAtByte(tokens, endByte) ?? rbrace + 1,
  }
}

function tokenIdxAtByte(tokens: Token[], byte: number): number | null {
  // Linear scan acceptable for our file sizes.
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].range[1] === byte) return i
  }
  return null
}
