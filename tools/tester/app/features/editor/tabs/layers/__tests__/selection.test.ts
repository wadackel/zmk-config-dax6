import { describe, expect, it } from 'vitest'
import {
  applyClickSelection,
  commonChain,
  hitTestCells,
  marqueeSelection,
  normalizeRect,
  rectsIntersect,
  resolvePasteEdits,
} from '../selection'
import type { Rect } from '../selection'

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({
  left,
  top,
  right,
  bottom,
})

describe('applyClickSelection', () => {
  it('plain click replaces the selection with the clicked key', () => {
    expect(applyClickSelection(new Set([1, 2]), 5, { shift: false, toggle: false })).toEqual(
      new Set([5]),
    )
  })

  it('plain click on an already-selected key collapses to just that key', () => {
    expect(applyClickSelection(new Set([1, 2]), 1, { shift: false, toggle: false })).toEqual(
      new Set([1]),
    )
  })

  it('toggle click adds an unselected key', () => {
    expect(applyClickSelection(new Set([1]), 2, { shift: false, toggle: true })).toEqual(
      new Set([1, 2]),
    )
  })

  it('toggle click removes a selected key', () => {
    expect(applyClickSelection(new Set([1, 2]), 2, { shift: false, toggle: true })).toEqual(
      new Set([1]),
    )
  })

  it('shift click adds and never removes', () => {
    expect(applyClickSelection(new Set([1]), 2, { shift: true, toggle: false })).toEqual(
      new Set([1, 2]),
    )
    expect(applyClickSelection(new Set([1, 2]), 2, { shift: true, toggle: false })).toEqual(
      new Set([1, 2]),
    )
  })

  it('does not mutate the previous set', () => {
    const prev = new Set([1])
    applyClickSelection(prev, 2, { shift: true, toggle: false })
    applyClickSelection(prev, 1, { shift: false, toggle: true })
    expect(prev).toEqual(new Set([1]))
  })
})

describe('normalizeRect', () => {
  it('orders coordinates regardless of drag direction', () => {
    expect(normalizeRect({ x: 10, y: 20 }, { x: 5, y: 3 })).toEqual(rect(5, 3, 10, 20))
    expect(normalizeRect({ x: 5, y: 3 }, { x: 10, y: 20 })).toEqual(rect(5, 3, 10, 20))
  })
})

describe('rectsIntersect', () => {
  it('detects overlap, edge touch, and separation', () => {
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(5, 5, 15, 15))).toBe(true)
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(10, 10, 20, 20))).toBe(true) // edge touch
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(11, 0, 20, 10))).toBe(false)
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(0, 11, 10, 20))).toBe(false)
  })

  it('handles containment', () => {
    expect(rectsIntersect(rect(0, 0, 100, 100), rect(10, 10, 20, 20))).toBe(true)
    expect(rectsIntersect(rect(10, 10, 20, 20), rect(0, 0, 100, 100))).toBe(true)
  })
})

describe('hitTestCells', () => {
  const cells = [
    { idx: 0, rect: rect(0, 0, 50, 50) },
    { idx: 1, rect: rect(60, 0, 110, 50) },
    { idx: 2, rect: rect(120, 0, 170, 50) },
  ]

  it('returns keys intersecting the marquee', () => {
    expect(hitTestCells(rect(40, 10, 130, 40), cells)).toEqual(new Set([0, 1, 2]))
    expect(hitTestCells(rect(55, 10, 115, 40), cells)).toEqual(new Set([1]))
    expect(hitTestCells(rect(200, 200, 300, 300), cells)).toEqual(new Set())
  })
})

describe('marqueeSelection', () => {
  it('replaces the base when not additive', () => {
    expect(marqueeSelection(new Set([9]), new Set([1, 2]), false)).toEqual(new Set([1, 2]))
  })

  it('unions base and hits when additive', () => {
    expect(marqueeSelection(new Set([9]), new Set([1, 2]), true)).toEqual(new Set([1, 2, 9]))
  })
})

describe('commonChain', () => {
  const bindings = [
    { tokens: ['&trans'] },
    { tokens: ['&trans'] },
    { tokens: ['&kp', 'A'] },
    { tokens: ['&kp', 'A'] },
  ]

  it('returns the shared chain when every selected key matches', () => {
    expect(commonChain(bindings, new Set([0, 1]))).toEqual({ tokens: ['&trans'] })
    expect(commonChain(bindings, new Set([2, 3]))).toEqual({ tokens: ['&kp', 'A'] })
  })

  it('returns null for a heterogeneous selection', () => {
    expect(commonChain(bindings, new Set([1, 2]))).toBeNull()
  })

  it('returns null for empty selection or missing binding', () => {
    expect(commonChain(bindings, new Set())).toBeNull()
    expect(commonChain(bindings, new Set([99]))).toBeNull()
  })

  it('distinguishes chains that share a prefix', () => {
    const b = [{ tokens: ['&kp', 'A'] }, { tokens: ['&kp'] }]
    expect(commonChain(b, new Set([0, 1]))).toBeNull()
  })
})

describe('resolvePasteEdits', () => {
  const single = { entries: [{ keyIdx: 3, chain: { tokens: ['&kp', 'A'] } }] }
  const multi = {
    entries: [
      { keyIdx: 3, chain: { tokens: ['&kp', 'A'] } },
      { keyIdx: 7, chain: { tokens: ['&trans'] } },
    ],
  }

  it('broadcasts a single entry to the whole selection', () => {
    const edits = resolvePasteEdits(single, new Set([1, 2]), null)
    expect(edits).toEqual([
      { keyIdx: 1, chain: { tokens: ['&kp', 'A'] } },
      { keyIdx: 2, chain: { tokens: ['&kp', 'A'] } },
    ])
  })

  it('falls back to the hovered key when the selection is empty', () => {
    expect(resolvePasteEdits(single, new Set(), 9)).toEqual([
      { keyIdx: 9, chain: { tokens: ['&kp', 'A'] } },
    ])
  })

  it('returns null when a single entry has no target', () => {
    expect(resolvePasteEdits(single, new Set(), null)).toBeNull()
  })

  it('pastes multiple entries positionally, ignoring the selection', () => {
    const edits = resolvePasteEdits(multi, new Set([1]), 9)
    expect(edits).toEqual([
      { keyIdx: 3, chain: { tokens: ['&kp', 'A'] } },
      { keyIdx: 7, chain: { tokens: ['&trans'] } },
    ])
  })

  it('returns null for empty clipboard', () => {
    expect(resolvePasteEdits(null, new Set([1]), null)).toBeNull()
    expect(resolvePasteEdits({ entries: [] }, new Set([1]), null)).toBeNull()
  })

  it('returns fresh token arrays (no aliasing back to the clipboard)', () => {
    const edits = resolvePasteEdits(single, new Set([1]), null)!
    edits[0].chain.tokens.push('X')
    expect(single.entries[0].chain.tokens).toEqual(['&kp', 'A'])
  })
})
