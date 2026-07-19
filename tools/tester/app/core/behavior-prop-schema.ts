// Typed prop schema for the Behaviors tab. Without this map, well-known
// hold-tap props (`tapping-term-ms`, `flavor`, `retro-tap`, …) fall back to
// raw name/value inputs where the user must hand-type DT syntax like
// `<200>` or `"balanced"` — an obvious footgun for values the picker can
// enumerate. Unknown compatibles still route to raw editing under Advanced.

export type PropKind =
  | { type: 'int-ms'; min?: number; max?: number }
  | { type: 'int'; min?: number; max?: number }
  | { type: 'enum'; options: readonly string[] }
  | { type: 'bool' }
  | { type: 'raw' } // free-text DT literal (arrays, phandles, etc.)

export type PropSchema = {
  name: string
  kind: PropKind
  label?: string
  hint?: string
}

// See https://zmk.dev/docs/keymaps/behaviors/hold-tap for prop semantics.
const HOLD_TAP_PROPS: readonly PropSchema[] = [
  {
    name: 'tapping-term-ms',
    kind: { type: 'int-ms', min: 0, max: 5000 },
    label: 'Tapping term',
    hint: 'How long a press must be held before the hold behaviour activates.',
  },
  {
    name: 'quick-tap-ms',
    kind: { type: 'int-ms', min: 0, max: 5000 },
    label: 'Quick tap',
    hint: 'Re-press within this window commits the tap immediately.',
  },
  {
    name: 'require-prior-idle-ms',
    kind: { type: 'int-ms', min: 0, max: 5000 },
    label: 'Require prior idle',
    hint: 'Suppress hold when another key was pressed within this window.',
  },
  {
    name: 'flavor',
    kind: {
      type: 'enum',
      options: ['hold-preferred', 'tap-preferred', 'balanced', 'tap-unless-interrupted'],
    },
    label: 'Flavor',
    hint: 'Decision policy for tap vs hold.',
  },
  {
    name: 'retro-tap',
    kind: { type: 'bool' },
    label: 'Retro tap',
    hint: 'Emit the tap if the hold released without triggering another key.',
  },
  {
    name: 'hold-trigger-on-release',
    kind: { type: 'bool' },
    label: 'Hold trigger on release',
  },
] as const

const SENSOR_ROTATE_PROPS: readonly PropSchema[] = [
  {
    name: 'tap-ms',
    kind: { type: 'int-ms', min: 16, max: 500 },
    // CLAUDE.md rule: values below 16ms silently break scroll because that
    // is the internal event period. Enforce the floor via `min` so the
    // number spinner refuses to submit anything below it.
    label: 'Tap length',
    hint: 'Values below 16ms silently break scroll (event period).',
  },
] as const

const SCHEMA_BY_COMPATIBLE: Record<string, readonly PropSchema[]> = {
  'zmk,behavior-hold-tap': HOLD_TAP_PROPS,
  'zmk,behavior-sensor-rotate-var': SENSOR_ROTATE_PROPS,
  'zmk,behavior-sensor-rotate': SENSOR_ROTATE_PROPS,
}

export function getBehaviorSchema(compatible: string | undefined): readonly PropSchema[] {
  if (!compatible) return []
  return SCHEMA_BY_COMPATIBLE[compatible] ?? []
}

// `&mt` and `&lt` are hold-tap variants at the DTS root; they share the
// hold-tap schema even though the parser exposes them as `RootBehaviorConfig`.
export function getRootBehaviorSchema(_kind: 'mt' | 'lt'): readonly PropSchema[] {
  return HOLD_TAP_PROPS
}

export function formatPropValue(kind: PropKind, value: string | number | boolean): string {
  switch (kind.type) {
    case 'int':
    case 'int-ms':
      return `<${value}>`
    case 'enum':
      return `"${value}"`
    case 'bool':
      // ZMK bool props are valueless flags: presence = true, absence = false.
      // The editor keeps the row and emits an empty value; the caller drops
      // the whole prop entry when the user toggles it off.
      return ''
    case 'raw':
      return String(value)
  }
}

export function parsePropValue(kind: PropKind, raw: string): string | number | boolean | undefined {
  const trimmed = raw.trim()
  switch (kind.type) {
    case 'int':
    case 'int-ms': {
      const m = /^<\s*(-?\d+)\s*>$/.exec(trimmed)
      if (m) return Number(m[1])
      const n = Number(trimmed)
      return Number.isFinite(n) ? n : undefined
    }
    case 'enum': {
      const stringLike = /^"(.*)"$/.exec(trimmed)
      const value = stringLike ? stringLike[1]! : trimmed
      return kind.options.includes(value) ? value : undefined
    }
    case 'bool':
      // Property presence alone is truthy; ZMK ignores any value.
      return true
    case 'raw':
      return trimmed
  }
}
