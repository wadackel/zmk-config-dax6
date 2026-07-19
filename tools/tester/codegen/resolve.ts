import { BEHAVIOR_TESTABILITY, CUSTOM_BEHAVIORS, LANG_KEYS, ZMK_KEYCODES } from './zmk-keycodes'

export interface ParsedBinding {
  behavior: string
  args: string[]
}

// Structural copies of KeyDef / EncoderDef from app/lib/layout.ts
// Defined here to avoid importing from layout.ts which re-exports from virtual:zmk-layout
interface PlainKeyDef {
  index: number
  x: number
  y: number
  label: string
  side: 'left' | 'right'
  testability: 'keyboard' | 'mouse' | 'untestable'
  eventCode?: string
  eventKey?: string
  mouseButton?: number
}

interface PlainEncoderDef {
  id: string
  label: string
  side: 'left' | 'right'
}

interface PhysicalKey {
  x: number
  y: number
}

function side(x: number): 'left' | 'right' {
  return x < 8 ? 'left' : 'right'
}

function untestable(index: number, phys: PhysicalKey, label: string): PlainKeyDef {
  return { index, x: phys.x, y: phys.y, label, side: side(phys.x), testability: 'untestable' }
}

function resolveBinding(binding: ParsedBinding, phys: PhysicalKey, index: number): PlainKeyDef {
  const { behavior, args } = binding
  const keySide = side(phys.x)
  const base = { index, x: phys.x, y: phys.y, side: keySide }

  switch (behavior) {
    case 'kp': {
      const mapping = ZMK_KEYCODES[args[0]]
      if (!mapping) return untestable(index, phys, args[0] ?? behavior)
      return { ...base, ...mapping }
    }

    case 'lt': {
      // hold: layer switch, tap: key
      const tapKey = args[1]
      const mapping = ZMK_KEYCODES[tapKey]
      if (!mapping) return untestable(index, phys, tapKey ?? behavior)
      return { ...base, ...mapping }
    }

    case 'mt': {
      // hold: modifier, tap: key
      const [holdKey, tapKey] = args
      // LANG keys as tap: use hold key as primary, LANG key name as eventKey fallback
      // This matches macOS behavior where holding sends MetaLeft, tap sends Lang*
      if (LANG_KEYS.has(tapKey)) {
        const holdMapping = ZMK_KEYCODES[holdKey]
        if (holdMapping) {
          // Capitalize first letter of tap key name (LANG2 → 'Lang2')
          const eventKey = tapKey.charAt(0) + tapKey.slice(1).toLowerCase()
          return {
            ...base,
            label: holdMapping.label,
            eventCode: holdMapping.eventCode,
            eventKey,
            testability: 'keyboard',
          }
        }
      }
      // Normal tap key: use tap key mapping
      const tapMapping = ZMK_KEYCODES[tapKey]
      if (!tapMapping) return untestable(index, phys, tapKey ?? behavior)
      return { ...base, ...tapMapping }
    }

    case 'mkp': {
      const mapping = ZMK_KEYCODES[args[0]]
      if (!mapping) return untestable(index, phys, args[0] ?? behavior)
      return { ...base, ...mapping }
    }

    case 'mo': {
      return untestable(index, phys, `mo(${args[0]})`)
    }

    case 'bootloader': {
      return untestable(index, phys, 'BOOT')
    }

    default: {
      const custom = CUSTOM_BEHAVIORS[behavior]
      if (custom) return { ...base, ...custom }
      // Unknown behavior: mark untestable
      const testability = BEHAVIOR_TESTABILITY[behavior] ?? 'untestable'
      return { ...base, label: behavior, testability }
    }
  }
}

export function resolveKeys(physicalLayout: PhysicalKey[], bindings: ParsedBinding[]): PlainKeyDef[] {
  if (physicalLayout.length !== bindings.length) {
    throw new Error(
      `Physical layout has ${physicalLayout.length} keys but found ${bindings.length} bindings`,
    )
  }
  return physicalLayout.map((phys, index) => resolveBinding(bindings[index], phys, index))
}

export function resolveEncoders(sensors: Array<{ ref: string }>): PlainEncoderDef[] {
  return sensors.map(sensor => {
    const isLeft = sensor.ref.includes('left')
    return {
      id: isLeft ? 'left' : 'right',
      label: isLeft ? 'Left Encoder' : 'Right Encoder',
      side: (isLeft ? 'left' : 'right') as 'left' | 'right',
    }
  })
}
