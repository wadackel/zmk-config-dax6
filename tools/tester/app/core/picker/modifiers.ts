// Modifier wrappers — `LC(A)`, `LS(B)`, etc.
//
// Used by the picker to compose keycodes with held modifiers without spawning
// extra UI for each combination.

export const MODIFIER_WRAPPERS = [
  { wrap: 'LC', label: 'Ctrl' },
  { wrap: 'LS', label: 'Shift' },
  { wrap: 'LA', label: 'Alt' },
  { wrap: 'LG', label: 'GUI' },
  { wrap: 'RC', label: 'R-Ctrl' },
  { wrap: 'RS', label: 'R-Shift' },
  { wrap: 'RA', label: 'R-Alt' },
  { wrap: 'RG', label: 'R-GUI' },
] as const

export type ModifierWrap = (typeof MODIFIER_WRAPPERS)[number]['wrap']

export function applyModifier(wrap: ModifierWrap, token: string): string {
  return `${wrap}(${token})`
}

/** Extracts inner keycode from `LC(A)` style wrappers. Returns null when not wrapped. */
export function unwrapModifier(token: string): { wrap: ModifierWrap; inner: string } | null {
  const m = /^([LR][CSGA])\((.+)\)$/.exec(token)
  if (!m) return null
  return { wrap: m[1] as ModifierWrap, inner: m[2] }
}

/**
 * Canonical nesting order for ZMK modifier wrappers. The outermost wrapper is
 * the LAST entry, so applying `[LC, LS, LA, LG]` to `A` yields `LG(LA(LS(LC(A))))`.
 * Fixed order is chosen for diff stability: editing two bindings with the same
 * modifier set should produce identical token strings regardless of UI click
 * order.
 */
const MODIFIER_ORDER: ModifierWrap[] = ['LC', 'LS', 'LA', 'LG', 'RC', 'RS', 'RA', 'RG']

/**
 * Wraps `token` in every modifier listed in `wraps`, in the canonical
 * `MODIFIER_ORDER`. The order of `wraps` itself is ignored.
 */
export function applyModifiersOrdered(token: string, wraps: Iterable<ModifierWrap>): string {
  const active = new Set<ModifierWrap>(wraps)
  let out = token
  for (const wrap of MODIFIER_ORDER) {
    if (active.has(wrap)) out = `${wrap}(${out})`
  }
  return out
}

/**
 * Strips every nested modifier wrapper from `token` and returns the bare inner
 * keycode plus the set of wrappers found. Symmetric with `applyModifiersOrdered`.
 */
export function unwrapAllModifiers(token: string): { inner: string; wraps: Set<ModifierWrap> } {
  const wraps = new Set<ModifierWrap>()
  let current = token
  while (true) {
    const m = /^([LR][CSGA])\((.+)\)$/.exec(current)
    if (!m) break
    wraps.add(m[1] as ModifierWrap)
    current = m[2]
  }
  return { inner: current, wraps }
}
