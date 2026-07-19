export type KeySide = 'left' | 'right'

export type KeyTestability =
  | 'keyboard'    // KeyboardEvent で検出
  | 'mouse'       // MouseEvent で検出
  | 'untestable'  // HID 出力なし

export interface KeyDef {
  index: number        // 0-45 の物理キーインデックス
  x: number            // dax6.json の x 座標
  y: number            // dax6.json の y 座標
  label: string        // 表示ラベル
  side: KeySide
  testability: KeyTestability
  eventCode?: string   // KeyboardEvent.code
  eventKey?: string    // KeyboardEvent.key (LANG1/LANG2 等のフォールバック)
  mouseButton?: number // MouseEvent.button
}

export interface EncoderDef {
  id: string
  label: string
  side: KeySide
}

// Data is generated at build/dev time from config/dax6.json + config/dax6.keymap
// by the zmkLayout Vite plugin via the virtual:zmk-layout module.
export { ENCODERS, KEYS, TESTABLE_KEY_COUNT } from 'virtual:zmk-layout'
