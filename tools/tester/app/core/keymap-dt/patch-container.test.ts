import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { EditorDraft } from '../editor-state/types'
import { parseKeymap } from './parse'
import { buildCandidateText } from './patch-container'

const fixture = readFileSync(
  path.resolve(__dirname, '__fixtures__/dax6.keymap'),
  'utf8',
)

function draftFromParsed(source: string): EditorDraft {
  const p = parseKeymap(source)
  return {
    layers: p.layers,
    combos: p.combos,
    macros: p.macros,
    behaviors: p.behaviors,
    mouseGestures: p.mouseGestures,
    rootBehaviors: p.rootBehaviors,
  }
}

describe('buildCandidateText', () => {
  it('is a fixed point on the fixture (identity round-trip)', () => {
    // The first save normalises whitespace; running it again should produce
    // the same bytes. Round-trip robustness is guarded here on top of the
    // serializer-level fixture test in serialize.test.ts.
    const first = buildCandidateText(fixture, draftFromParsed(fixture))
    const second = buildCandidateText(first, draftFromParsed(first))
    expect(second).toBe(first)
  })

  it('add layer: the new layer name appears at the tail of the keymap container', () => {
    const draft = draftFromParsed(fixture)
    // Clone the last layer under a new name so it stays valid (44 bindings).
    const template = draft.layers[draft.layers.length - 1]
    const added = { ...template, name: 'appended_layer' }
    draft.layers = [...draft.layers, added]
    const out = buildCandidateText(fixture, draft)
    expect(out).toContain('appended_layer {')
    // Idempotent under the same draft.
    const twice = buildCandidateText(out, draft)
    expect(twice).toBe(out)
  })

  it('remove combo: the combo entry disappears from the combos block', () => {
    const draft = draftFromParsed(fixture)
    expect(draft.combos.length).toBeGreaterThan(0)
    const removed = draft.combos[0]
    draft.combos = draft.combos.slice(1)
    const out = buildCandidateText(fixture, draft)
    // Header line for the removed combo must be gone.
    expect(out).not.toContain(`${removed.name} {`)
    // The remaining combos should still parse round-trip.
    const reparsed = parseKeymap(out)
    expect(reparsed.combos.map((c) => c.name)).toEqual(draft.combos.map((c) => c.name))
  })

  it('rename macro: rewrites the entry header, keeps other content intact', () => {
    const draft = draftFromParsed(fixture)
    expect(draft.macros.length).toBeGreaterThan(0)
    const original = draft.macros[0]
    const renamed = { ...original, name: `${original.name}_renamed` }
    draft.macros = [renamed, ...draft.macros.slice(1)]
    const out = buildCandidateText(fixture, draft)
    expect(out).toContain(`${original.name}_renamed:`)
    // The new name round-trips through parse.
    const reparsed = parseKeymap(out)
    expect(reparsed.macros[0].name).toBe(`${original.name}_renamed`)
  })

  it('add mouse-gesture entry: entry is emitted inside the block body', () => {
    const draft = draftFromParsed(fixture)
    const rootBlock = draft.mouseGestures.find((b) => b.kind === 'root')
    expect(rootBlock).toBeDefined()
    if (!rootBlock) return
    // Append a new gesture entry to the root block.
    const entryName = 'stroke_added'
    const withAdded = {
      ...rootBlock,
      entries: [
        ...rootBlock.entries,
        {
          name: entryName,
          pattern: 'UP' as const,
          bindings: { tokens: ['&kp', 'A'] },
        },
      ],
    }
    draft.mouseGestures = draft.mouseGestures.map((b) => (b === rootBlock ? withAdded : b))
    const out = buildCandidateText(fixture, draft)
    expect(out).toContain(`${entryName} {`)
    expect(out).toContain('&kp A')
  })

  it('add behavior prop: the new prop shows up in the entry body', () => {
    const draft = draftFromParsed(fixture)
    const original = draft.behaviors[0]
    expect(original).toBeDefined()
    const withProp = {
      ...original,
      props: [...original.props, { name: 'require-prior-idle-ms', value: '<125>' }],
    }
    draft.behaviors = [withProp, ...draft.behaviors.slice(1)]
    const out = buildCandidateText(fixture, draft)
    expect(out).toContain('require-prior-idle-ms = <125>;')
    // Preserved on re-emit.
    const reparsed = parseKeymap(out)
    const bh = reparsed.behaviors.find((b) => b.name === original.name)
    expect(bh?.props.some((p) => p.name === 'require-prior-idle-ms')).toBe(true)
  })
})
