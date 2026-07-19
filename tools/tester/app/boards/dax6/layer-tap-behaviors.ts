// Behaviors that take a layer index as arg0 and a keycode as arg1 (hold-tap
// pattern). dax6 adds `&esc_lang2_with_layer` on top of the ZMK builtin `&lt`.
export const layerTapBehaviors: ReadonlySet<string> = new Set([
  '&lt',
  '&esc_lang2_with_layer',
])
