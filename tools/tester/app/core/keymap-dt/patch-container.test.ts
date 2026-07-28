import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { EditorDraft } from '../editor-state/types'
import type { BehaviorEntry, ComboEntry, MacroEntry } from './types'
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

  it('rename combo: rewrites the DT node identifier, keeps other combos intact', () => {
    const draft = draftFromParsed(fixture)
    expect(draft.combos.length).toBeGreaterThan(0)
    const original = draft.combos[0]
    const newName = `${original.name}_renamed`
    draft.combos = [{ ...original, name: newName }, ...draft.combos.slice(1)]
    const out = buildCandidateText(fixture, draft)
    expect(out).toContain(`${newName} {`)
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

// dax6 board key count = 44. Grid layout does not matter for these tests; only
// the chain count needs to satisfy the layer serializer / parser invariants.
const FORTY_FOUR_TRANS = '&trans '.repeat(44).trim()

const KEYMAP_ONLY = `/ {
    keymap {
        compatible = "zmk,keymap";

        default_layer {
            bindings = <${FORTY_FOUR_TRANS}>;
        };
    };
};
`

function sampleMacro(name = 'macro_1'): MacroEntry {
  return {
    name,
    bindingsList: [{ tokens: ['&macro_tap'] }],
    props: [
      { name: 'compatible', value: '"zmk,behavior-macro"' },
      { name: '#binding-cells', value: '<0>' },
    ],
  }
}

function sampleCombo(name = 'combo_1'): ComboEntry {
  return {
    name,
    bindings: { tokens: ['&kp', 'ESC'] },
    keyPositions: [0, 1],
    layers: [0],
  }
}

function sampleBehavior(name = 'my_ht'): BehaviorEntry {
  return {
    name,
    compatible: 'zmk,behavior-hold-tap',
    props: [
      { name: '#binding-cells', value: '<2>' },
      { name: 'tapping-term-ms', value: '<200>' },
    ],
    bindings: [{ tokens: ['&kp'] }, { tokens: ['&kp'] }],
  }
}

describe('buildCandidateText — insert missing containers', () => {
  it('inserts a new macros container after keymap when source has none but draft does', () => {
    const draft = draftFromParsed(KEYMAP_ONLY)
    draft.macros = [sampleMacro('macro_1')]
    const out = buildCandidateText(KEYMAP_ONLY, draft)
    expect(out).toContain('macros {')
    expect(out).toContain('macro_1: macro_1 {')
    const keymapEnd = out.indexOf('keymap {')
    const macrosStart = out.indexOf('macros {')
    expect(macrosStart).toBeGreaterThan(keymapEnd)
  })

  it('inserts a new combos container after keymap when source has none but draft does', () => {
    const draft = draftFromParsed(KEYMAP_ONLY)
    draft.combos = [sampleCombo('combo_1')]
    const out = buildCandidateText(KEYMAP_ONLY, draft)
    expect(out).toContain('combos {')
    expect(out).toContain('compatible = "zmk,combos";')
    expect(out).toContain('combo_1 {')
  })

  it('inserts a new behaviors container after keymap when source has none but draft does', () => {
    const draft = draftFromParsed(KEYMAP_ONLY)
    draft.behaviors = [sampleBehavior('my_ht')]
    const out = buildCandidateText(KEYMAP_ONLY, draft)
    expect(out).toContain('behaviors {')
    expect(out).toContain('my_ht: my_ht {')
    expect(out).toContain('compatible = "zmk,behavior-hold-tap";')
  })

  it('inserts all three missing containers in canonical order combos → macros → behaviors', () => {
    const draft = draftFromParsed(KEYMAP_ONLY)
    draft.combos = [sampleCombo('combo_1')]
    draft.macros = [sampleMacro('macro_1')]
    draft.behaviors = [sampleBehavior('my_ht')]
    const out = buildCandidateText(KEYMAP_ONLY, draft)
    const combosAt = out.indexOf('combos {')
    const macrosAt = out.indexOf('macros {')
    const behaviorsAt = out.indexOf('behaviors {')
    expect(combosAt).toBeGreaterThan(-1)
    expect(macrosAt).toBeGreaterThan(-1)
    expect(behaviorsAt).toBeGreaterThan(-1)
    expect(combosAt).toBeLessThan(macrosAt)
    expect(macrosAt).toBeLessThan(behaviorsAt)
    const keymapClose = out.indexOf('};', out.indexOf('default_layer'))
    expect(combosAt).toBeGreaterThan(keymapClose)
  })

  it('does not insert any container when the draft has no entries for the missing kinds', () => {
    const draft = draftFromParsed(KEYMAP_ONLY)
    const out = buildCandidateText(KEYMAP_ONLY, draft)
    // The layer body gets normalised by serializeLayer, so the source is not
    // byte-identical; the property we care about is that no new container was
    // synthesised.
    expect(out).not.toMatch(/^\s*combos \{/m)
    expect(out).not.toMatch(/^\s*macros \{/m)
    expect(out).not.toMatch(/^\s*behaviors \{/m)
  })

  it('round-trips inserted containers back through parseKeymap with matching entries', () => {
    const draft = draftFromParsed(KEYMAP_ONLY)
    draft.combos = [sampleCombo('combo_1')]
    draft.macros = [sampleMacro('macro_1')]
    draft.behaviors = [sampleBehavior('my_ht')]
    const out = buildCandidateText(KEYMAP_ONLY, draft)
    const reparsed = parseKeymap(out)
    expect(reparsed.combos.map((c) => c.name)).toEqual(['combo_1'])
    expect(reparsed.combos[0].bindings.tokens).toEqual(['&kp', 'ESC'])
    expect(reparsed.combos[0].keyPositions).toEqual([0, 1])
    expect(reparsed.combos[0].layers).toEqual([0])
    expect(reparsed.macros.map((m) => m.name)).toEqual(['macro_1'])
    expect(reparsed.macros[0].bindingsList).toEqual([{ tokens: ['&macro_tap'] }])
    expect(reparsed.behaviors.map((b) => b.name)).toEqual(['my_ht'])
    expect(reparsed.behaviors[0].compatible).toBe('zmk,behavior-hold-tap')
  })
})
