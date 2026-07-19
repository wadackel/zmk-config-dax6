import type { KeyDef } from './layout'
import { KEYS } from './layout'

const codeMap = new Map<string, KeyDef>()
const keyMap = new Map<string, KeyDef>()
const mouseMap = new Map<number, KeyDef>()

for (const key of KEYS) {
  if (key.eventCode) codeMap.set(key.eventCode, key)
  if (key.eventKey) keyMap.set(key.eventKey, key)
  if (key.mouseButton !== undefined) mouseMap.set(key.mouseButton, key)
}

export function resolveKeyboardEvent(e: KeyboardEvent): KeyDef | undefined {
  return codeMap.get(e.code) ?? keyMap.get(e.key)
}

export function resolveMouseEvent(e: MouseEvent): KeyDef | undefined {
  return mouseMap.get(e.button)
}
