import { describe, expect, it } from 'vitest'
import { btOptionToTokens, btTokensToOption } from '../bt-special-form'

describe('BT special form roundtrip', () => {
  it('BT_SEL 1 → tokens and back', () => {
    expect(btOptionToTokens('BT_SEL_1')).toEqual(['&bt', 'BT_SEL', '1'])
    expect(btTokensToOption(['&bt', 'BT_SEL', '1'])).toBe('BT_SEL_1')
  })

  it('BT_NXT has no extra arg', () => {
    expect(btOptionToTokens('BT_NXT')).toEqual(['&bt', 'BT_NXT'])
    expect(btTokensToOption(['&bt', 'BT_NXT'])).toBe('BT_NXT')
  })

  it('BT_CLR has no extra arg', () => {
    expect(btOptionToTokens('BT_CLR')).toEqual(['&bt', 'BT_CLR'])
    expect(btTokensToOption(['&bt', 'BT_CLR'])).toBe('BT_CLR')
  })

  it('unknown / empty tokens fall back to BT_SEL_0', () => {
    expect(btTokensToOption(['&bt'])).toBe('BT_SEL_0')
    expect(btTokensToOption([])).toBe('BT_SEL_0')
  })

  it('every BT_SEL N value roundtrips', () => {
    const values = ['BT_SEL_0', 'BT_SEL_1', 'BT_SEL_2', 'BT_SEL_3', 'BT_SEL_4'] as const
    values.forEach((v, n) => {
      expect(btOptionToTokens(v)).toEqual(['&bt', 'BT_SEL', String(n)])
      expect(btTokensToOption(['&bt', 'BT_SEL', String(n)])).toBe(v)
    })
  })
})
