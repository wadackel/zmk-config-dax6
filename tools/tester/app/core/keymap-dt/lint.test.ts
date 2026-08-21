import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lint } from './lint'

const fixturePath = path.resolve(__dirname, '__fixtures__/dax6.keymap')
const fixture = readFileSync(fixturePath, 'utf8')

describe('lint', () => {
  it('accepts the unmodified fixture', () => {
    const result = lint(fixture)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects a layer with the wrong binding count', () => {
    // Drop one binding from the default_layer body.
    const broken = fixture.replace(
      /default_layer\s*\{[\s\S]*?bindings\s*=\s*<[\s\S]*?>;/,
      `default_layer {
            bindings = <
&kp A   &kp Q   &kp W   &kp E   &kp R
            >;`,
    )
    const result = lint(broken)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.message.includes('expected 44'))).toBe(true)
  })

  it('rejects a combo with out-of-range key-positions', () => {
    const broken = fixture.replace('key-positions = <0 29>', 'key-positions = <0 99>')
    const result = lint(broken)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.message.includes('out of range'))).toBe(true)
  })

  it('rejects an unknown behaviour name in a binding', () => {
    // Swap a &kp on the default layer for &not_a_real_behavior.
    const broken = fixture.replace(/&kp A/, '&not_a_real_behavior A')
    const result = lint(broken)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.message.includes('unknown behaviour'))).toBe(true)
  })

  it('rejects wrong arity for a known behaviour', () => {
    // Turn default_layer's first key (&kp TAB) into a &kp with 0 args.
    const broken = fixture.replace('&kp TAB', '&kp')
    const result = lint(broken)
    // At least one arity error should surface.
    expect(result.errors.some((e) => e.message.includes('expects'))).toBe(true)
  })

  it('warns on combos with fewer than 2 key-positions', () => {
    const broken = fixture.replace('key-positions = <0 29>', 'key-positions = <0>')
    const result = lint(broken)
    expect(result.warnings.some((w) => w.message.includes('fewer than 2 key-positions'))).toBe(true)
  })

  it('rejects a binding that references a layer out of range', () => {
    // Fixture has 9 layers (0..8). Inject `&mo 99` in default_layer's first key.
    const broken = fixture.replace(/^&kp TAB/m, '&mo 99')
    const result = lint(broken)
    expect(result.ok).toBe(false)
    expect(
      result.errors.some(
        (e) => e.message.includes('references layer 99') || e.message.includes('layer 99'),
      ),
    ).toBe(true)
  })

  it('rejects a combo whose layers entry is out of range', () => {
    const broken = fixture.replace('layers = <0 1>;', 'layers = <99>;')
    const result = lint(broken)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.message.includes('reference 99'))).toBe(true)
  })

  it('rejects a mouse-gesture entry with an empty name (anonymous block)', () => {
    // Mirror what the tab produces when a user clears an entry name to empty:
    // `g_top { pattern = ...; bindings = ...; };` -> ` { pattern = ...; bindings = ...; };`
    const broken = fixture.replace(/g_top\s*\{/, ' {')
    const result = lint(broken)
    expect(result.ok).toBe(false)
    expect(
      result.errors.some((e) => e.message.includes('anonymous pattern entry')),
    ).toBe(true)
  })

  it('rejects an anonymous entry inside a named mouse-gesture block too', () => {
    const broken = fixture.replace(/mg_desktop\s*\{/, ' {')
    const result = lint(broken)
    expect(result.ok).toBe(false)
    expect(
      result.errors.some((e) => e.message.includes('anonymous pattern entry')),
    ).toBe(true)
  })

  it.each([
    ['&mouse_gesture'],
    ['&mouse_gesture_toggle'],
    ['&mouse_gesture_on'],
    ['&mouse_gesture_off'],
    ['&mouse_gesture_kp 200 A'],
    ['&mouse_gesture_mkp 200 MB1'],
  ])('accepts %s as a known behaviour', (chain) => {
    const source = fixture.replace(/^&kp TAB/m, chain)
    const result = lint(source)
    expect(result.errors.some((e) => e.message.includes('unknown behaviour'))).toBe(false)
  })
})
