// Section-aware parser. Given the raw source plus the section list from
// `sections.ts`, produces structured data for every section kind the editor
// can edit. Unknown sections are intentionally left raw — patch.ts preserves
// them byte-for-byte.

import { getBoard } from '../../boards/active'
import { skipTrivia, tokenize } from './lexer'
import { detectSections } from './sections'
import type {
  BehaviorEntry,
  BindingChain,
  ComboEntry,
  LayerData,
  MacroEntry,
  MouseGestureBlock,
  MouseGesturePattern,
  MouseGesturePatternEntry,
  RootBehaviorConfig,
  Section,
  Token,
} from './types'

export type ParsedKeymap = {
  source: string
  sections: Section[]
  layers: LayerData[]
  combos: ComboEntry[]
  macros: MacroEntry[]
  behaviors: BehaviorEntry[]
  mouseGestures: MouseGestureBlock[]
  rootBehaviors: RootBehaviorConfig[]
}

export function parseKeymap(source: string): ParsedKeymap {
  const { sections } = detectSections(source)

  const layers: LayerData[] = []
  const combos: ComboEntry[] = []
  const macros: MacroEntry[] = []
  const behaviors: BehaviorEntry[] = []
  const mouseGestures: MouseGestureBlock[] = []
  const rootBehaviors: RootBehaviorConfig[] = []

  for (const s of sections) {
    const body = source.slice(s.bodyRange[0], s.bodyRange[1])
    const headerText = source.slice(s.headerRange[0], s.headerRange[1])
    switch (s.kind) {
      case 'layer':
        layers.push(parseLayer(s.name ?? '', body))
        break
      case 'combo-entry':
        combos.push(parseCombo(s.name ?? '', body))
        break
      case 'macro-entry':
        macros.push(parseMacro(s.name ?? '', body, headerText))
        break
      case 'behavior-entry':
        behaviors.push(parseBehavior(s.name ?? '', body, headerText))
        break
      case 'mouse-gesture-root':
        mouseGestures.push(parseMouseGestureBlock('root', s.name, body, source, sections))
        break
      case 'mouse-gesture-named':
        mouseGestures.push(parseMouseGestureBlock('named', s.name, body, source, sections))
        break
      case 'root-mt':
        rootBehaviors.push({ kind: 'mt', props: parseProps(body) })
        break
      case 'root-lt':
        rootBehaviors.push({ kind: 'lt', props: parseProps(body) })
        break
      default:
        // Containers (keymap/combos/macros/behaviors) need no top-level parse.
        break
    }
  }

  return { source, sections, layers, combos, macros, behaviors, mouseGestures, rootBehaviors }
}

// ===== Layer =====

function parseLayer(name: string, body: string): LayerData {
  // Within a layer body we expect: `bindings = <...>;` and optionally
  // `sensor-bindings = <...>, <...>;` plus arbitrary other properties (ignored).
  const bindingsText = extractAngleProperty(body, 'bindings')
  if (!bindingsText) {
    throw new Error(`Layer ${name}: missing bindings property`)
  }
  const bindings = parseBindingChainsFromAngle(bindingsText)
  const keyCount = getBoard().matrix.keyCount
  if (bindings.length !== keyCount) {
    throw new Error(
      `Layer ${name}: expected ${keyCount} bindings, got ${bindings.length}`,
    )
  }

  const sensorAngleGroups = extractAngleListProperty(body, 'sensor-bindings')
  const sensorBindings = sensorAngleGroups
    ? { perEncoder: sensorAngleGroups.flatMap(parseBindingChainsFromAngle) }
    : null

  return { name, bindings, sensorBindings }
}

// ===== Combo =====

function parseCombo(name: string, body: string): ComboEntry {
  const bindingsText = extractAngleProperty(body, 'bindings')
  if (!bindingsText) throw new Error(`Combo ${name}: missing bindings`)
  const bindingChains = parseBindingChainsFromAngle(bindingsText)
  if (bindingChains.length !== 1) {
    throw new Error(`Combo ${name}: expected exactly 1 binding chain, got ${bindingChains.length}`)
  }

  const keyPositionsText = extractAngleProperty(body, 'key-positions')
  const keyPositions = keyPositionsText
    ? keyPositionsText
        .trim()
        .split(/\s+/)
        .map((s) => Number.parseInt(s, 10))
    : []

  const layersText = extractAngleProperty(body, 'layers')
  const layers = layersText
    ? layersText
        .trim()
        .split(/\s+/)
        .map((s) => Number.parseInt(s, 10))
    : []

  return { name, bindings: bindingChains[0], keyPositions, layers }
}

// ===== Macro =====

function parseMacro(name: string, body: string, headerText: string): MacroEntry {
  const bindingChains = extractAngleListProperty(body, 'bindings') ?? []
  const bindingsList = bindingChains.map(parseSingleBindingChain)
  const props = parseScalarProps(body, ['bindings'])
  const nodeName = extractNodeNameFromHeader(headerText, name)
  return { name, nodeName, bindingsList, props }
}

// ===== Behavior =====

function parseBehavior(name: string, body: string, headerText: string): BehaviorEntry {
  const compatible = extractStringProperty(body, 'compatible') ?? ''
  const bindingsListText = extractAngleListProperty(body, 'bindings')
  const bindings = bindingsListText ? bindingsListText.map(parseSingleBindingChain) : undefined
  const props = parseScalarProps(body, ['compatible', 'bindings'])
  const nodeName = extractNodeNameFromHeader(headerText, name)
  return { name, nodeName, compatible, props, bindings }
}

/**
 * For headers of the form `label: nodeName {`, returns the node-name. Returns
 * undefined when the header has no label (just `nodeName {`) or when the
 * label and node-name are identical.
 */
function extractNodeNameFromHeader(headerText: string, label: string): string | undefined {
  const match = /(?:^|[\s])([A-Za-z_][\w-]*)\s*:\s*([A-Za-z_][\w-]*)\s*\{/m.exec(headerText)
  if (!match) return undefined
  const [, labelInHeader, nodeName] = match
  if (labelInHeader !== label) return undefined
  return nodeName === label ? undefined : nodeName
}

// ===== Mouse gesture block =====

function parseMouseGestureBlock(
  kind: 'root' | 'named',
  name: string | undefined,
  body: string,
  fullSource: string,
  allSections: Section[],
): MouseGestureBlock {
  // Pattern entries live inline as `name { pattern = <...>; bindings = <...>; };`
  // The section detector does not enumerate them (they are nested inside the
  // mouse-gesture block), so we parse them locally here.
  const entries: MouseGesturePatternEntry[] = []
  const tokens = tokenize(body)
  let i = 0
  const VALID_PATTERNS: readonly MouseGesturePattern[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
  const isValidPattern = (p: string): p is MouseGesturePattern =>
    (VALID_PATTERNS as readonly string[]).includes(p)
  while (i < tokens.length) {
    const t = tokens[i]
    if (t.kind === 'identifier') {
      const j = skipTrivia(tokens, i + 1)
      if (j !== -1 && tokens[j].kind === 'lbrace') {
        // Found a nested block named t.value.
        const rbrace = findMatchingRBraceLocal(tokens, j)
        if (rbrace !== -1) {
          const innerStart = tokens[j].range[1]
          const innerEnd = tokens[rbrace].range[0]
          const innerBody = body.slice(innerStart, innerEnd)
          const pattern = extractAngleProperty(innerBody, 'pattern')
          const bindingsText = extractAngleProperty(innerBody, 'bindings')
          if (pattern && bindingsText) {
            // ZMK pattern tokens are `GESTURE_UP` / `GESTURE_DOWN` / etc.
            // Reject anything that does not match the closed 4-value set so
            // typos do not silently round-trip to garbage.
            const patternToken = pattern.trim().replace(/^GESTURE_/, '')
            if (isValidPattern(patternToken)) {
              const chains = parseBindingChainsFromAngle(bindingsText)
              entries.push({
                name: t.value,
                pattern: patternToken,
                bindings: chains[0] ?? { tokens: [] },
              })
            }
          }
          i = rbrace + 1
          continue
        }
      }
    }
    i++
  }
  // parseScalarProps already steps over nested `name { ... };` blocks via its
  // brace-depth-aware findNextSemi helper, so we can hand it the raw body. We
  // intentionally do NOT strip nested blocks: stripping removes the braces but
  // leaves the entry's name as a stray identifier (`g_back ;`), which then
  // looks exactly like a boolean property and gets misclassified.
  const props = parseScalarProps(body, [])
  // Silence the unused parameter warning when the named-MG search is moved into
  // sections; keep them in case we need cross-section linking later.
  void fullSource
  void allSections
  return { kind, name, props, entries }
}

function findMatchingRBraceLocal(tokens: Token[], lbraceIdx: number): number {
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

// ===== Property extraction primitives =====

/** Extracts the text between the angle brackets of `name = < ... >;`. Returns null when absent. */
function extractAngleProperty(body: string, name: string): string | null {
  const tokens = tokenize(body)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === 'identifier' && tokens[i].value === name) {
      const eq = skipTrivia(tokens, i + 1)
      if (eq === -1 || tokens[eq].kind !== 'equals') continue
      const lt = skipTrivia(tokens, eq + 1)
      if (lt === -1 || tokens[lt].kind !== 'langle') continue
      // Find matching rangle (no nesting in DT angles).
      let depth = 1
      for (let j = lt + 1; j < tokens.length; j++) {
        if (tokens[j].kind === 'langle') depth++
        else if (tokens[j].kind === 'rangle') {
          depth--
          if (depth === 0) {
            return body.slice(tokens[lt].range[1], tokens[j].range[0])
          }
        }
      }
    }
  }
  return null
}

/** Extracts the list when the property has the comma-separated angle form `name = <...>, <...>;`. */
function extractAngleListProperty(body: string, name: string): string[] | null {
  const tokens = tokenize(body)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === 'identifier' && tokens[i].value === name) {
      const eq = skipTrivia(tokens, i + 1)
      if (eq === -1 || tokens[eq].kind !== 'equals') continue
      // Collect successive `<...>` groups separated by `,`.
      const groups: string[] = []
      let k = skipTrivia(tokens, eq + 1)
      while (k !== -1 && tokens[k].kind === 'langle') {
        let depth = 1
        let j = k + 1
        for (; j < tokens.length; j++) {
          if (tokens[j].kind === 'langle') depth++
          else if (tokens[j].kind === 'rangle') {
            depth--
            if (depth === 0) break
          }
        }
        if (j >= tokens.length) return groups.length ? groups : null
        groups.push(body.slice(tokens[k].range[1], tokens[j].range[0]))
        const next = skipTrivia(tokens, j + 1)
        if (next !== -1 && tokens[next].kind === 'comma') {
          k = skipTrivia(tokens, next + 1)
        } else {
          break
        }
      }
      return groups.length ? groups : null
    }
  }
  return null
}

/** Extracts the value of `name = "string";`. Returns the unquoted text. */
function extractStringProperty(body: string, name: string): string | null {
  const tokens = tokenize(body)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === 'identifier' && tokens[i].value === name) {
      const eq = skipTrivia(tokens, i + 1)
      if (eq === -1 || tokens[eq].kind !== 'equals') continue
      const str = skipTrivia(tokens, eq + 1)
      if (str === -1 || tokens[str].kind !== 'string') continue
      const raw = tokens[str].value
      return raw.slice(1, -1)
    }
  }
  return null
}

/** Walks the body and returns name/value pairs of every scalar (=< ... >; or =<num>; or =<string>; or boolean) property in source order. */
function parseScalarProps(body: string, exclude: string[]): { name: string; value: string }[] {
  const excludeSet = new Set(exclude)
  const tokens = tokenize(body)
  const props: { name: string; value: string }[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (t.kind !== 'identifier') {
      i++
      continue
    }
    const eq = skipTrivia(tokens, i + 1)
    if (eq === -1) {
      i++
      continue
    }
    if (tokens[eq].kind === 'semi') {
      // Boolean-style property (`enable-eager-mode;`).
      if (!excludeSet.has(t.value)) props.push({ name: t.value, value: '' })
      i = eq + 1
      continue
    }
    if (tokens[eq].kind !== 'equals') {
      // Skip to next semi.
      const semi = findNextSemi(tokens, i + 1)
      i = semi === -1 ? tokens.length : semi + 1
      continue
    }
    // Property with value. Collect raw text until semi.
    const semi = findNextSemi(tokens, eq + 1)
    if (semi === -1) break
    const valueText = body.slice(tokens[eq].range[1], tokens[semi].range[0]).trim()
    if (!excludeSet.has(t.value)) props.push({ name: t.value, value: valueText })
    i = semi + 1
  }
  return props
}

function parseProps(body: string): { name: string; value: string }[] {
  return parseScalarProps(body, [])
}

function findNextSemi(tokens: Token[], from: number): number {
  let depth = 0
  for (let i = from; i < tokens.length; i++) {
    if (tokens[i].kind === 'lbrace' || tokens[i].kind === 'langle') depth++
    else if (tokens[i].kind === 'rbrace' || tokens[i].kind === 'rangle') depth--
    else if (depth === 0 && tokens[i].kind === 'semi') return i
  }
  return -1
}

// ===== Binding chain helpers =====

/** Splits a `bindings = < ... >` payload into chains. dax6 layers have 44 chains separated by `&`. */
export function parseBindingChainsFromAngle(text: string): BindingChain[] {
  // Tokenize and walk; each chain starts at an ampersand.
  const tokens = tokenize(text)
  const chains: BindingChain[] = []
  let current: string[] | null = null
  for (const t of tokens) {
    if (t.kind === 'ampersand') {
      if (current) chains.push({ tokens: current })
      current = ['&']
    } else if (
      current &&
      t.kind !== 'whitespace' &&
      t.kind !== 'newline' &&
      t.kind !== 'line-comment' &&
      t.kind !== 'block-comment'
    ) {
      // Merge the ampersand into the next identifier so we end up with `['&kp', 'A']`.
      if (current.length === 1 && current[0] === '&' && t.kind === 'identifier') {
        current[0] = '&' + t.value
      } else if (t.kind === 'identifier' || t.kind === 'number' || t.kind === 'lparen' || t.kind === 'rparen') {
        // For modifier-wrapped keys like `LC(A)`, keep the parens with the previous token.
        if (t.kind === 'lparen' || t.kind === 'rparen') {
          current[current.length - 1] += t.value
        } else if (t.kind === 'identifier' && current[current.length - 1].endsWith('(')) {
          current[current.length - 1] += t.value
        } else if (t.kind === 'number' && current[current.length - 1].endsWith('(')) {
          current[current.length - 1] += t.value
        } else {
          current.push(t.value)
        }
      }
    }
  }
  if (current) chains.push({ tokens: current })
  return chains
}

/** For payloads that contain a single chain (sensor-bindings perEncoder, macro list element, etc.). */
export function parseSingleBindingChain(text: string): BindingChain {
  const chains = parseBindingChainsFromAngle(text)
  // Coalesce all tokens after the first `&...` into one chain.
  if (chains.length <= 1) return chains[0] ?? { tokens: [] }
  const merged: string[] = []
  for (const c of chains) merged.push(...c.tokens)
  return { tokens: merged }
}

