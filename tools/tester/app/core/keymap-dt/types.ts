// Shared types for the keymap-dt module.

export type Range = readonly [start: number, end: number]

export type TokenKind =
  | 'identifier'
  | 'number'
  | 'string'
  | 'lbrace'
  | 'rbrace'
  | 'langle'
  | 'rangle'
  | 'lparen'
  | 'rparen'
  | 'semi'
  | 'colon'
  | 'equals'
  | 'ampersand'
  | 'comma'
  | 'slash'
  | 'line-comment'
  | 'block-comment'
  | 'preproc'
  | 'whitespace'
  | 'newline'

export type Token = {
  kind: TokenKind
  value: string
  range: Range
}

export type SectionKind =
  | 'layer'
  | 'combos-container'
  | 'combo-entry'
  | 'macros-container'
  | 'macro-entry'
  | 'behaviors-container'
  | 'behavior-entry'
  | 'mouse-gesture-root' // `&zip_mouse_gesture { ... };`
  | 'mouse-gesture-named' // `name: zip_mouse_gesture_mac { ... };`
  | 'mouse-gesture-pattern-entry' // inside a mouse-gesture block
  | 'root-mt' // `&mt { ... };`
  | 'root-lt' // `&lt { ... };`
  | 'keymap-root' // `keymap { ... };`

export type Section = {
  kind: SectionKind
  /** Optional human-facing name (e.g. layer name). */
  name?: string
  /** Range covering the entire section text, including any leading reference/header. */
  range: Range
  /** Range of the header part (everything from start up to and including the opening `{`). */
  headerRange: Range
  /** Range of the body (between the matching `{` and `}`, exclusive of the braces). */
  bodyRange: Range
}

export type BindingChain = {
  /** Tokens of the chain, e.g. ['&kp', 'A'] or ['&mt', 'LEFT_GUI', 'LANG2']. */
  tokens: string[]
}

export type LayerData = {
  name: string
  /** Always length 44 for dax6. */
  bindings: BindingChain[]
  /** Null when the layer does not declare `sensor-bindings`. */
  sensorBindings: { perEncoder: BindingChain[] } | null
}

export type ComboEntry = {
  name: string
  bindings: BindingChain
  keyPositions: number[]
  layers: number[]
}

export type MacroEntry = {
  /** The DT label (first identifier, used by `&label` references in bindings). */
  name: string
  /**
   * The DT node-name (second identifier in the `label: nodeName { ... };` form).
   * When omitted, the serializer falls back to `name` (i.e. `label: label`).
   */
  nodeName?: string
  /** Each list element corresponds to one DT angle-bracket group inside `bindings = <...>, <...>;`. */
  bindingsList: BindingChain[]
  /** Other DT properties on the macro entry (compatible, #binding-cells, etc.) in source order. */
  props: { name: string; value: string }[]
}

export type BehaviorEntry = {
  /** The DT label (first identifier, used by `&label` references in bindings). */
  name: string
  /**
   * The DT node-name (second identifier in the `label: nodeName { ... };` form).
   * When omitted, the serializer falls back to `name`.
   */
  nodeName?: string
  compatible: string
  /** Other DT properties (preserved in source order). */
  props: { name: string; value: string }[]
  /** If the entry exposes `bindings = <...>, <...>;` (e.g. hold-tap), the chains live here. */
  bindings?: BindingChain[]
}

export type MouseGesturePattern = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export type MouseGesturePatternEntry = {
  name: string
  pattern: MouseGesturePattern
  bindings: BindingChain
}

export type MouseGestureBlock = {
  /** 'root' = `&zip_mouse_gesture { ... };`, 'named' = `<name>: zip_mouse_gesture_mac { ... };`. */
  kind: 'root' | 'named'
  /** Present when `kind === 'named'`. */
  name?: string
  props: { name: string; value: string }[]
  entries: MouseGesturePatternEntry[]
}

export type RootBehaviorConfig = {
  kind: 'mt' | 'lt'
  props: { name: string; value: string }[]
}
