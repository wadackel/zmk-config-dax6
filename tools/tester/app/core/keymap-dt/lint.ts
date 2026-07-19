// Editor-facing lint pass. Runs against a candidate text BEFORE writing it back.
// Errors block save; warnings do not.

import { getBoard } from '../../boards/active'
import { baseArityTable, LAYER_INDEX_BEHAVIORS } from '../picker/behavior-registry'
import { tokenize } from './lexer'
import { parseKeymap, type ParsedKeymap } from './parse'
import type { TokenKind } from './types'

const TRIVIA_KINDS = new Set<TokenKind>([
  'whitespace',
  'newline',
  'line-comment',
  'block-comment',
])

export type LintMessage = {
  severity: 'error' | 'warn'
  message: string
  /** Optional source range when locality is known. */
  range?: [number, number]
}

export type LintResult = {
  ok: boolean
  errors: LintMessage[]
  warnings: LintMessage[]
}

// Custom behaviours discovered from the parsed keymap (esc_lang2, enc_scroll,
// esc_lang2_with_layer, ...) get added at lint time on top of the shared
// behavior-registry arities.

export function lint(source: string): LintResult {
  const errors: LintMessage[] = []
  const warnings: LintMessage[] = []

  let parsed: ParsedKeymap
  try {
    parsed = parseKeymap(source)
  } catch (err) {
    errors.push({
      severity: 'error',
      message: `parse error: ${(err as Error).message}`,
    })
    return { ok: false, errors, warnings }
  }

  // 1. Brace balance.
  if (!braceBalanced(source)) {
    errors.push({ severity: 'error', message: 'unbalanced braces / brackets in keymap' })
  }

  const board = getBoard()
  const keyCount = board.matrix.keyCount

  // 2. Layer bindings count.
  for (const layer of parsed.layers) {
    if (layer.bindings.length !== keyCount) {
      errors.push({
        severity: 'error',
        message: `layer ${layer.name}: expected ${keyCount} bindings, got ${layer.bindings.length}`,
      })
    }
  }

  // Build the set of known behaviour names: registry + custom behaviours + macros.
  const arityTable: Record<string, readonly number[]> = { ...baseArityTable() }
  for (const macro of parsed.macros) {
    arityTable[`&${macro.name}`] = [0]
  }
  for (const behavior of parsed.behaviors) {
    // Custom behaviour arity = arity of one of its bindings entries if present,
    // otherwise default to 0. (esc_lang2_with_layer is `&mo`-style => 2 args.)
    if (behavior.bindings && behavior.bindings.length > 0) {
      arityTable[`&${behavior.name}`] = [2]
    } else {
      arityTable[`&${behavior.name}`] = [0]
    }
  }

  const layerCount = parsed.layers.length
  const LAYER_TAP_BEHAVIORS = board.behaviors.layerTapBehaviors

  // 3. Layer binding arity + reference integrity + layer-index range.
  for (const layer of parsed.layers) {
    for (let i = 0; i < layer.bindings.length; i++) {
      const chain = layer.bindings[i]
      const name = chain.tokens[0]
      const args = chain.tokens.slice(1)
      const valid = arityTable[name]
      if (!valid) {
        errors.push({
          severity: 'error',
          message: `layer ${layer.name} key ${i}: unknown behaviour "${name}"`,
        })
        continue
      }
      if (!valid.includes(args.length)) {
        errors.push({
          severity: 'error',
          message: `layer ${layer.name} key ${i}: "${name}" expects ${valid.join('|')} arg(s), got ${args.length}`,
        })
      }
      // Layer-index range check: numeric layer args must be in 0..layerCount-1.
      if (LAYER_INDEX_BEHAVIORS.has(name) || LAYER_TAP_BEHAVIORS.has(name)) {
        const ref = args[0]
        const n = Number(ref)
        if (Number.isInteger(n) && (n < 0 || n >= layerCount)) {
          errors.push({
            severity: 'error',
            message: `layer ${layer.name} key ${i}: "${name} ${ref}" references layer ${ref} but only ${layerCount} layer(s) exist`,
          })
        }
      }
    }
  }

  // 4. Combo: key-positions in 0..keyCount-1 + bindings reference exists + layers in range.
  const maxKeyIdx = keyCount - 1
  for (const combo of parsed.combos) {
    for (const pos of combo.keyPositions) {
      if (!Number.isInteger(pos) || pos < 0 || pos > maxKeyIdx) {
        errors.push({
          severity: 'error',
          message: `combo ${combo.name}: key-position ${pos} out of range (must be 0..${maxKeyIdx})`,
        })
      }
    }
    if (combo.keyPositions.length < 2) {
      warnings.push({
        severity: 'warn',
        message: `combo ${combo.name}: fewer than 2 key-positions`,
      })
    }
    const cbName = combo.bindings.tokens[0]
    if (cbName && !arityTable[cbName]) {
      errors.push({
        severity: 'error',
        message: `combo ${combo.name}: unknown behaviour "${cbName}"`,
      })
    }
    for (const ref of combo.layers) {
      if (!Number.isInteger(ref) || ref < 0 || ref >= layerCount) {
        errors.push({
          severity: 'error',
          message: `combo ${combo.name}: layers reference ${ref} but only ${layerCount} layer(s) exist`,
        })
      }
    }
  }

  // 5. Mouse gesture: reject anonymous pattern entries (`{ pattern = ...; bindings = ...; };`
  // without a leading identifier). `parseMouseGestureBlock` silently skips those blocks —
  // they never appear in `parsed.mouseGestures[].entries` — so a model-only check would miss
  // the exact malformed shape that the tab can produce via an empty entry-name input.
  for (const section of parsed.sections) {
    if (section.kind !== 'mouse-gesture-root' && section.kind !== 'mouse-gesture-named') {
      continue
    }
    const body = source.slice(section.bodyRange[0], section.bodyRange[1])
    const tokens = tokenize(body)
    let depth = 0
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      if (tok.kind === 'lbrace') {
        if (depth === 0) {
          let j = i - 1
          while (j >= 0 && TRIVIA_KINDS.has(tokens[j].kind)) j--
          if (j < 0 || tokens[j].kind !== 'identifier') {
            const label = section.kind === 'mouse-gesture-root'
              ? '&zip_mouse_gesture'
              : section.name ?? '(named)'
            errors.push({
              severity: 'error',
              message: `mouse gesture ${label}: anonymous pattern entry — entry name is required`,
              range: [section.bodyRange[0] + tok.range[0], section.bodyRange[0] + tok.range[1]],
            })
          }
        }
        depth++
      } else if (tok.kind === 'rbrace') {
        depth--
      }
    }
  }

  // 6. Macro: every chain references known behaviours.
  for (const macro of parsed.macros) {
    for (const chain of macro.bindingsList) {
      let i = 0
      while (i < chain.tokens.length) {
        const tok = chain.tokens[i]
        if (tok.startsWith('&')) {
          if (!arityTable[tok]) {
            errors.push({
              severity: 'error',
              message: `macro ${macro.name}: unknown behaviour "${tok}"`,
            })
            i++
            continue
          }
          const arities = arityTable[tok]
          // Advance i by 1 + first matching arity (best-effort).
          i += 1 + (arities[0] ?? 0)
        } else {
          i++
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

function braceBalanced(source: string): boolean {
  const tokens = tokenize(source)
  let braces = 0
  let angles = 0
  let parens = 0
  for (const t of tokens) {
    if (t.kind === 'lbrace') braces++
    else if (t.kind === 'rbrace') braces--
    else if (t.kind === 'langle') angles++
    else if (t.kind === 'rangle') angles--
    else if (t.kind === 'lparen') parens++
    else if (t.kind === 'rparen') parens--
    if (braces < 0 || angles < 0 || parens < 0) return false
  }
  return braces === 0 && angles === 0 && parens === 0
}
