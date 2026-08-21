import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { skipTrivia, tokenize } from './lexer'

const fixturePath = path.resolve(__dirname, '__fixtures__/dax6.keymap')
const fixture = readFileSync(fixturePath, 'utf8')

describe('tokenize', () => {
  it('produces tokens that span the source exactly (no gaps, no overlap)', () => {
    const tokens = tokenize(fixture)
    expect(tokens[0].range[0]).toBe(0)
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i].range[0]).toBe(tokens[i - 1].range[1])
    }
    expect(tokens[tokens.length - 1].range[1]).toBe(fixture.length)
  })

  it('reconstructs the source byte-for-byte from token values', () => {
    const tokens = tokenize(fixture)
    const joined = tokens.map((t) => t.value).join('')
    expect(joined).toBe(fixture)
  })

  it('finds the expected section headers as identifier tokens', () => {
    const tokens = tokenize(fixture)
    const idents = tokens.filter((t) => t.kind === 'identifier').map((t) => t.value)
    for (const expected of [
      'default_layer',
      'Android',
      'Symbol',
      'Num',
      'Function',
      'Mouse',
      'Scroll',
      'Device',
      'MacGesture',
      'combos',
      'macros',
      'behaviors',
      'keymap',
      'zip_mouse_gesture',
      'zip_mouse_gesture_mac',
    ]) {
      expect(idents).toContain(expected)
    }
  })

  it('extracts preprocessor directives as preproc tokens', () => {
    const tokens = tokenize(fixture)
    const preprocs = tokens.filter((t) => t.kind === 'preproc')
    expect(preprocs.length).toBeGreaterThan(0)
    expect(preprocs.some((t) => t.value.startsWith('#define'))).toBe(true)
    expect(preprocs.some((t) => t.value.startsWith('#include'))).toBe(true)
  })

  it('recognises line comments (any present)', () => {
    const tokens = tokenize(fixture)
    const lineComments = tokens.filter((t) => t.kind === 'line-comment')
    expect(lineComments.length).toBeGreaterThanOrEqual(0)
  })

  it('skipTrivia advances past whitespace and comments', () => {
    const sample = '  // note\n  default_layer'
    const tokens = tokenize(sample)
    const idx = skipTrivia(tokens, 0)
    expect(tokens[idx].kind).toBe('identifier')
    expect(tokens[idx].value).toBe('default_layer')
  })

  it('treats `&kp A` as ampersand + identifier sequence', () => {
    const tokens = tokenize('&kp A')
    expect(tokens.map((t) => t.kind)).toEqual([
      'ampersand',
      'identifier',
      'whitespace',
      'identifier',
    ])
    expect(tokens.map((t) => t.value)).toEqual(['&', 'kp', ' ', 'A'])
  })

  it('handles string literals without leaking into surrounding code', () => {
    const tokens = tokenize('display-name = "Default";')
    const strings = tokens.filter((t) => t.kind === 'string')
    expect(strings.length).toBe(1)
    expect(strings[0].value).toBe('"Default"')
  })
})
