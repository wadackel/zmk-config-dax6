import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseKeymap } from './parse'

const fixturePath = path.resolve(__dirname, '__fixtures__/dax6.keymap')
const fixture = readFileSync(fixturePath, 'utf8')

describe('parseKeymap — combos / macros / behaviors / mouse-gesture / root', () => {
  const parsed = parseKeymap(fixture)

  it('extracts every combo entry with key-positions and layers', () => {
    expect(parsed.combos.map((c) => c.name)).toEqual([
      'to_device',
      'kl_scroll',
      'to_device_left',
      'to_device_right',
    ])
    const toDevice = parsed.combos[0]
    expect(toDevice.bindings.tokens).toEqual(['&mo', '7'])
    expect(toDevice.keyPositions).toEqual([0, 29])
    expect(toDevice.layers).toEqual([0, 1])
  })

  it('extracts the esc_lang2 macro with bindings list', () => {
    expect(parsed.macros.map((m) => m.name)).toEqual(['esc_lang2'])
    const macro = parsed.macros[0]
    expect(macro.bindingsList.length).toBe(2)
    expect(macro.bindingsList[0].tokens).toEqual(['&macro_tap'])
    expect(macro.bindingsList[1].tokens).toEqual(['&kp', 'ESCAPE', '&kp', 'LANG2'])
  })

  it('extracts every custom behavior', () => {
    expect(parsed.behaviors.map((b) => b.name)).toEqual([
      'esc_lang2_with_layer',
      'rsr_scroll',
      'rsr_scroll_rev',
      'rsr_hscroll',
      'rsr_vol',
      'rsr_bri',
    ])
    const escLang = parsed.behaviors[0]
    expect(escLang.compatible).toBe('zmk,behavior-hold-tap')
    expect(escLang.bindings?.length).toBe(2)
    expect(escLang.bindings?.[0].tokens).toEqual(['&mo'])
    expect(escLang.bindings?.[1].tokens).toEqual(['&esc_lang2'])
    expect(escLang.props.some((p) => p.name === 'tapping-term-ms' && p.value === '<160>')).toBe(true)
  })

  it('keeps runtime-sensor-rotate rotation bindings as scalar props', () => {
    const scroll = parsed.behaviors.find((b) => b.name === 'rsr_scroll')!
    expect(scroll.compatible).toBe('zmk,behavior-runtime-sensor-rotate')
    expect(scroll.bindings).toBeUndefined()
    expect(scroll.props).toEqual([
      { name: '#sensor-binding-cells', value: '<0>' },
      { name: 'tap-ms', value: '<20>' },
      { name: 'cw-binding', value: '<&msc SCRL_UP>' },
      { name: 'ccw-binding', value: '<&msc SCRL_DOWN>' },
    ])
  })

  it('extracts &zip_mouse_gesture root block with its 4 patterns', () => {
    const root = parsed.mouseGestures.find((g) => g.kind === 'root')!
    expect(root.name).toBe('zip_mouse_gesture')
    expect(root.entries.map((e) => e.name)).toEqual(['g_back', 'g_fwd', 'g_top', 'g_bottom'])
    expect(root.entries.map((e) => e.pattern)).toEqual(['LEFT', 'RIGHT', 'UP', 'DOWN'])
    expect(root.entries[0].bindings.tokens).toEqual(['&kp', 'LG(LEFT_BRACKET)'])
    // Block-level props.
    expect(root.props.some((p) => p.name === 'stroke-size' && p.value === '<300>')).toBe(true)
    expect(root.props.some((p) => p.name === 'enable-eager-mode' && p.value === '')).toBe(true)
    // Block-level props must NOT include the nested pattern entries (g_back, …).
    for (const entryName of ['g_back', 'g_fwd', 'g_top', 'g_bottom']) {
      expect(root.props.some((p) => p.name === entryName)).toBe(false)
    }
  })

  it('extracts the named zip_mouse_gesture_mac with its 4 patterns', () => {
    const named = parsed.mouseGestures.find((g) => g.kind === 'named')!
    expect(named.name).toBe('zip_mouse_gesture_mac')
    expect(named.entries.map((e) => e.name)).toEqual([
      'mg_desktop',
      'mg_mission_control',
      'mg_app_expose',
      'mg_spotlight',
    ])
    expect(named.props.some((p) => p.name === 'always-active' && p.value === '')).toBe(true)
  })

  it('extracts &mt and &lt root configs', () => {
    const mt = parsed.rootBehaviors.find((b) => b.kind === 'mt')!
    expect(mt.props.some((p) => p.name === 'flavor' && p.value === '"balanced"')).toBe(true)
    const lt = parsed.rootBehaviors.find((b) => b.kind === 'lt')!
    expect(lt.props.some((p) => p.name === 'tapping-term-ms' && p.value === '<160>')).toBe(true)
  })
})
