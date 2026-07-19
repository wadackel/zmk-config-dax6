import type { BehaviorEntry } from '../../core/picker/behaviors'

// Custom behaviors defined by config/dax6.keymap. Merged into the picker's
// BEHAVIORS list at runtime via core/picker/behavior-registry.
export const customs: readonly BehaviorEntry[] = [
  {
    token: '&esc_lang2_with_layer',
    label: 'Esc + LANG2 (hold-tap)',
    arity: [2],
    argTypes: ['layer', 'keycode'],
    argLabels: ['Hold layer', 'Tap key'],
    group: 'custom',
  },
  {
    token: '&enc_scroll',
    label: 'Encoder scroll var',
    arity: [2],
    argTypes: ['msc-action', 'msc-action'],
    argLabels: ['CCW keycode', 'CW keycode'],
    group: 'custom',
  },
  { token: '&esc_lang2', label: 'Esc + LANG2 macro', arity: [0], group: 'custom' },
]
