// Range-based text patcher.
//
// Given an original text and a list of edits (range + replacement), returns a
// new text with all edits applied. Edits MUST NOT overlap; the function throws
// on overlap so callers (the editor IO layer) catch logic bugs early. Insertion
// edits (range length 0) are supported.

import type { Range } from './types'

export type Edit = {
  range: Range
  replacement: string
}

export function applyEdits(source: string, edits: Edit[]): string {
  if (edits.length === 0) return source

  // Sort by start ascending.
  const sorted = [...edits].sort((a, b) => a.range[0] - b.range[0])

  // Check non-overlap.
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].range
    const curr = sorted[i].range
    if (curr[0] < prev[1]) {
      throw new Error(
        `applyEdits: overlapping edits at [${prev[0]}, ${prev[1]}) and [${curr[0]}, ${curr[1]})`,
      )
    }
  }

  // Stitch.
  const parts: string[] = []
  let cursor = 0
  for (const e of sorted) {
    parts.push(source.slice(cursor, e.range[0]))
    parts.push(e.replacement)
    cursor = e.range[1]
  }
  parts.push(source.slice(cursor))
  return parts.join('')
}
