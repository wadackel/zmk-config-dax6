import { describe, expect, it } from 'vitest'
import {
  applyModifiersOrdered,
  unwrapAllModifiers,
  type ModifierWrap,
} from '../../../../../core/picker'

describe('modifier helpers used by ModifierToggles', () => {
  it('applyModifiersOrdered wraps in canonical order regardless of input order', () => {
    const a: ModifierWrap[] = ['LG', 'LC']
    const b: ModifierWrap[] = ['LC', 'LG']
    expect(applyModifiersOrdered('A', a)).toBe('LG(LC(A))')
    expect(applyModifiersOrdered('A', b)).toBe('LG(LC(A))')
  })

  it('applyModifiersOrdered with no wraps is identity', () => {
    expect(applyModifiersOrdered('A', [])).toBe('A')
  })

  it('applyModifiersOrdered handles all four left modifiers stably', () => {
    const all: ModifierWrap[] = ['LC', 'LS', 'LA', 'LG']
    expect(applyModifiersOrdered('P', all)).toBe('LG(LA(LS(LC(P))))')
  })

  it('unwrapAllModifiers is symmetric with applyModifiersOrdered', () => {
    const input: ModifierWrap[] = ['LG', 'LS']
    const wrapped = applyModifiersOrdered('P', input)
    const unwrapped = unwrapAllModifiers(wrapped)
    expect(unwrapped.inner).toBe('P')
    expect([...unwrapped.wraps].sort()).toEqual(['LG', 'LS'])
  })

  it('unwrapAllModifiers on a bare token returns the same token with empty set', () => {
    const { inner, wraps } = unwrapAllModifiers('A')
    expect(inner).toBe('A')
    expect(wraps.size).toBe(0)
  })
})
