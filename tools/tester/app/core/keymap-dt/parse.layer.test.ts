import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseKeymap } from './parse'

const fixturePath = path.resolve(__dirname, '__fixtures__/dax6.keymap')
const fixture = readFileSync(fixturePath, 'utf8')

describe('parseKeymap — layers', () => {
  const parsed = parseKeymap(fixture)

  it('extracts all 9 layers', () => {
    expect(parsed.layers.map((l) => l.name)).toEqual([
      'default_layer',
      'Android',
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

  it('sensor-bindings are argument-less references to rotate behaviors', () => {
    const perEncoder = (name: string) =>
      parsed.layers.find((l) => l.name === name)!.sensorBindings!.perEncoder.map((c) => c.tokens)
    expect(perEncoder('default_layer')).toEqual([['&rsr_scroll'], ['&rsr_scroll_rev']])
    expect(perEncoder('Symbol')).toEqual([['&rsr_hscroll'], ['&rsr_hscroll']])
    expect(perEncoder('Num')).toEqual([['&rsr_vol'], ['&rsr_bri']])
  })
})
