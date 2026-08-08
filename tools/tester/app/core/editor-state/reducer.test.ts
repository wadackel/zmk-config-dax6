import { describe, expect, it } from 'vitest'
import type { BindingChain, LayerData } from '../keymap-dt/types'
import { computeMoveMap, emptyDraft, initialState, reducer, remapLayerRefs } from './reducer'
import type { EditorDraft, EditorState } from './types'

function makeLayer(name: string, fill: BindingChain): LayerData {
  return {
    name,
    bindings: Array.from({ length: 44 }, () => ({ tokens: [...fill.tokens] })),
    sensorBindings: { perEncoder: [{ tokens: ['&trans'] }, { tokens: ['&trans'] }] },
  }
}

function makeState(draft?: EditorDraft): EditorState {
  const d = draft ?? {
    ...emptyDraft(),
    layers: [
      makeLayer('default_layer', { tokens: ['&trans'] }),
      makeLayer('Symbol', { tokens: ['&trans'] }),
    ],
  }
  return { ...initialState(), draft: d, baselineSource: '', baselineMtimeMs: 0 }
}

function makeStateWithBindings(): EditorState {
  const s = makeState()
  return reducer(s, {
    type: 'UPDATE_SENSOR_BINDING',
    layerIdx: 0,
    encoderIdx: 0,
    chain: { tokens: ['&enc_scroll', 'SCRL_UP', 'SCRL_DOWN'] },
  })
}

describe('editor reducer', () => {
  it('LOAD replaces the entire state', () => {
    const draft = { ...emptyDraft(), layers: [makeLayer('Foo', { tokens: ['&kp', 'A'] })] }
    const s = reducer(initialState(), {
      type: 'LOAD',
      source: 'src',
      mtimeMs: 123,
      draft,
    })
    expect(s.draft.layers[0].name).toBe('Foo')
    expect(s.baselineSource).toBe('src')
    expect(s.baselineMtimeMs).toBe(123)
  })

  it('UPDATE_BINDING changes the targeted key and records history', () => {
    const before = makeState()
    const after = reducer(before, {
      type: 'UPDATE_BINDING',
      layerIdx: 0,
      keyIdx: 5,
      chain: { tokens: ['&kp', 'Z'] },
    })
    expect(after.draft.layers[0].bindings[5].tokens).toEqual(['&kp', 'Z'])
    expect(after.past.length).toBe(1)
  })

  it('UNDO restores the previous draft and pushes onto future', () => {
    let s = makeState()
    s = reducer(s, { type: 'UPDATE_BINDING', layerIdx: 0, keyIdx: 0, chain: { tokens: ['&kp', 'X'] } })
    const undone = reducer(s, { type: 'UNDO' })
    expect(undone.draft.layers[0].bindings[0].tokens).toEqual(['&trans'])
    expect(undone.future.length).toBe(1)
  })

  it('REDO re-applies the undone state', () => {
    let s = makeState()
    s = reducer(s, { type: 'UPDATE_BINDING', layerIdx: 0, keyIdx: 0, chain: { tokens: ['&kp', 'X'] } })
    s = reducer(s, { type: 'UNDO' })
    s = reducer(s, { type: 'REDO' })
    expect(s.draft.layers[0].bindings[0].tokens).toEqual(['&kp', 'X'])
  })

  it('ADD_COMBO appends a new combo with sensible defaults', () => {
    let s = makeState()
    s = reducer(s, { type: 'ADD_COMBO' })
    expect(s.draft.combos.length).toBe(1)
    expect(s.draft.combos[0].name).toBe('combo_1')
    expect(s.draft.combos[0].keyPositions).toEqual([])
  })

  it('REMOVE_COMBO removes by index', () => {
    let s = makeState()
    s = reducer(s, { type: 'ADD_COMBO' })
    s = reducer(s, { type: 'ADD_COMBO' })
    s = reducer(s, { type: 'REMOVE_COMBO', index: 0 })
    expect(s.draft.combos.length).toBe(1)
    expect(s.draft.combos[0].name).toBe('combo_2')
  })

  it('INSERT_SENSOR_BINDING is a no-op when the layer already has sensor-bindings', () => {
    const before = makeState()
    const after = reducer(before, { type: 'INSERT_SENSOR_BINDING', layerIdx: 0 })
    expect(after.draft.layers[0].sensorBindings).toEqual(before.draft.layers[0].sensorBindings)
  })

  it('INSERT_SENSOR_BINDING adds defaults when none present', () => {
    const draft = {
      ...emptyDraft(),
      layers: [
        {
          name: 'NoSensors',
          bindings: Array.from({ length: 44 }, () => ({ tokens: ['&trans'] })),
          sensorBindings: null,
        },
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, { type: 'INSERT_SENSOR_BINDING', layerIdx: 0 })
    expect(after.draft.layers[0].sensorBindings).not.toBeNull()
    expect(after.draft.layers[0].sensorBindings!.perEncoder.length).toBe(2)
  })

  it('REMOVE_SENSOR_BINDING clears the layer sensor-bindings back to null', () => {
    const before = makeState()
    const after = reducer(before, { type: 'REMOVE_SENSOR_BINDING', layerIdx: 0 })
    expect(after.draft.layers[0].sensorBindings).toBeNull()
    expect(after.past.length).toBe(1)
  })

  it('REMOVE_SENSOR_BINDING on an already-null layer is a no-op', () => {
    const draft = {
      ...emptyDraft(),
      layers: [
        {
          name: 'NoSensors',
          bindings: Array.from({ length: 44 }, () => ({ tokens: ['&trans'] })),
          sensorBindings: null,
        },
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, { type: 'REMOVE_SENSOR_BINDING', layerIdx: 0 })
    expect(after).toBe(before)
  })

  it('SWAP_SENSOR_BINDING_ARGS swaps arg0 and arg1 while preserving the head token', () => {
    const before = makeStateWithBindings()
    const after = reducer(before, { type: 'SWAP_SENSOR_BINDING_ARGS', layerIdx: 0, encoderIdx: 0 })
    expect(after.draft.layers[0].sensorBindings!.perEncoder[0].tokens).toEqual([
      '&enc_scroll',
      'SCRL_DOWN',
      'SCRL_UP',
    ])
  })

  it('SWAP_SENSOR_BINDING_ARGS is a no-op for chains with fewer than 2 args', () => {
    const before = reducer(makeState(), {
      type: 'UPDATE_SENSOR_BINDING',
      layerIdx: 0,
      encoderIdx: 0,
      chain: { tokens: ['&trans'] },
    })
    const after = reducer(before, { type: 'SWAP_SENSOR_BINDING_ARGS', layerIdx: 0, encoderIdx: 0 })
    expect(after).toBe(before)
  })

  it('COPY_SENSOR_BINDINGS deep-copies the perEncoder chains into the destination', () => {
    const before = makeStateWithBindings()
    const after = reducer(before, { type: 'COPY_SENSOR_BINDINGS', fromLayerIdx: 0, toLayerIdx: 1 })
    const src = after.draft.layers[0].sensorBindings!.perEncoder
    const dst = after.draft.layers[1].sensorBindings!.perEncoder
    expect(dst[0].tokens).toEqual(src[0].tokens)
    expect(dst[0]).not.toBe(src[0])
    expect(dst[0].tokens).not.toBe(src[0].tokens)
  })

  it('COPY_SENSOR_BINDINGS is a no-op when the source layer has no sensor-bindings', () => {
    const draft = {
      ...emptyDraft(),
      layers: [
        {
          name: 'NoSensors',
          bindings: Array.from({ length: 44 }, () => ({ tokens: ['&trans'] })),
          sensorBindings: null,
        },
        makeLayer('B', { tokens: ['&trans'] }),
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, {
      type: 'COPY_SENSOR_BINDINGS',
      fromLayerIdx: 0,
      toLayerIdx: 1,
    })
    expect(after).toBe(before)
  })

  it('APPLY_SENSOR_BINDINGS_TO_ALL propagates the source layer to every layer', () => {
    const before = makeStateWithBindings()
    const after = reducer(before, { type: 'APPLY_SENSOR_BINDINGS_TO_ALL', fromLayerIdx: 0 })
    for (const layer of after.draft.layers) {
      expect(layer.sensorBindings!.perEncoder[0].tokens).toEqual([
        '&enc_scroll',
        'SCRL_UP',
        'SCRL_DOWN',
      ])
    }
    expect(after.draft.layers[0].sensorBindings!.perEncoder[0].tokens).not.toBe(
      after.draft.layers[1].sensorBindings!.perEncoder[0].tokens,
    )
  })

  it('APPLY_SENSOR_BINDINGS_TO_ALL is a no-op when the source has no sensor-bindings', () => {
    const draft = {
      ...emptyDraft(),
      layers: [
        {
          name: 'NoSensors',
          bindings: Array.from({ length: 44 }, () => ({ tokens: ['&trans'] })),
          sensorBindings: null,
        },
        makeLayer('B', { tokens: ['&trans'] }),
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, { type: 'APPLY_SENSOR_BINDINGS_TO_ALL', fromLayerIdx: 0 })
    expect(after).toBe(before)
  })

  it('ADD_LAYER appends a layer of 44 &trans and switches activeLayerIdx', () => {
    const before = makeState()
    const after = reducer(before, { type: 'ADD_LAYER', name: 'MyTest' })
    expect(after.draft.layers.length).toBe(3)
    expect(after.draft.layers[2].name).toBe('MyTest')
    expect(after.draft.layers[2].bindings.length).toBe(44)
    expect(after.draft.layers[2].bindings.every((b) => b.tokens[0] === '&trans')).toBe(true)
    expect(after.draft.layers[2].sensorBindings).toBeNull()
    expect(after.activeLayerIdx).toBe(2)
  })

  it('preserves behaviour nodeName across an edit (cloneDraft round-trip)', () => {
    // `enc_scroll: encoder_scroll` in dax6.keymap has label≠node-name. Every edit
    // clones the draft via cloneDraft; if the clone drops nodeName, save silently
    // rewrites the header to `enc_scroll: enc_scroll`.
    const draft = {
      ...emptyDraft(),
      layers: [makeLayer('default_layer', { tokens: ['&trans'] })],
      behaviors: [
        {
          name: 'enc_scroll',
          nodeName: 'encoder_scroll',
          compatible: 'zmk,behavior-sensor-rotate-var',
          props: [],
        },
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, {
      type: 'UPDATE_BINDING',
      layerIdx: 0,
      keyIdx: 0,
      chain: { tokens: ['&kp', 'A'] },
    })
    expect(after.draft.behaviors[0].nodeName).toBe('encoder_scroll')
    expect(after.past[0].behaviors[0].nodeName).toBe('encoder_scroll')
  })

  it('ADD_LAYER rejects duplicate / empty names (no-op)', () => {
    const before = makeState()
    expect(reducer(before, { type: 'ADD_LAYER', name: 'default_layer' }).draft.layers.length).toBe(2)
    expect(reducer(before, { type: 'ADD_LAYER', name: '   ' }).draft.layers.length).toBe(2)
  })

  it('REMOVE_LAYER protects idx 0 (default_layer)', () => {
    const before = makeState()
    const after = reducer(before, { type: 'REMOVE_LAYER', idx: 0 })
    expect(after.draft.layers).toEqual(before.draft.layers)
  })

  it('REMOVE_LAYER shifts combo `layers` indices and drops the removed one', () => {
    const draft: EditorDraft = {
      ...emptyDraft(),
      layers: [
        makeLayer('default_layer', { tokens: ['&trans'] }),
        makeLayer('Symbol', { tokens: ['&trans'] }),
        makeLayer('Num', { tokens: ['&trans'] }),
        makeLayer('Function', { tokens: ['&trans'] }),
      ],
      combos: [
        {
          name: 'c1',
          bindings: { tokens: ['&trans'] },
          keyPositions: [0, 1],
          layers: [0, 2, 3],
        },
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, { type: 'REMOVE_LAYER', idx: 2 })
    expect(after.draft.layers.length).toBe(3)
    // 0 stays, 2 removed, 3 shifts to 2.
    expect(after.draft.combos[0].layers).toEqual([0, 2])
  })

  it('REMOVE_LAYER replaces &mo N with &trans when N === idx and decrements N > idx', () => {
    const base = makeLayer('default_layer', { tokens: ['&trans'] })
    base.bindings[0] = { tokens: ['&mo', '2'] } // references removed layer
    base.bindings[1] = { tokens: ['&mo', '3'] } // shifts down
    base.bindings[2] = { tokens: ['&mo', '1'] } // unchanged (< idx)
    const draft: EditorDraft = {
      ...emptyDraft(),
      layers: [
        base,
        makeLayer('Symbol', { tokens: ['&trans'] }),
        makeLayer('Num', { tokens: ['&trans'] }),
        makeLayer('Function', { tokens: ['&trans'] }),
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, { type: 'REMOVE_LAYER', idx: 2 })
    expect(after.draft.layers[0].bindings[0].tokens).toEqual(['&trans'])
    expect(after.draft.layers[0].bindings[1].tokens).toEqual(['&mo', '2'])
    expect(after.draft.layers[0].bindings[2].tokens).toEqual(['&mo', '1'])
  })

  it('REMOVE_LAYER rewrites &lt N k similarly (N === idx → &trans, N > idx → decrement)', () => {
    const base = makeLayer('default_layer', { tokens: ['&trans'] })
    base.bindings[0] = { tokens: ['&lt', '2', 'SPACE'] }
    base.bindings[1] = { tokens: ['&lt', '3', 'ENTER'] }
    const draft: EditorDraft = {
      ...emptyDraft(),
      layers: [
        base,
        makeLayer('Symbol', { tokens: ['&trans'] }),
        makeLayer('Num', { tokens: ['&trans'] }),
        makeLayer('Function', { tokens: ['&trans'] }),
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, { type: 'REMOVE_LAYER', idx: 2 })
    expect(after.draft.layers[0].bindings[0].tokens).toEqual(['&trans'])
    expect(after.draft.layers[0].bindings[1].tokens).toEqual(['&lt', '2', 'ENTER'])
  })

  it('REMOVE_LAYER leaves non-numeric layer args (e.g. #define names) untouched', () => {
    const base = makeLayer('default_layer', { tokens: ['&trans'] })
    base.bindings[0] = { tokens: ['&mo', 'NUM'] } // preprocessor reference
    const draft: EditorDraft = {
      ...emptyDraft(),
      layers: [
        base,
        makeLayer('Symbol', { tokens: ['&trans'] }),
        makeLayer('Num', { tokens: ['&trans'] }),
      ],
    }
    const before = makeState(draft)
    const after = reducer(before, { type: 'REMOVE_LAYER', idx: 2 })
    expect(after.draft.layers[0].bindings[0].tokens).toEqual(['&mo', 'NUM'])
  })

  it('REMOVE_LAYER clamps activeLayerIdx when the active layer is removed or out of range', () => {
    const before = { ...makeState(), activeLayerIdx: 1 }
    const after = reducer(before, { type: 'REMOVE_LAYER', idx: 1 })
    expect(after.draft.layers.length).toBe(1)
    expect(after.activeLayerIdx).toBe(0)
  })

  it('SET_CLIPBOARD with non-null entries stores deep copies; past/future/draft unchanged', () => {
    const before = { ...makeState(), past: [emptyDraft()], future: [emptyDraft()] }
    const original = before.draft
    const src: BindingChain = { tokens: ['&kp', 'A'] }
    const after = reducer(before, {
      type: 'SET_CLIPBOARD',
      entries: [
        { keyIdx: 0, chain: src },
        { keyIdx: 2, chain: { tokens: ['&trans'] } },
      ],
    })
    expect(after.clipboard).toEqual({
      entries: [
        { keyIdx: 0, chain: { tokens: ['&kp', 'A'] } },
        { keyIdx: 2, chain: { tokens: ['&trans'] } },
      ],
    })
    // Deep copy: mutating the source does not affect the clipboard.
    src.tokens.push('B')
    expect(after.clipboard!.entries[0].chain.tokens).toEqual(['&kp', 'A'])
    expect(after.draft).toBe(original)
    expect(after.past).toBe(before.past)
    expect(after.future).toBe(before.future)
  })

  it('SET_CLIPBOARD with null clears the clipboard (idempotent)', () => {
    const seeded = {
      ...makeState(),
      clipboard: { entries: [{ keyIdx: 0, chain: { tokens: ['&kp', 'A'] } }] },
    }
    const cleared = reducer(seeded, { type: 'SET_CLIPBOARD', entries: null })
    expect(cleared.clipboard).toBeNull()
    const again = reducer(cleared, { type: 'SET_CLIPBOARD', entries: null })
    expect(again.clipboard).toBeNull()
  })

  it('UPDATE_BINDINGS_BULK applies all edits and records a single history entry', () => {
    const before = makeState()
    const after = reducer(before, {
      type: 'UPDATE_BINDINGS_BULK',
      layerIdx: 0,
      edits: [
        { keyIdx: 1, chain: { tokens: ['&kp', 'Q'] } },
        { keyIdx: 2, chain: { tokens: ['&kp', 'Q'] } },
        { keyIdx: 3, chain: { tokens: ['&kp', 'Q'] } },
      ],
    })
    expect(after.draft.layers[0].bindings[1].tokens).toEqual(['&kp', 'Q'])
    expect(after.draft.layers[0].bindings[2].tokens).toEqual(['&kp', 'Q'])
    expect(after.draft.layers[0].bindings[3].tokens).toEqual(['&kp', 'Q'])
    expect(after.draft.layers[0].bindings[0].tokens).toEqual(['&trans']) // untouched
    expect(after.past.length).toBe(1) // single undo step for the whole batch
  })

  it('UPDATE_BINDINGS_BULK with empty edits is a no-op (no history entry)', () => {
    const before = makeState()
    const after = reducer(before, { type: 'UPDATE_BINDINGS_BULK', layerIdx: 0, edits: [] })
    expect(after).toBe(before)
  })

  it('LOAD preserves the clipboard across a re-load', () => {
    const seeded = {
      ...makeState(),
      clipboard: { entries: [{ keyIdx: 1, chain: { tokens: ['&kp', 'A'] } }] },
    }
    const reloaded = reducer(seeded, {
      type: 'LOAD',
      source: 'new src',
      mtimeMs: 999,
      draft: emptyDraft(),
    })
    expect(reloaded.clipboard).toEqual({
      entries: [{ keyIdx: 1, chain: { tokens: ['&kp', 'A'] } }],
    })
    // History was reset though.
    expect(reloaded.past).toEqual([])
    expect(reloaded.future).toEqual([])
  })

  it('SAVE_COMMIT preserves activeTab / activeLayerIdx / clipboard', () => {
    const seeded: EditorState = {
      ...makeState(),
      activeTab: 'combos',
      activeLayerIdx: 1,
      clipboard: { entries: [{ keyIdx: 1, chain: { tokens: ['&kp', 'A'] } }] },
    }
    const draft = {
      ...emptyDraft(),
      layers: [
        makeLayer('default_layer', { tokens: ['&trans'] }),
        makeLayer('Symbol', { tokens: ['&trans'] }),
      ],
    }
    const after = reducer(seeded, {
      type: 'SAVE_COMMIT',
      source: 'new src',
      mtimeMs: 999,
      draft,
    })
    expect(after.activeTab).toBe('combos')
    expect(after.activeLayerIdx).toBe(1)
    expect(after.clipboard).toEqual({
      entries: [{ keyIdx: 1, chain: { tokens: ['&kp', 'A'] } }],
    })
  })

  it('SAVE_COMMIT replaces baseline and clears history', () => {
    const seeded: EditorState = {
      ...makeState(),
      past: [emptyDraft()],
      future: [emptyDraft()],
    }
    const draft = {
      ...emptyDraft(),
      layers: [makeLayer('default_layer', { tokens: ['&kp', 'A'] })],
    }
    const after = reducer(seeded, {
      type: 'SAVE_COMMIT',
      source: 'new src',
      mtimeMs: 999,
      draft,
    })
    expect(after.baselineSource).toBe('new src')
    expect(after.baselineMtimeMs).toBe(999)
    expect(after.past).toEqual([])
    expect(after.future).toEqual([])
    expect(after.draft).toBe(draft)
  })

  it('SAVE_COMMIT clamps activeLayerIdx when new draft has fewer layers', () => {
    const seeded: EditorState = { ...makeState(), activeLayerIdx: 5 }
    const draft = {
      ...emptyDraft(),
      layers: [
        makeLayer('default_layer', { tokens: ['&trans'] }),
        makeLayer('Symbol', { tokens: ['&trans'] }),
      ],
    }
    const after = reducer(seeded, {
      type: 'SAVE_COMMIT',
      source: 'new src',
      mtimeMs: 999,
      draft,
    })
    expect(after.activeLayerIdx).toBe(1)
  })

  describe('computeMoveMap', () => {
    it('identity map when from === to', () => {
      expect(computeMoveMap(1, 1, 4)).toEqual([0, 1, 2, 3])
    })

    it('forward move shifts intermediate indices down by 1', () => {
      // [A B C D E], move 1 → 3 → resulting order [A C D B E]
      // Old index 1 (B) should now be at slot 3; old 2 (C) → 1; old 3 (D) → 2.
      expect(computeMoveMap(1, 3, 5)).toEqual([0, 3, 1, 2, 4])
    })

    it('backward move shifts intermediate indices up by 1', () => {
      // [A B C D E], move 3 → 1 → resulting order [A D B C E]
      // Old 3 → 1; old 1 → 2; old 2 → 3.
      expect(computeMoveMap(3, 1, 5)).toEqual([0, 2, 3, 1, 4])
    })

    it('rejects out-of-range indices with identity fallback', () => {
      expect(computeMoveMap(5, 2, 3)).toEqual([0, 1, 2])
      expect(computeMoveMap(0, -1, 3)).toEqual([0, 1, 2])
    })
  })

  describe('remapLayerRefs', () => {
    it('rewrites &mo / &lt argument by the map', () => {
      const draft: EditorDraft = {
        ...emptyDraft(),
        layers: [
          {
            name: 'A',
            bindings: [{ tokens: ['&mo', '1'] }, { tokens: ['&lt', '2', 'ESC'] }],
            sensorBindings: null,
          },
        ],
        combos: [
          {
            name: 'c',
            bindings: { tokens: ['&mo', '2'] },
            keyPositions: [0, 1],
            layers: [1, 2],
          },
        ],
      }
      const map = [0, 3, 1, 2] // 1 → 3, 2 → 1, 3 → 2
      const remapped = remapLayerRefs(draft, map)
      expect(remapped.layers[0].bindings[0].tokens).toEqual(['&mo', '3'])
      expect(remapped.layers[0].bindings[1].tokens).toEqual(['&lt', '1', 'ESC'])
      expect(remapped.combos[0].bindings.tokens).toEqual(['&mo', '1'])
      expect(remapped.combos[0].layers).toEqual([3, 1])
    })

    it('leaves non-numeric layer-tap args untouched', () => {
      const draft: EditorDraft = {
        ...emptyDraft(),
        layers: [
          {
            name: 'A',
            bindings: [{ tokens: ['&lt', 'SYM_LAYER', 'ESC'] }],
            sensorBindings: null,
          },
        ],
      }
      const remapped = remapLayerRefs(draft, [0, 1, 2])
      expect(remapped.layers[0].bindings[0].tokens).toEqual(['&lt', 'SYM_LAYER', 'ESC'])
    })
  })

  describe('MOVE_LAYER', () => {
    // MOVE_LAYER never lets either endpoint be idx 0 (default_layer is
    // codegen-locked). Tests below use a 3-layer state and swap between
    // idx 1 and idx 2 instead of ever touching idx 0.
    const make3LayerState = (): EditorState => {
      const draft: EditorDraft = {
        ...emptyDraft(),
        layers: [
          makeLayer('default_layer', { tokens: ['&trans'] }),
          makeLayer('Symbol', { tokens: ['&trans'] }),
          makeLayer('Num', { tokens: ['&trans'] }),
        ],
      }
      return { ...initialState(), draft, baselineSource: '', baselineMtimeMs: 0 }
    }

    it('reorders layers array and updates &mo references', () => {
      let s = make3LayerState()
      s = reducer(s, {
        type: 'UPDATE_BINDING',
        layerIdx: 0,
        keyIdx: 0,
        chain: { tokens: ['&mo', '1'] },
      })
      // Move Symbol (idx 1) to slot 2 — Num shifts left.
      s = reducer(s, { type: 'MOVE_LAYER', fromIdx: 1, toIdx: 2 })
      expect(s.draft.layers.map((l) => l.name)).toEqual([
        'default_layer',
        'Num',
        'Symbol',
      ])
      // The &mo 1 reference on default_layer should now be &mo 2
      // (Symbol moved to slot 2, so references to old index 1 → new 2).
      expect(s.draft.layers[0].bindings[0].tokens).toEqual(['&mo', '2'])
      expect(s.past.length).toBe(2) // one from UPDATE_BINDING, one from MOVE
    })

    it('MOVE_LAYER with same from/to is a no-op', () => {
      const s = makeState()
      const after = reducer(s, { type: 'MOVE_LAYER', fromIdx: 1, toIdx: 1 })
      expect(after).toBe(s)
    })

    it('adjusts activeLayerIdx to follow the moved layer', () => {
      let s = make3LayerState()
      s = { ...s, activeLayerIdx: 1 }
      s = reducer(s, { type: 'MOVE_LAYER', fromIdx: 1, toIdx: 2 })
      expect(s.activeLayerIdx).toBe(2)
    })
  })

  describe('RENAME_LAYER', () => {
    it('changes only the target layer name', () => {
      let s = makeState()
      s = reducer(s, { type: 'RENAME_LAYER', idx: 1, name: 'Sym' })
      expect(s.draft.layers[1].name).toBe('Sym')
      expect(s.draft.layers[0].name).toBe('default_layer')
      expect(s.past.length).toBe(1)
    })

    it('rejects a duplicate name silently', () => {
      const s = makeState()
      const after = reducer(s, { type: 'RENAME_LAYER', idx: 1, name: 'default_layer' })
      expect(after).toBe(s)
    })

    it('rejects an empty / whitespace-only name', () => {
      const s = makeState()
      expect(reducer(s, { type: 'RENAME_LAYER', idx: 1, name: '  ' })).toBe(s)
    })

    it('rejects renaming idx 0 (default_layer is codegen-locked)', () => {
      const s = makeState()
      const after = reducer(s, { type: 'RENAME_LAYER', idx: 0, name: 'Base' })
      expect(after).toBe(s)
    })

    it('rejects invalid DT identifier (spaces, leading digit, punctuation)', () => {
      const s = makeState()
      expect(reducer(s, { type: 'RENAME_LAYER', idx: 1, name: 'my layer' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_LAYER', idx: 1, name: '9num' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_LAYER', idx: 1, name: 'has-dash' })).toBe(s)
    })
  })

  describe('RENAME_COMBO', () => {
    function makeStateWithCombos(): EditorState {
      let s = makeState()
      s = reducer(s, { type: 'ADD_COMBO' })
      s = reducer(s, { type: 'ADD_COMBO' })
      return s
    }

    it('changes only the target combo name and records history', () => {
      let s = makeStateWithCombos()
      const pastBefore = s.past.length
      s = reducer(s, { type: 'RENAME_COMBO', index: 0, name: 'chord_esc' })
      expect(s.draft.combos[0].name).toBe('chord_esc')
      expect(s.draft.combos[1].name).toBe('combo_2')
      expect(s.past.length).toBe(pastBefore + 1)
    })

    it('rejects an empty / whitespace-only name', () => {
      const s = makeStateWithCombos()
      expect(reducer(s, { type: 'RENAME_COMBO', index: 0, name: '  ' })).toBe(s)
    })

    it('rejects an invalid DT identifier', () => {
      const s = makeStateWithCombos()
      expect(reducer(s, { type: 'RENAME_COMBO', index: 0, name: 'my combo' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_COMBO', index: 0, name: '9combo' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_COMBO', index: 0, name: 'has-dash' })).toBe(s)
    })

    it('rejects a duplicate combo name silently', () => {
      const s = makeStateWithCombos()
      const after = reducer(s, { type: 'RENAME_COMBO', index: 0, name: 'combo_2' })
      expect(after).toBe(s)
    })

    it('is a no-op when the new name equals the current name', () => {
      const s = makeStateWithCombos()
      expect(reducer(s, { type: 'RENAME_COMBO', index: 0, name: 'combo_1' })).toBe(s)
    })

    it('rejects an out-of-range index', () => {
      const s = makeStateWithCombos()
      expect(reducer(s, { type: 'RENAME_COMBO', index: -1, name: 'x' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_COMBO', index: 5, name: 'x' })).toBe(s)
    })
  })

  describe('RENAME_MACRO', () => {
    function makeStateWithMacroRefs(): EditorState {
      const draft: EditorDraft = {
        ...emptyDraft(),
        layers: [
          {
            name: 'default_layer',
            bindings: [
              { tokens: ['&macro_1'] },
              { tokens: ['&kp', 'A'] },
              { tokens: ['&macro_2'] },
              ...Array.from({ length: 43 }, () => ({ tokens: ['&trans'] })),
            ],
            sensorBindings: {
              perEncoder: [{ tokens: ['&macro_1'] }, { tokens: ['&trans'] }],
            },
          },
        ],
        combos: [
          {
            name: 'combo_1',
            bindings: { tokens: ['&macro_1'] },
            keyPositions: [0, 1],
            layers: [0],
          },
        ],
        macros: [
          {
            name: 'macro_1',
            bindingsList: [{ tokens: ['&macro_tap'] }],
            props: [{ name: 'compatible', value: '"zmk,behavior-macro"' }],
          },
          {
            name: 'macro_2',
            bindingsList: [{ tokens: ['&macro_1'] }],
            props: [{ name: 'compatible', value: '"zmk,behavior-macro"' }],
          },
        ],
        behaviors: [
          {
            name: 'bh_1',
            compatible: '"zmk,behavior-hold-tap"',
            props: [],
            bindings: [{ tokens: ['&macro_1'] }, { tokens: ['&kp', 'B'] }],
          },
        ],
        mouseGestures: [
          {
            kind: 'named',
            name: 'mg_1',
            props: [],
            entries: [
              {
                name: 'mg_e1',
                pattern: 'UP',
                bindings: { tokens: ['&macro_1'] },
              },
            ],
          },
        ],
      }
      return { ...initialState(), draft }
    }

    it('renames the macro and cascades to every reference surface', () => {
      const before = makeStateWithMacroRefs()
      const after = reducer(before, {
        type: 'RENAME_MACRO',
        index: 0,
        name: 'my_macro',
      })
      expect(after.draft.macros[0].name).toBe('my_macro')
      expect(after.draft.macros[1].name).toBe('macro_2')
      expect(after.draft.macros[1].bindingsList[0].tokens).toEqual(['&my_macro'])
      expect(after.draft.layers[0].bindings[0].tokens).toEqual(['&my_macro'])
      expect(after.draft.layers[0].bindings[2].tokens).toEqual(['&macro_2'])
      expect(after.draft.layers[0].sensorBindings!.perEncoder[0].tokens).toEqual([
        '&my_macro',
      ])
      expect(after.draft.combos[0].bindings.tokens).toEqual(['&my_macro'])
      expect(after.draft.behaviors[0].bindings![0].tokens).toEqual(['&my_macro'])
      expect(after.draft.mouseGestures[0].entries[0].bindings.tokens).toEqual([
        '&my_macro',
      ])
      expect(after.past.length).toBe(1)
    })

    it('preserves nodeName when only name changes', () => {
      const s = makeStateWithMacroRefs()
      const withNode: EditorState = {
        ...s,
        draft: {
          ...s.draft,
          macros: s.draft.macros.map((m, i) =>
            i === 0 ? { ...m, nodeName: 'legacy_node' } : m,
          ),
        },
      }
      const after = reducer(withNode, {
        type: 'RENAME_MACRO',
        index: 0,
        name: 'shiny',
      })
      expect(after.draft.macros[0].name).toBe('shiny')
      expect(after.draft.macros[0].nodeName).toBe('legacy_node')
    })

    it('rejects invalid DT identifiers (leading digit, spaces, punctuation)', () => {
      const s = makeStateWithMacroRefs()
      expect(reducer(s, { type: 'RENAME_MACRO', index: 0, name: '1macro' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_MACRO', index: 0, name: 'my macro' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_MACRO', index: 0, name: 'has-dash' })).toBe(s)
    })

    it('rejects an empty / whitespace-only name', () => {
      const s = makeStateWithMacroRefs()
      expect(reducer(s, { type: 'RENAME_MACRO', index: 0, name: '' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_MACRO', index: 0, name: '   ' })).toBe(s)
    })

    it('rejects a duplicate name silently', () => {
      const s = makeStateWithMacroRefs()
      expect(reducer(s, { type: 'RENAME_MACRO', index: 0, name: 'macro_2' })).toBe(s)
    })

    it('is a no-op when the name is unchanged', () => {
      const s = makeStateWithMacroRefs()
      expect(reducer(s, { type: 'RENAME_MACRO', index: 0, name: 'macro_1' })).toBe(s)
    })

    it('rejects an out-of-range index', () => {
      const s = makeStateWithMacroRefs()
      expect(reducer(s, { type: 'RENAME_MACRO', index: -1, name: 'ok' })).toBe(s)
      expect(reducer(s, { type: 'RENAME_MACRO', index: 99, name: 'ok' })).toBe(s)
    })
  })

  describe('MOVE_LAYER default_layer guard', () => {
    it('rejects MOVE_LAYER when fromIdx is 0', () => {
      const s = makeState()
      const after = reducer(s, { type: 'MOVE_LAYER', fromIdx: 0, toIdx: 1 })
      expect(after).toBe(s)
    })

    it('rejects MOVE_LAYER when toIdx is 0', () => {
      const s = makeState()
      const after = reducer(s, { type: 'MOVE_LAYER', fromIdx: 1, toIdx: 0 })
      expect(after).toBe(s)
    })
  })
})
