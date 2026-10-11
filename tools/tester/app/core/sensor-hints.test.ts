import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkScrlVal,
  checkTriggersPerRotation,
  describeEncoderRotation,
  extractScrlVal,
  scrollRotateTapMs,
  shieldSteps,
  shieldTriggersPerRotation,
} from './sensor-hints'
import { parseKeymap } from './keymap-dt/parse'
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

const rsr = (name: string, props: Record<string, string>): BehaviorEntry => ({
  name,
  compatible: 'zmk,behavior-runtime-sensor-rotate',
  props: [
    { name: '#sensor-binding-cells', value: '<0>' },
    ...Object.entries(props).map(([n, value]) => ({ name: n, value })),
  ],
})

const scroll = rsr('rsr_scroll', {
  'tap-ms': '<20>',
  'cw-binding': '<&msc SCRL_UP>',
  'ccw-binding': '<&msc SCRL_DOWN>',
})
const vol = rsr('rsr_vol', {
  'cw-binding': '<&kp C_VOL_DN>',
  'ccw-binding': '<&kp C_VOL_UP>',
})

describe('scrollRotateTapMs', () => {
  it('reports the declared tap-ms of an &msc rotate behavior', () => {
    expect(scrollRotateTapMs([scroll])).toEqual([
      { name: 'rsr_scroll', index: 0, tapMs: 20, isDefault: false, hint: { level: 'ok' } },
    ])
  })

  it('skips rotate behaviors that never reach &msc, keeping source indices', () => {
    expect(scrollRotateTapMs([vol, scroll]).map((r) => [r.name, r.index])).toEqual([
      ['rsr_scroll', 1],
    ])
  })

  it('counts a behavior that uses &msc in only one direction', () => {
    const mixed = rsr('rsr_mixed', {
      'cw-binding': '<&kp C_VOL_UP>',
      'ccw-binding': '<&msc SCRL_DOWN>',
    })
    expect(scrollRotateTapMs([mixed]).map((r) => r.name)).toEqual(['rsr_mixed'])
  })

  it('ignores other compatibles even when they carry the same props', () => {
    const other: BehaviorEntry = { ...scroll, compatible: 'zmk,behavior-sensor-rotate' }
    expect(scrollRotateTapMs([other])).toEqual([])
  })

  it('accepts 16 (the msc period floor) and flags 15, naming the behavior', () => {
    const at = (ms: number) =>
      scrollRotateTapMs([
        rsr('rsr_x', { 'tap-ms': `<${ms}>`, 'cw-binding': '<&msc SCRL_UP>' }),
      ])[0]!.hint
    expect(at(16).level).toBe('ok')
    expect(at(15).level).toBe('error')
    expect(at(15).message).toContain('rsr_x')
    expect(at(15).message).toContain('15ms')
  })

  it('treats a missing tap-ms as the binding default of 5 and flags it', () => {
    const [hit] = scrollRotateTapMs([
      rsr('rsr_unset', { 'cw-binding': '<&msc SCRL_UP>', 'ccw-binding': '<&msc SCRL_DOWN>' }),
    ])
    expect(hit).toMatchObject({ tapMs: 5, isDefault: true })
    expect(hit!.hint.level).toBe('error')
    expect(hit!.hint.message).toContain('rsr_unset')
    expect(hit!.hint.message).toContain('unset')
  })

  it('is silent when tap-ms is not a plain integer cell', () => {
    const [hit] = scrollRotateTapMs([
      rsr('rsr_macro', { 'tap-ms': '<TAP_MS>', 'cw-binding': '<&msc SCRL_UP>' }),
    ])
    expect(hit).toMatchObject({ tapMs: null, isDefault: false, hint: { level: 'ok' } })
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
  it('resolves cw/ccw from the referenced behavior node', () => {
    expect(describeEncoderRotation({ tokens: ['&rsr_scroll'] }, [vol, scroll])).toEqual({
      behavior: '&rsr_scroll',
      cw: { tokens: ['&msc', 'SCRL_UP'], label: 'Scroll↑' },
      ccw: { tokens: ['&msc', 'SCRL_DOWN'], label: 'Scroll↓' },
    })
  })

  it('resolves keycode args of &kp bindings', () => {
    const desc = describeEncoderRotation({ tokens: ['&rsr_vol'] }, [vol, scroll])
    expect(desc?.cw?.label).toBe('Vol-')
    expect(desc?.ccw?.label).toBe('Vol+')
  })

  it('falls back to the raw token when the keycode is unknown', () => {
    const odd = rsr('rsr_odd', { 'cw-binding': '<&kp UNKNOWN_A>', 'ccw-binding': '<&kp LC(LS(TAB))>' })
    const desc = describeEncoderRotation({ tokens: ['&rsr_odd'] }, [odd])
    expect(desc?.cw).toEqual({ tokens: ['&kp', 'UNKNOWN_A'], label: 'UNKNOWN_A' })
    expect(desc?.ccw).toEqual({ tokens: ['&kp', 'LC(LS(TAB))'], label: 'LC(LS(TAB))' })
  })

  it('labels an argument-less binding by its behavior', () => {
    const half = rsr('rsr_half', { 'cw-binding': '<&none>' })
    const desc = describeEncoderRotation({ tokens: ['&rsr_half'] }, [half])
    expect(desc?.cw).toEqual({ tokens: ['&none'], label: 'None' })
    expect(desc?.ccw).toBeNull()
  })

  it('returns null when the reference is not defined in the keymap', () => {
    expect(describeEncoderRotation({ tokens: ['&rsr_missing'] }, [scroll])).toBeNull()
  })

  it('returns null for behaviors of another compatible', () => {
    const holdTap: BehaviorEntry = { name: 'ht', compatible: 'zmk,behavior-hold-tap', props: [] }
    expect(describeEncoderRotation({ tokens: ['&ht'] }, [holdTap])).toBeNull()
  })

  it('returns null when the sensor binding carries arguments', () => {
    expect(describeEncoderRotation({ tokens: ['&rsr_scroll', 'SCRL_UP'] }, [scroll])).toBeNull()
  })
})

describe('against the keymap fixture', () => {
  const parsed = parseKeymap(
    readFileSync(path.resolve(__dirname, 'keymap-dt/__fixtures__/dax6.keymap'), 'utf8'),
  )
  const labels = (layerName: string) =>
    parsed.layers
      .find((l) => l.name === layerName)!
      .sensorBindings!.perEncoder.map((chain) => {
        const desc = describeEncoderRotation(chain, parsed.behaviors)
        return [desc?.behavior, desc?.cw?.label, desc?.ccw?.label]
      })

  it('describes every layer encoder', () => {
    for (const layer of parsed.layers) {
      for (const chain of layer.sensorBindings!.perEncoder) {
        const desc = describeEncoderRotation(chain, parsed.behaviors)
        expect(desc?.cw, `${layer.name} ${chain.tokens[0]}`).not.toBeNull()
        expect(desc?.ccw, `${layer.name} ${chain.tokens[0]}`).not.toBeNull()
      }
    }
  })

  it('resolves the scroll, horizontal scroll and media assignments', () => {
    expect(labels('default_layer')).toEqual([
      ['&rsr_scroll', 'Scroll↑', 'Scroll↓'],
      ['&rsr_scroll_rev', 'Scroll↓', 'Scroll↑'],
    ])
    expect(labels('Symbol')).toEqual([
      ['&rsr_hscroll', 'Scroll→', 'Scroll←'],
      ['&rsr_hscroll', 'Scroll→', 'Scroll←'],
    ])
    expect(labels('Num')).toEqual([
      ['&rsr_vol', 'Vol-', 'Vol+'],
      ['&rsr_bri', 'Brightness+', 'Brightness-'],
    ])
  })

  it('checks tap-ms on the three &msc behaviors only, all at 20ms', () => {
    expect(scrollRotateTapMs(parsed.behaviors).map((r) => [r.name, r.tapMs, r.hint.level])).toEqual([
      ['rsr_scroll', 20, 'ok'],
      ['rsr_scroll_rev', 20, 'ok'],
      ['rsr_hscroll', 20, 'ok'],
    ])
  })
})

describe('shield defaults', () => {
  it('exposes hardcoded steps and triggers-per-rotation matching dax6.dtsi', () => {
    expect(shieldSteps()).toBe(80)
    expect(shieldTriggersPerRotation()).toBe(40)
  })
})
