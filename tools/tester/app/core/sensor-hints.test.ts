import { describe, expect, it } from 'vitest'
import {
  checkScrlVal,
  checkTapMs,
  checkTriggersPerRotation,
  describeEncoderRotation,
  extractScrlVal,
  getEncScrollTapMs,
  shieldSteps,
  shieldTriggersPerRotation,
} from './sensor-hints'
import type { BehaviorEntry } from './keymap-dt/types'

describe('extractScrlVal', () => {
  it('extracts the numeric value from a leading #define', () => {
    const src = '#define ZMK_POINTING_DEFAULT_SCRL_VAL 120\n#include <foo.h>\n'
    expect(extractScrlVal(src)).toBe(120)
  })

  it('tolerates extra whitespace and non-leading position', () => {
    const src = '// header\n   #define   ZMK_POINTING_DEFAULT_SCRL_VAL    75\n'
    expect(extractScrlVal(src)).toBe(75)
  })

  it('returns null when the define is missing', () => {
    expect(extractScrlVal('#include <foo.h>\n')).toBeNull()
  })
})

describe('getEncScrollTapMs', () => {
  const enc: BehaviorEntry = {
    name: 'enc_scroll',
    compatible: '"zmk,behavior-sensor-rotate-var"',
    props: [
      { name: '#sensor-binding-cells', value: '<2>' },
      { name: 'tap-ms', value: '<20>' },
    ],
  }

  it('reads the numeric value from tap-ms prop', () => {
    expect(getEncScrollTapMs([enc])).toBe(20)
  })

  it('returns null when enc_scroll is absent', () => {
    expect(getEncScrollTapMs([])).toBeNull()
  })

  it('returns null when tap-ms prop is missing', () => {
    const without = { ...enc, props: enc.props.filter((p) => p.name !== 'tap-ms') }
    expect(getEncScrollTapMs([without])).toBeNull()
  })
})

describe('checkTapMs', () => {
  it('flags values below 16 as error', () => {
    expect(checkTapMs(15).level).toBe('error')
  })

  it('accepts 16 (the msc period floor)', () => {
    expect(checkTapMs(16).level).toBe('ok')
  })

  it('is silent when the value is unknown', () => {
    expect(checkTapMs(null).level).toBe('ok')
  })
})

describe('checkScrlVal', () => {
  it('flags values below 60 as error (macOS may drop entirely)', () => {
    expect(checkScrlVal(59).level).toBe('error')
  })

  it('warns between 60 and 119 as sub-optimal for macOS', () => {
    expect(checkScrlVal(60).level).toBe('warn')
    expect(checkScrlVal(119).level).toBe('warn')
  })

  it('accepts 120 and above', () => {
    expect(checkScrlVal(120).level).toBe('ok')
    expect(checkScrlVal(200).level).toBe('ok')
  })

  it('is silent when the value is unknown', () => {
    expect(checkScrlVal(null).level).toBe('ok')
  })
})

describe('checkTriggersPerRotation', () => {
  it('accepts integer divisors of steps', () => {
    expect(checkTriggersPerRotation(40, 80).level).toBe('ok')
    expect(checkTriggersPerRotation(20, 80).level).toBe('ok')
    expect(checkTriggersPerRotation(80, 80).level).toBe('ok')
  })

  it('warns on non-integer divisors', () => {
    expect(checkTriggersPerRotation(24, 80).level).toBe('warn')
  })
})

describe('describeEncoderRotation', () => {
  it('resolves msc-action args to their display labels', () => {
    const desc = describeEncoderRotation({ tokens: ['&enc_scroll', 'SCRL_UP', 'SCRL_DOWN'] })
    expect(desc?.behavior).toBe('&enc_scroll')
    expect(desc?.ccw).toBe('Scroll↑')
    expect(desc?.cw).toBe('Scroll↓')
  })

  it('resolves keycode args for &inc_dec_kp', () => {
    const desc = describeEncoderRotation({ tokens: ['&inc_dec_kp', 'C_VOL_DN', 'C_VOL_UP'] })
    expect(desc?.ccw).toBe('Vol-')
    expect(desc?.cw).toBe('Vol+')
  })

  it('falls back to raw token when the keycode is unknown', () => {
    const desc = describeEncoderRotation({ tokens: ['&enc_scroll', 'UNKNOWN_A', 'UNKNOWN_B'] })
    expect(desc?.ccw).toBe('UNKNOWN_A')
    expect(desc?.cw).toBe('UNKNOWN_B')
  })

  it('returns null for unregistered behaviours', () => {
    const desc = describeEncoderRotation({ tokens: ['&nonexistent', 'A', 'B'] })
    expect(desc).toBeNull()
  })

  it('returns null when arity is not two', () => {
    const desc = describeEncoderRotation({ tokens: ['&enc_scroll', 'SCRL_UP'] })
    expect(desc).toBeNull()
  })
})

describe('shield defaults', () => {
  it('exposes hardcoded steps and triggers-per-rotation matching dax6.dtsi', () => {
    expect(shieldSteps()).toBe(80)
    expect(shieldTriggersPerRotation()).toBe(40)
  })
})
