import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectSections } from './sections'
import type { SectionKind } from './types'

const fixturePath = path.resolve(__dirname, '__fixtures__/dax6.keymap')
const fixture = readFileSync(fixturePath, 'utf8')

function countByKind(kind: SectionKind, sections: ReturnType<typeof detectSections>['sections']) {
  return sections.filter((s) => s.kind === kind).length
}

describe('detectSections', () => {
  it('finds all 9 layer blocks', () => {
    const { sections } = detectSections(fixture)
    const layers = sections.filter((s) => s.kind === 'layer')
    expect(layers.length).toBe(9)
    expect(layers.map((s) => s.name)).toEqual([
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

  it('finds the combos container and its 4 entries', () => {
    const { sections } = detectSections(fixture)
    expect(countByKind('combos-container', sections)).toBe(1)
    const entries = sections.filter((s) => s.kind === 'combo-entry')
    expect(entries.length).toBe(4)
    expect(entries.map((s) => s.name)).toEqual([
      'to_device',
      'kl_scroll',
      'to_device_left',
      'to_device_right',
    ])
  })

  it('finds the macros container and its 1 entry', () => {
    const { sections } = detectSections(fixture)
    expect(countByKind('macros-container', sections)).toBe(1)
    const entries = sections.filter((s) => s.kind === 'macro-entry')
    expect(entries.length).toBe(1)
    expect(entries[0].name).toBe('esc_lang2')
  })

  it('finds the behaviors container and its 2 entries', () => {
    const { sections } = detectSections(fixture)
    expect(countByKind('behaviors-container', sections)).toBe(1)
    const entries = sections.filter((s) => s.kind === 'behavior-entry')
    expect(entries.length).toBe(2)
    expect(entries.map((s) => s.name)).toEqual(['esc_lang2_with_layer', 'enc_scroll'])
  })

  it('finds &zip_mouse_gesture root block', () => {
    const { sections } = detectSections(fixture)
    const mg = sections.filter((s) => s.kind === 'mouse-gesture-root')
    expect(mg.length).toBe(1)
    expect(mg[0].name).toBe('zip_mouse_gesture')
  })

  it('finds the named zip_mouse_gesture_* blocks', () => {
    const { sections } = detectSections(fixture)
    const named = sections.filter((s) => s.kind === 'mouse-gesture-named')
    expect(named.map((s) => s.name)).toEqual([
      'zip_mouse_gesture_mac',
      'zip_mouse_gesture_android',
    ])
  })

  it('finds &mt and &lt root configs', () => {
    const { sections } = detectSections(fixture)
    expect(countByKind('root-mt', sections)).toBe(1)
    expect(countByKind('root-lt', sections)).toBe(1)
  })

  it('section ranges are well-formed (start < bodyStart < bodyEnd < end)', () => {
    const { sections } = detectSections(fixture)
    for (const s of sections) {
      expect(s.range[0]).toBeLessThan(s.headerRange[1])
      expect(s.headerRange[1]).toBeLessThanOrEqual(s.bodyRange[0])
      expect(s.bodyRange[0]).toBeLessThan(s.bodyRange[1])
      expect(s.bodyRange[1]).toBeLessThanOrEqual(s.range[1])
    }
  })

  it('section bodies do not include the wrapping braces', () => {
    const { sections } = detectSections(fixture)
    for (const s of sections) {
      const bodyText = fixture.slice(s.bodyRange[0], s.bodyRange[1])
      expect(bodyText.startsWith('{')).toBe(false)
      expect(bodyText.endsWith('}')).toBe(false)
    }
  })

  it('detects user-named layer blocks (no whitelist)', () => {
    // Add a layer with an arbitrary user name and assert the detector picks it
    // up alongside the fixture's predefined layers.
    const synthetic = fixture.replace(
      /MacGesture\s*\{/,
      'MyCustomLayer {\n            bindings = <>;\n        };\n\n        MacGesture {',
    )
    const { sections } = detectSections(synthetic)
    const names = sections.filter((s) => s.kind === 'layer').map((s) => s.name)
    expect(names).toContain('MyCustomLayer')
    expect(names).toContain('MacGesture')
  })
})
