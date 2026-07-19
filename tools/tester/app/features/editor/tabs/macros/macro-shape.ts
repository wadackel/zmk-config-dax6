import type { BindingChain, MacroEntry } from '../../../../core/keymap-dt/types'
import { getBehavior } from '../../../../core/picker'

/**
 * A macro chain is "simple" — safely round-trippable through the
 * BindingDock — only when it references exactly one behaviour AND
 * that behaviour's arity matches the current token count. Macros permit
 * shorthand like `<&kp ESCAPE &kp LANG2>` (two behaviours in one
 * angle-bracket group), and user-defined behaviours (`&my_thing ARG1 ARG2`)
 * may not be in the picker catalog at all — in either case the Inspector
 * would normalise to a single behaviour + fixed arity and silently drop
 * tokens on commit.
 */
export function isSimpleChain(chain: BindingChain): boolean {
  const behaviourCount = chain.tokens.filter((t) => t.startsWith('&')).length
  if (behaviourCount > 1) return false
  if (chain.tokens.length === 0) return true
  const head = chain.tokens[0]!
  if (!head.startsWith('&')) return false
  const behavior = getBehavior(head)
  if (!behavior) {
    return chain.tokens.length === 1
  }
  const maxArity = Math.max(0, ...behavior.arity)
  const argCount = chain.tokens.length - 1
  return argCount <= maxArity
}

/** A macro is SIMPLE overall when every chain in its bindingsList is simple. */
export function isMacroSimple(macro: MacroEntry): boolean {
  return macro.bindingsList.every(isSimpleChain)
}
