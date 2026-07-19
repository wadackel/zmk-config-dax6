import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseKeymap } from './parse'

const fixturePath = path.resolve(__dirname, '__fixtures__/dax6.keymap')
const fixture = readFileSync(fixturePath, 'utf8')

describe('parseKeymap — layers', () => {
  const parsed = parseKeymap(fixture)

  it('extracts all 8 layers', () => {
    expect(parsed.layers.map((l) => l.name)).toEqual([
      'default_layer',
      'Symbol',
      'Num',
      'Function',
      'Mouse',
      'Scroll',
      'Device',
      'MacGesture',
    ])
  })

  it('every layer has exactly 44 bindings', () => {
    for (const l of parsed.layers) {
      expect(l.bindings.length).toBe(44)
    }
  })

  it('default_layer[0] is &kp TAB and default_layer[1] is &kp Q', () => {
    const dl = parsed.layers[0]
    expect(dl.bindings[0].tokens).toEqual(['&kp', 'TAB'])
    expect(dl.bindings[1].tokens).toEqual(['&kp', 'Q'])
  })

  it('every layer carries sensor-bindings with 2 encoders', () => {
    for (const l of parsed.layers) {
      expect(l.sensorBindings).not.toBeNull()
      expect(l.sensorBindings!.perEncoder.length).toBe(2)
    }
  })

  it('Symbol layer sensor-bindings use enc_scroll with SCRL_RIGHT/SCRL_LEFT', () => {
    const symbol = parsed.layers.find((l) => l.name === 'Symbol')!
    expect(symbol.sensorBindings!.perEncoder[0].tokens).toEqual([
      '&enc_scroll',
      'SCRL_RIGHT',
      'SCRL_LEFT',
    ])
  })

  it('Num layer sensor-bindings use inc_dec_kp (not enc_scroll)', () => {
    const num = parsed.layers.find((l) => l.name === 'Num')!
    expect(num.sensorBindings!.perEncoder[0].tokens[0]).toBe('&inc_dec_kp')
  })
})
