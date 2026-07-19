import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  _resetRecentKeycodesForTests,
  loadRecentKeycodes,
  pushRecentKeycode,
  RECENT_KEYCODES_LIMIT,
} from './recent-keycodes'

beforeEach(() => {
  _resetRecentKeycodesForTests()
})

afterEach(() => {
  _resetRecentKeycodesForTests()
})

describe('recent-keycodes', () => {
  it('starts empty', () => {
    expect(loadRecentKeycodes()).toEqual([])
  })

  it('pushes a single entry', () => {
    expect(pushRecentKeycode('A')).toEqual(['A'])
    expect(loadRecentKeycodes()).toEqual(['A'])
  })

  it('moves a duplicate to the front', () => {
    pushRecentKeycode('A')
    pushRecentKeycode('B')
    pushRecentKeycode('A')
    expect(loadRecentKeycodes()).toEqual(['A', 'B'])
  })

  it('caps the list at RECENT_KEYCODES_LIMIT', () => {
    for (let i = 0; i < RECENT_KEYCODES_LIMIT + 5; i++) {
      pushRecentKeycode(`K${i}`)
    }
    const list = loadRecentKeycodes()
    expect(list.length).toBe(RECENT_KEYCODES_LIMIT)
    // Most recent is at front.
    expect(list[0]).toBe(`K${RECENT_KEYCODES_LIMIT + 4}`)
  })

  it('ignores empty / whitespace tokens', () => {
    pushRecentKeycode('A')
    pushRecentKeycode('')
    pushRecentKeycode('   ')
    expect(loadRecentKeycodes()).toEqual(['A'])
  })

  it('survives malformed JSON in storage', () => {
    localStorage.setItem('dax6-editor-recent-keycodes', '{ not json')
    expect(loadRecentKeycodes()).toEqual([])
  })
})
