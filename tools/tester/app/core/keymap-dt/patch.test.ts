import { describe, expect, it } from 'vitest'
import { applyEdits } from './patch'

describe('applyEdits', () => {
  it('returns source unchanged when edit list is empty', () => {
    expect(applyEdits('hello', [])).toBe('hello')
  })

  it('applies a single replacement', () => {
    expect(applyEdits('hello world', [{ range: [6, 11], replacement: 'there' }])).toBe(
      'hello there',
    )
  })

  it('applies multiple non-overlapping edits regardless of order in the input array', () => {
    const edits = [
      { range: [6, 11] as const, replacement: 'there' },
      { range: [0, 5] as const, replacement: 'howdy' },
    ]
    expect(applyEdits('hello world', edits)).toBe('howdy there')
  })

  it('supports insertion (zero-length range)', () => {
    expect(applyEdits('abc', [{ range: [1, 1], replacement: 'X' }])).toBe('aXbc')
  })

  it('throws on overlapping edits', () => {
    expect(() =>
      applyEdits('abcdef', [
        { range: [0, 3], replacement: 'X' },
        { range: [2, 5], replacement: 'Y' },
      ]),
    ).toThrow(/overlapping/i)
  })
})
