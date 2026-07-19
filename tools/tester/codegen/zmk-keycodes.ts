export interface KeycodeMapping {
  label: string
  eventCode?: string
  eventKey?: string
  mouseButton?: number
  testability: 'keyboard' | 'mouse' | 'untestable'
}

// ZMK key name → browser event mapping
// Covers keys used in dax6 default layer
export const ZMK_KEYCODES: Record<string, KeycodeMapping> = {
  // Alphabet
  A: { label: 'A', eventCode: 'KeyA', testability: 'keyboard' },
  B: { label: 'B', eventCode: 'KeyB', testability: 'keyboard' },
  C: { label: 'C', eventCode: 'KeyC', testability: 'keyboard' },
  D: { label: 'D', eventCode: 'KeyD', testability: 'keyboard' },
  E: { label: 'E', eventCode: 'KeyE', testability: 'keyboard' },
  F: { label: 'F', eventCode: 'KeyF', testability: 'keyboard' },
  G: { label: 'G', eventCode: 'KeyG', testability: 'keyboard' },
  H: { label: 'H', eventCode: 'KeyH', testability: 'keyboard' },
  I: { label: 'I', eventCode: 'KeyI', testability: 'keyboard' },
  J: { label: 'J', eventCode: 'KeyJ', testability: 'keyboard' },
  K: { label: 'K', eventCode: 'KeyK', testability: 'keyboard' },
  L: { label: 'L', eventCode: 'KeyL', testability: 'keyboard' },
  M: { label: 'M', eventCode: 'KeyM', testability: 'keyboard' },
  N: { label: 'N', eventCode: 'KeyN', testability: 'keyboard' },
  O: { label: 'O', eventCode: 'KeyO', testability: 'keyboard' },
  P: { label: 'P', eventCode: 'KeyP', testability: 'keyboard' },
  Q: { label: 'Q', eventCode: 'KeyQ', testability: 'keyboard' },
  R: { label: 'R', eventCode: 'KeyR', testability: 'keyboard' },
  S: { label: 'S', eventCode: 'KeyS', testability: 'keyboard' },
  T: { label: 'T', eventCode: 'KeyT', testability: 'keyboard' },
  U: { label: 'U', eventCode: 'KeyU', testability: 'keyboard' },
  V: { label: 'V', eventCode: 'KeyV', testability: 'keyboard' },
  W: { label: 'W', eventCode: 'KeyW', testability: 'keyboard' },
  X: { label: 'X', eventCode: 'KeyX', testability: 'keyboard' },
  Y: { label: 'Y', eventCode: 'KeyY', testability: 'keyboard' },
  Z: { label: 'Z', eventCode: 'KeyZ', testability: 'keyboard' },

  // Symbols
  MINUS: { label: '-', eventCode: 'Minus', testability: 'keyboard' },
  SEMICOLON: { label: ';', eventCode: 'Semicolon', testability: 'keyboard' },
  SINGLE_QUOTE: { label: "'", eventCode: 'Quote', testability: 'keyboard' },
  COMMA: { label: ',', eventCode: 'Comma', testability: 'keyboard' },
  DOT: { label: '.', eventCode: 'Period', testability: 'keyboard' },
  SLASH: { label: '/', eventCode: 'Slash', testability: 'keyboard' },

  // Modifiers
  LCTRL: { label: 'Ctrl', eventCode: 'ControlLeft', testability: 'keyboard' },
  LEFT_SHIFT: { label: 'Shift', eventCode: 'ShiftLeft', testability: 'keyboard' },
  LEFT_ALT: { label: 'Alt', eventCode: 'AltLeft', testability: 'keyboard' },
  LEFT_GUI: { label: 'GUI', eventCode: 'MetaLeft', testability: 'keyboard' },

  // Special keys
  TAB: { label: 'Tab', eventCode: 'Tab', testability: 'keyboard' },
  SPACE: { label: 'Space', eventCode: 'Space', testability: 'keyboard' },
  ENTER: { label: 'Enter', eventCode: 'Enter', testability: 'keyboard' },
  ESCAPE: { label: 'Esc', eventCode: 'Escape', testability: 'keyboard' },

  // Language keys (JIS keyboard)
  LANG1: { label: 'LANG1', eventCode: 'Lang1', eventKey: 'KanaModeSwitch', testability: 'keyboard' },
  LANG2: { label: 'LANG2', eventCode: 'Lang2', eventKey: 'Alphanumeric', testability: 'keyboard' },

  // Mouse buttons
  MB1: { label: 'MB1', mouseButton: 0, testability: 'mouse' },
  MB2: { label: 'MB2', mouseButton: 2, testability: 'mouse' },
  MB3: { label: 'MB3', mouseButton: 1, testability: 'mouse' },
  MB4: { label: 'MB4', mouseButton: 3, testability: 'mouse' },
  MB5: { label: 'MB5', mouseButton: 4, testability: 'mouse' },
}

// Behavior type → default testability
export const BEHAVIOR_TESTABILITY: Record<string, KeycodeMapping['testability']> = {
  kp: 'keyboard',
  lt: 'keyboard',
  mt: 'keyboard',
  mkp: 'mouse',
  mo: 'untestable',
  bootloader: 'untestable',
}

// Custom behavior overrides for keymap-defined behaviors
// Specifies the tap-time output of each custom behavior
export const CUSTOM_BEHAVIORS: Record<string, KeycodeMapping> = {
  esc_lang2_with_layer: { label: 'Esc', eventCode: 'Escape', testability: 'keyboard' },
}

// Language key names that trigger special &mt resolution
// (use hold key as primary, language key as eventKey fallback)
export const LANG_KEYS = new Set(['LANG1', 'LANG2'])
