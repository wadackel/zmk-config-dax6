declare module 'virtual:zmk-layout' {
  import type { EncoderDef, KeyDef } from './core/layout'
  export const KEYS: KeyDef[]
  export const ENCODERS: EncoderDef[]
  export const TESTABLE_KEY_COUNT: number
}
