// Keycode catalogue used by the picker UI. Each entry has a display label, a
// canonical ZMK token (the string the user picks → goes into the keymap), an
// optional group for the picker's sidebar, and a list of search aliases.
//
// Only the subset of ZMK keycodes that dax6 cares about. Future expansion is a
// matter of adding more entries.

export type KeycodeEntry = {
  /** The token used inside a binding, e.g. `A`, `SEMICOLON`, `LC(A)`. */
  token: string
  /** Short user-facing label, e.g. `A`, `;`, `Cmd+A`. */
  label: string
  /** Sidebar group. */
  group: KeycodeGroup
  /** Lowercase search aliases. */
  aliases?: string[]
}

export type KeycodeGroup =
  | 'letters'
  | 'numbers'
  | 'symbols'
  | 'modifiers'
  | 'nav'
  | 'media'
  | 'mouse'
  | 'system'
  | 'lang'
  | 'brackets'

const letters: KeycodeEntry[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
].map((l) => ({ token: l, label: l, group: 'letters' as const }))

const numbers: KeycodeEntry[] = [
  { token: 'N1', label: '1', group: 'numbers' },
  { token: 'N2', label: '2', group: 'numbers' },
  { token: 'N3', label: '3', group: 'numbers' },
  { token: 'N4', label: '4', group: 'numbers' },
  { token: 'N5', label: '5', group: 'numbers' },
  { token: 'N6', label: '6', group: 'numbers' },
  { token: 'N7', label: '7', group: 'numbers' },
  { token: 'N8', label: '8', group: 'numbers' },
  { token: 'N9', label: '9', group: 'numbers' },
  { token: 'N0', label: '0', group: 'numbers' },
]

const symbols: KeycodeEntry[] = [
  // Unshifted symbols (the bare physical keys)
  { token: 'MINUS', label: '-', group: 'symbols', aliases: ['minus'] },
  { token: 'EQUAL', label: '=', group: 'symbols', aliases: ['equals'] },
  { token: 'SEMICOLON', label: ';', group: 'symbols' },
  { token: 'SEMI', label: ';', group: 'symbols' },
  { token: 'SQT', label: "'", group: 'symbols', aliases: ['apostrophe', "'", 'single quote'] },
  { token: 'GRAVE', label: '`', group: 'symbols', aliases: ['backtick'] },
  { token: 'COMMA', label: ',', group: 'symbols', aliases: ['comma'] },
  { token: 'DOT', label: '.', group: 'symbols', aliases: ['period'] },
  { token: 'SLASH', label: '/', group: 'symbols', aliases: ['slash'] },
  { token: 'BACKSLASH', label: '\\', group: 'symbols', aliases: ['bslash'] },

  // Shifted symbols (canonical ZMK short tokens; long form kept as alias for
  // searchability). Picking these emits the shifted form so users do not need
  // to compose `LS(...)` manually.
  { token: 'EXCL', label: '!', group: 'symbols', aliases: ['exclamation', 'bang', '!'] },
  { token: 'AT', label: '@', group: 'symbols', aliases: ['at', 'at_sign', '@'] },
  { token: 'HASH', label: '#', group: 'symbols', aliases: ['pound', 'sharp', 'hash', '#'] },
  { token: 'DLLR', label: '$', group: 'symbols', aliases: ['dollar', '$'] },
  { token: 'PRCNT', label: '%', group: 'symbols', aliases: ['percent', '%'] },
  { token: 'CARET', label: '^', group: 'symbols', aliases: ['caret', 'hat', '^'] },
  { token: 'AMPS', label: '&', group: 'symbols', aliases: ['ampersand', '&'] },
  { token: 'STAR', label: '*', group: 'symbols', aliases: ['asterisk', '*'] },
  { token: 'UNDER', label: '_', group: 'symbols', aliases: ['underscore', '_'] },
  { token: 'PLUS', label: '+', group: 'symbols', aliases: ['plus', '+'] },
  { token: 'PIPE', label: '|', group: 'symbols', aliases: ['pipe', 'vertical bar', '|'] },
  { token: 'COLON', label: ':', group: 'symbols', aliases: ['colon', ':'] },
  { token: 'DQT', label: '"', group: 'symbols', aliases: ['double quote', 'double_quotes', '"'] },
  { token: 'TILDE', label: '~', group: 'symbols', aliases: ['tilde', '~'] },
  { token: 'QMARK', label: '?', group: 'symbols', aliases: ['question', '?'] },
  { token: 'LT', label: '<', group: 'symbols', aliases: ['less than', 'less_than', '<'] },
  { token: 'GT', label: '>', group: 'symbols', aliases: ['greater than', 'greater_than', '>'] },
]

const brackets: KeycodeEntry[] = [
  { token: 'LEFT_BRACKET', label: '[', group: 'brackets' },
  { token: 'RIGHT_BRACKET', label: ']', group: 'brackets' },
  { token: 'LEFT_PARENTHESIS', label: '(', group: 'brackets' },
  { token: 'RIGHT_PARENTHESIS', label: ')', group: 'brackets' },
  { token: 'LEFT_BRACE', label: '{', group: 'brackets' },
  { token: 'RIGHT_BRACE', label: '}', group: 'brackets' },
]

const modifiers: KeycodeEntry[] = [
  { token: 'LCTRL', label: 'L-Ctrl', group: 'modifiers' },
  { token: 'LSHIFT', label: 'L-Shift', group: 'modifiers' },
  { token: 'LEFT_SHIFT', label: 'L-Shift', group: 'modifiers' },
  { token: 'LALT', label: 'L-Alt', group: 'modifiers' },
  { token: 'LEFT_ALT', label: 'L-Alt', group: 'modifiers' },
  { token: 'LGUI', label: 'L-GUI', group: 'modifiers' },
  { token: 'LEFT_GUI', label: 'L-GUI', group: 'modifiers' },
  { token: 'RCTRL', label: 'R-Ctrl', group: 'modifiers' },
  { token: 'RSHIFT', label: 'R-Shift', group: 'modifiers' },
  { token: 'RALT', label: 'R-Alt', group: 'modifiers' },
  { token: 'RGUI', label: 'R-GUI', group: 'modifiers' },
]

const nav: KeycodeEntry[] = [
  { token: 'LEFT', label: '←', group: 'nav' },
  { token: 'LEFT_ARROW', label: '←', group: 'nav' },
  { token: 'RIGHT', label: '→', group: 'nav' },
  { token: 'RIGHT_ARROW', label: '→', group: 'nav' },
  { token: 'UP', label: '↑', group: 'nav' },
  { token: 'UP_ARROW', label: '↑', group: 'nav' },
  { token: 'DOWN', label: '↓', group: 'nav' },
  { token: 'DOWN_ARROW', label: '↓', group: 'nav' },
  { token: 'HOME', label: 'Home', group: 'nav' },
  { token: 'END', label: 'End', group: 'nav' },
  { token: 'PAGE_UP', label: 'PgUp', group: 'nav' },
  { token: 'PAGE_DOWN', label: 'PgDn', group: 'nav' },
  { token: 'TAB', label: 'Tab', group: 'nav' },
  { token: 'ESC', label: 'Esc', group: 'nav' },
  { token: 'ESCAPE', label: 'Esc', group: 'nav' },
  { token: 'ENTER', label: 'Enter', group: 'nav' },
  { token: 'RETURN', label: 'Enter', group: 'nav' },
  { token: 'SPACE', label: 'Space', group: 'nav' },
  { token: 'BACKSPACE', label: 'BackSpace', group: 'nav' },
  { token: 'DELETE', label: 'Delete', group: 'nav' },
]

const fkeys: KeycodeEntry[] = Array.from({ length: 12 }, (_, i) => ({
  token: `F${i + 1}`,
  label: `F${i + 1}`,
  group: 'system' as const,
}))

const media: KeycodeEntry[] = [
  { token: 'C_VOL_UP', label: 'Vol+', group: 'media' },
  { token: 'C_VOL_DN', label: 'Vol-', group: 'media' },
  { token: 'C_MUTE', label: 'Mute', group: 'media' },
  { token: 'C_BRI_INC', label: 'Brightness+', group: 'media' },
  { token: 'C_BRI_DEC', label: 'Brightness-', group: 'media' },
  { token: 'C_PP', label: 'Play/Pause', group: 'media' },
  { token: 'C_NEXT', label: 'Next', group: 'media' },
  { token: 'C_PREV', label: 'Prev', group: 'media' },
]

const mouse: KeycodeEntry[] = [
  { token: 'MB1', label: 'L-Click', group: 'mouse' },
  { token: 'MB2', label: 'R-Click', group: 'mouse' },
  { token: 'MB3', label: 'M-Click', group: 'mouse' },
  { token: 'MB4', label: 'Back', group: 'mouse' },
  { token: 'MB5', label: 'Forward', group: 'mouse' },
  { token: 'SCRL_UP', label: 'Scroll↑', group: 'mouse' },
  { token: 'SCRL_DOWN', label: 'Scroll↓', group: 'mouse' },
  { token: 'SCRL_LEFT', label: 'Scroll←', group: 'mouse' },
  { token: 'SCRL_RIGHT', label: 'Scroll→', group: 'mouse' },
]

const lang: KeycodeEntry[] = [
  { token: 'LANG1', label: 'Lang1 (かな)', group: 'lang' },
  { token: 'LANG2', label: 'Lang2 (英数)', group: 'lang' },
]

const system: KeycodeEntry[] = [
  ...fkeys,
  { token: 'CAPS', label: 'CapsLock', group: 'system' },
  { token: 'CAPSLOCK', label: 'CapsLock', group: 'system' },
  { token: 'PRINTSCREEN', label: 'PrtScr', group: 'system' },
]

// config/dax6.keymap consistently uses ZMK long-form keycode names as the
// binding token (`&kp SINGLE_QUOTE`, `&kp ASTERISK`, `&kp NUMBER_1`,
// `&kp C_VOLUME_UP`, …). The picker's canonical tokens above are short forms,
// so the long forms need their own catalog entries — otherwise the Layers tab
// falls back to rendering the raw token instead of the glyph, and the picker
// cannot preselect the existing value. These share glyphs with the short-form
// entries above; KEYCODE_LABEL is first-seen-wins so ordering does not matter.
const longForms: KeycodeEntry[] = [
  { token: 'NUMBER_0', label: '0', group: 'numbers' },
  { token: 'NUMBER_1', label: '1', group: 'numbers' },
  { token: 'NUMBER_2', label: '2', group: 'numbers' },
  { token: 'NUMBER_3', label: '3', group: 'numbers' },
  { token: 'NUMBER_4', label: '4', group: 'numbers' },
  { token: 'NUMBER_5', label: '5', group: 'numbers' },
  { token: 'NUMBER_6', label: '6', group: 'numbers' },
  { token: 'NUMBER_7', label: '7', group: 'numbers' },
  { token: 'NUMBER_8', label: '8', group: 'numbers' },
  { token: 'NUMBER_9', label: '9', group: 'numbers' },
  { token: 'SINGLE_QUOTE', label: "'", group: 'symbols', aliases: ['apostrophe', "'", 'single quote'] },
  { token: 'DOUBLE_QUOTES', label: '"', group: 'symbols', aliases: ['double quote', '"'] },
  { token: 'EXCLAMATION', label: '!', group: 'symbols', aliases: ['exclamation', 'bang', '!'] },
  { token: 'AT_SIGN', label: '@', group: 'symbols', aliases: ['at', 'at_sign', '@'] },
  { token: 'DOLLAR', label: '$', group: 'symbols', aliases: ['dollar', '$'] },
  { token: 'PERCENT', label: '%', group: 'symbols', aliases: ['percent', '%'] },
  { token: 'AMPERSAND', label: '&', group: 'symbols', aliases: ['ampersand', '&'] },
  { token: 'ASTERISK', label: '*', group: 'symbols', aliases: ['asterisk', 'star', '*'] },
  { token: 'ASTRK', label: '*', group: 'symbols', aliases: ['asterisk', 'star', '*'] },
  { token: 'UNDERSCORE', label: '_', group: 'symbols', aliases: ['underscore', '_'] },
  { token: 'QUESTION', label: '?', group: 'symbols', aliases: ['question', '?'] },
  { token: 'LESS_THAN', label: '<', group: 'symbols', aliases: ['less than', 'less_than', '<'] },
  { token: 'GREATER_THAN', label: '>', group: 'symbols', aliases: ['greater than', 'greater_than', '>'] },
  { token: 'PERIOD', label: '.', group: 'symbols', aliases: ['period', 'dot', '.'] },
  { token: 'C_VOLUME_UP', label: 'Vol+', group: 'media', aliases: ['volume up'] },
  { token: 'C_VOLUME_DOWN', label: 'Vol-', group: 'media', aliases: ['volume down'] },
]

export const KEYCODES: KeycodeEntry[] = [
  ...letters,
  ...numbers,
  ...symbols,
  ...brackets,
  ...modifiers,
  ...nav,
  ...media,
  ...mouse,
  ...lang,
  ...system,
  ...longForms,
]

/**
 * Tokens displayed at the top of the keycode picker when the user has not yet
 * typed a query. Hand-curated set of "almost certainly what you want" entries
 * so the common case is reachable without scrolling.
 */
export const COMMON_KEYCODES: string[] = [
  // Letters + digits
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N0',
  // Whitespace + control
  'TAB', 'ESCAPE', 'ENTER', 'SPACE', 'BACKSPACE', 'DELETE',
  // Arrows
  'LEFT', 'RIGHT', 'UP', 'DOWN',
  // Japanese IME
  'LANG1', 'LANG2',
  // Common symbols
  'SEMI', 'COMMA', 'DOT', 'SLASH', 'MINUS', 'EQUAL', 'GRAVE', 'SQT', 'BACKSLASH',
]

/**
 * Pure modifier keycodes — the only sensible entries for `&mt` hold slots.
 */
export const MODIFIER_KEYCODE_TOKENS: string[] = [
  'LCTRL', 'LSHIFT', 'LALT', 'LGUI',
  'RCTRL', 'RSHIFT', 'RALT', 'RGUI',
]

export function searchKeycodes(query: string): KeycodeEntry[] {
  const q = query.toLowerCase().trim()
  if (!q) return KEYCODES
  return KEYCODES.filter((k) => {
    if (k.label.toLowerCase().includes(q)) return true
    if (k.token.toLowerCase().includes(q)) return true
    return (k.aliases ?? []).some((a) => a.includes(q))
  })
}
