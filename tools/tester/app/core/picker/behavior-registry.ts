// Behaviour classifier + arity source used by the lint pass and by editor
// state transitions. Behaviour *lookup* lives in `./behaviors.ts`
// (`allBehaviors` / `getBehavior` / `searchBehaviors`); this file only exposes
// derivations that consume that list.

import { allBehaviors } from './behaviors'

export const LAYER_INDEX_BEHAVIORS: ReadonlySet<string> = new Set([
  '&mo',
  '&to',
  '&tog',
  '&sl',
])

/**
 * Arity lookup table indexed by behaviour name (with `&` prefix). Reflects the
 * statically-known behaviours (builtins + the active board's custom
 * behaviours). `lint.ts` extends this with keymap-declared macros/behaviours
 * at lint time.
 */
export function baseArityTable(): Record<string, readonly number[]> {
  const out: Record<string, readonly number[]> = {}
  for (const b of allBehaviors()) {
    out[b.token] = b.arity
  }
  return out
}
