import { KEYS, TESTABLE_KEY_COUNT } from './layout'

export type KeyStatus = 'untested' | 'pressed' | 'tested' | 'chattering'

export interface KeyState {
  status: KeyStatus
  pressCount: number
  chatterCount: number
  lastKeydownTime: number
  lastKeyupTime: number
  isPressed: boolean
}

export interface EventLogEntry {
  id: number
  timestamp: number
  type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup'
  label: string
  isChattering: boolean
}

export interface TestState {
  keys: Map<number, KeyState>
  eventLog: EventLogEntry[]
  testedCount: number
  lastKeyIndex: number | null
  logIdCounter: number
}

export function createInitialState(): TestState {
  const keys = new Map<number, KeyState>()
  for (const key of KEYS) {
    keys.set(key.index, {
      status: 'untested',
      pressCount: 0,
      chatterCount: 0,
      lastKeydownTime: 0,
      lastKeyupTime: 0,
      isPressed: false,
    })
  }

  return {
    keys,
    eventLog: [],
    testedCount: 0,
    lastKeyIndex: null,
    logIdCounter: 0,
  }
}

export function getProgress(state: TestState): { tested: number; total: number; percent: number } {
  const total = TESTABLE_KEY_COUNT
  const tested = state.testedCount
  const percent = total === 0 ? 100 : Math.round((tested / total) * 100)
  return { tested, total, percent }
}
