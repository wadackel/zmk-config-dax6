import { describe, expect, it } from 'vitest'
import { formatBindingForCell, keycodeLabel, mainLineSizeClass } from './binding-display'

describe('keycodeLabel', () => {
  it('translates a known keycode token to its curated label', () => {
    expect(keycodeLabel('TAB')).toBe('Tab')
    expect(keycodeLabel('LCTRL')).toBe('L-Ctrl')
    expect(keycodeLabel('EXCL')).toBe('!')
    expect(keycodeLabel('TILDE')).toBe('~')
  })

  it('falls back to the raw token when unknown', () => {
    expect(keycodeLabel('FOOBAR')).toBe('FOOBAR')
  })

  it('annotates modifier wrappers with their glyph', () => {
    expect(keycodeLabel('LC(A)')).toBe('⌃A')
    expect(keycodeLabel('LS(LC(A))')).toBe('⌃⇧A')
    expect(keycodeLabel('LG(SPACE)')).toBe('⌘Space')
  })
})

describe('formatBindingForCell', () => {
  it('faint render for &trans / &none', () => {
    expect(formatBindingForCell({ tokens: ['&trans'] })).toEqual({
      topLine: '',
      mainLine: '&trans',
      faint: true,
    })
    expect(formatBindingForCell({ tokens: ['&none'] })).toEqual({
      topLine: '',
      mainLine: '&none',
      faint: true,
    })
  })

  it('&kp shows behaviour on top and the key label as main', () => {
    expect(formatBindingForCell({ tokens: ['&kp', 'TAB'] })).toEqual({
      topLine: '&kp',
      mainLine: 'Tab',
      faint: false,
    })
    expect(formatBindingForCell({ tokens: ['&kp', 'EXCL'] })).toMatchObject({
      topLine: '&kp',
      mainLine: '!',
    })
  })

  it('&mt shows the tap key as main and the hold modifier as sub', () => {
    expect(formatBindingForCell({ tokens: ['&mt', 'LSHIFT', 'SPACE'] })).toEqual({
      topLine: '&mt',
      mainLine: 'Space',
      subLine: 'L-Shift',
      faint: false,
    })
  })

  it('&lt shows the tap key as main and the layer index as sub', () => {
    expect(formatBindingForCell({ tokens: ['&lt', '3', 'ENTER'] })).toEqual({
      topLine: '&lt',
      mainLine: 'Enter',
      subLine: 'L3',
      faint: false,
    })
  })

  it('&mo / &to / &tog / &sl show layer index as main', () => {
    expect(formatBindingForCell({ tokens: ['&mo', '5'] })).toMatchObject({
      topLine: '&mo',
      mainLine: 'L5',
    })
    expect(formatBindingForCell({ tokens: ['&tog', '6'] })).toMatchObject({
      mainLine: 'L6',
    })
  })

  it('&bt formats BT_SEL / BT_CLR / BT_NXT / BT_PRV', () => {
    expect(formatBindingForCell({ tokens: ['&bt', 'BT_SEL', '0'] }).mainLine).toBe('BT 0')
    expect(formatBindingForCell({ tokens: ['&bt', 'BT_CLR'] }).mainLine).toBe('BT clr')
    expect(formatBindingForCell({ tokens: ['&bt', 'BT_NXT'] }).mainLine).toBe('BT ▶')
    expect(formatBindingForCell({ tokens: ['&bt', 'BT_PRV'] }).mainLine).toBe('BT ◀')
  })

  it('custom behaviour falls back to last-arg-as-main heuristic', () => {
    expect(
      formatBindingForCell({ tokens: ['&esc_lang2_with_layer', 'A', 'ESC'] }),
    ).toEqual({
      topLine: '&esc_lang2_with_layer',
      mainLine: 'Esc',
      subLine: 'A',
      faint: false,
    })
  })

  it('modifier-wrapped keycode shows compact glyph', () => {
    expect(formatBindingForCell({ tokens: ['&kp', 'LC(A)'] })).toMatchObject({
      topLine: '&kp',
      mainLine: '⌃A',
    })
  })
})

describe('mainLineSizeClass', () => {
  it('shrinks the size as label grows', () => {
    expect(mainLineSizeClass('A')).toBe('text-xl')
    expect(mainLineSizeClass('~')).toBe('text-xl')
    expect(mainLineSizeClass('Tab')).toBe('text-sm')
    expect(mainLineSizeClass('Enter')).toBe('text-[11px]')
    expect(mainLineSizeClass('BackSpace')).toBe('text-[10px] leading-tight')
  })
})
