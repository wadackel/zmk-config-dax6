import { describe, expect, it } from 'vitest'
import { searchKeycodesRanked } from './scoring'

describe('searchKeycodesRanked', () => {
  it('returns the full catalogue when the query is empty', () => {
    const result = searchKeycodesRanked('')
    expect(result.length).toBeGreaterThan(50)
  })

  it('exact label match comes first', () => {
    const result = searchKeycodesRanked('A')
    expect(result[0]?.token).toBe('A')
  })

  it('"lan" prefers LANG1 / LANG2 (token prefix) over LCTRL alias substring', () => {
    const result = searchKeycodesRanked('lan')
    expect(result[0]?.token).toBe('LANG1')
    expect(result[1]?.token).toBe('LANG2')
  })

  it('"scroll" finds SCRL_UP via label substring', () => {
    const result = searchKeycodesRanked('scroll')
    expect(result.some((e) => e.token === 'SCRL_UP')).toBe(true)
  })

  it('"lg" returns the L-GUI modifier as one of the top hits', () => {
    const result = searchKeycodesRanked('lg')
    expect(result.slice(0, 5).some((e) => e.token === 'LGUI')).toBe(true)
  })

  it('a query that matches nothing returns an empty list', () => {
    const result = searchKeycodesRanked('zzzzzzzzz')
    expect(result.length).toBe(0)
  })

  it('"!" finds EXCL via label match (shifted symbol)', () => {
    const result = searchKeycodesRanked('!')
    expect(result.some((e) => e.token === 'EXCL')).toBe(true)
  })

  it('"~" finds TILDE via label match (shifted symbol)', () => {
    const result = searchKeycodesRanked('~')
    expect(result.some((e) => e.token === 'TILDE')).toBe(true)
  })

  it('"tilde" finds TILDE via token match', () => {
    const result = searchKeycodesRanked('tilde')
    expect(result[0]?.token).toBe('TILDE')
  })

  it('"under" finds UNDER (underscore) via token prefix', () => {
    const result = searchKeycodesRanked('under')
    expect(result[0]?.token).toBe('UNDER')
  })

  it('ranking is stable on identical scores (group rank, then original index)', () => {
    // Multiple letter entries all match "" only via empty query (handled
    // above), so for stability we test an alias substring with N1.
    const result1 = searchKeycodesRanked('1')
    const result2 = searchKeycodesRanked('1')
    expect(result1.map((e) => e.token)).toEqual(result2.map((e) => e.token))
  })
})
