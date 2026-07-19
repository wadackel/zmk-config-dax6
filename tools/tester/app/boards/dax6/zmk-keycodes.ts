import type { ZmkCustomKeycode } from '../types'

// Overrides for keymap-defined custom behaviors. Names in this record match
// the behavior identifier (without leading `&`) declared in dax6.keymap.
export const customKeycodes: Record<string, ZmkCustomKeycode> = {
  esc_lang2_with_layer: { label: 'Esc', eventCode: 'Escape', testability: 'keyboard' },
}
