import type { BoardBranding } from '../types'

export const branding: BoardBranding = {
  title: 'dax6 Keyboard Tester',
  shortLabel: 'dax6',
  subtitle: (layerCount) => `dax6 · 44 keys · ${layerCount} layers`,
  encoderLabel: '2 rotary encoders',
  gestureLabel: 'trackball · stroke directions',
  testerHeaderLabel: (keyCount) => `dax6 · ${keyCount} keys · Auto-detect keyboard chatter`,
  pngFileName: 'dax6-layers.png',
  reloadGuardSymbolKey: 'dax6-keymap-reload-guard',
}
