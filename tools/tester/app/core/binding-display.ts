// Cell-friendly summary of a binding chain for the editor's Layers tab.
// Returns:
//  - `topLine`: small text shown in the top-left of the cell (behaviour token)
//  - `mainLine`: the primary, prominently-displayed label (the actual key)
//  - `subLine`: optional smaller text shown under the main label (e.g. the
//    modifier slot of `&mt`, or the layer index of `&lt`)
//  - `faint`: render the label in a dim colour (e.g. `&trans`, `&none`)
//
// Mirrors how ZMK Studio / ZMK Editor surface keymap state on the keyboard
// preview: the behaviour token is small and dim, the "what will actually be
// produced" is large and centered.

import type { BindingChain } from './keymap-dt/types'
import { KEYCODES } from './picker/keycodes'
import { unwrapAllModifiers, type ModifierWrap } from './picker/modifiers'

const KEYCODE_LABEL = new Map<string, string>()
for (const k of KEYCODES) {
  // First-seen wins so duplicate aliases (SEMI/SEMICOLON, LEFT/LEFT_ARROW, …)
  // do not overwrite the curated label of the canonical entry.
  if (!KEYCODE_LABEL.has(k.token)) KEYCODE_LABEL.set(k.token, k.label)
}

const MOD_SHORT: Record<ModifierWrap, string> = {
  LC: '⌃',
  LS: '⇧',
  LA: '⌥',
  LG: '⌘',
  RC: '⌃',
  RS: '⇧',
  RA: '⌥',
  RG: '⌘',
}

// Canonical display order so `LS(LC(A))` and `LC(LS(A))` render identically.
const MOD_DISPLAY_ORDER: ModifierWrap[] = ['LC', 'RC', 'LS', 'RS', 'LA', 'RA', 'LG', 'RG']

/** Map a single keycode token (possibly wrapped in `LC()` / `LS()` / …) to a
 *  short display label. Falls back to the raw token if unknown. */
export function keycodeLabel(token: string): string {
  if (!token) return ''
  const { inner, wraps } = unwrapAllModifiers(token)
  const base = KEYCODE_LABEL.get(inner) ?? inner
  if (wraps.size === 0) return base
  const prefix = MOD_DISPLAY_ORDER.filter((w) => wraps.has(w)).map((w) => MOD_SHORT[w]).join('')
  return `${prefix}${base}`
}

export type CellDisplay = {
  topLine: string
  mainLine: string
  subLine?: string
  faint: boolean
}

export function formatBindingForCell(chain: BindingChain): CellDisplay {
  const [behavior, ...args] = chain.tokens
  if (!behavior) {
    return { topLine: '', mainLine: '—', faint: true }
  }

  switch (behavior) {
    case '&trans':
      return { topLine: '', mainLine: '&trans', faint: true }
    case '&none':
      return { topLine: '', mainLine: '&none', faint: true }
    case '&kp':
      return { topLine: '&kp', mainLine: keycodeLabel(args[0] ?? ''), faint: false }
    case '&mt':
      return {
        topLine: '&mt',
        mainLine: keycodeLabel(args[1] ?? ''),
        subLine: keycodeLabel(args[0] ?? '') || undefined,
        faint: false,
      }
    case '&lt':
      return {
        topLine: '&lt',
        mainLine: keycodeLabel(args[1] ?? ''),
        subLine: args[0] ? `L${args[0]}` : undefined,
        faint: false,
      }
    case '&mo':
    case '&to':
    case '&tog':
    case '&sl':
      return {
        topLine: behavior,
        mainLine: args[0] ? `L${args[0]}` : '',
        faint: false,
      }
    case '&bt': {
      const [cmd, n] = args
      let mainLine = args.join(' ')
      if (cmd === 'BT_SEL') mainLine = `BT ${n ?? ''}`
      else if (cmd === 'BT_CLR') mainLine = 'BT clr'
      else if (cmd === 'BT_NXT') mainLine = 'BT ▶'
      else if (cmd === 'BT_PRV') mainLine = 'BT ◀'
      return { topLine: '&bt', mainLine, faint: false }
    }
    case '&out':
      return { topLine: '&out', mainLine: args[0]?.replace(/^OUT_/, '') ?? '', faint: false }
    case '&msc':
      return { topLine: '&msc', mainLine: args[0]?.replace(/^SCRL_/, 'Scrl ') ?? '', faint: false }
    case '&mmv':
      return { topLine: '&mmv', mainLine: args[0]?.replace(/^MOVE_/, '') ?? '', faint: false }
    case '&mkp':
      return { topLine: '&mkp', mainLine: args[0] ?? '', faint: false }
    default: {
      // Custom behaviours (macros, user-defined hold-taps like
      // `&esc_lang2_with_layer A ESC`): show the behaviour name on top and
      // best-effort render the LAST arg as the main label since hold-tap
      // style entries put the "tap key" last.
      const last = args[args.length - 1]
      return {
        topLine: behavior,
        mainLine: last ? keycodeLabel(last) : '',
        subLine: args.length > 1 ? args.slice(0, -1).map(keycodeLabel).join(' ') : undefined,
        faint: false,
      }
    }
  }
}

/** Tailwind size class for the main label, scaled to its length to keep
 *  long labels readable in a fixed-size cell. */
export function mainLineSizeClass(label: string): string {
  const len = label.length
  if (len <= 1) return 'text-xl'
  if (len <= 2) return 'text-lg'
  if (len <= 4) return 'text-sm'
  if (len <= 8) return 'text-[11px]'
  return 'text-[10px] leading-tight'
}
