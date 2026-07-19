// Pure reducer for the editor state. Mutations are immutable: every action that
// changes the draft pushes the previous draft onto the undo stack and clears
// the redo stack. UNDO / REDO swap stacks accordingly.

import { getBoard } from '../../boards/active'
import type { BindingChain, ComboEntry, LayerData, MacroEntry } from '../keymap-dt/types'
import { LAYER_INDEX_BEHAVIORS } from '../picker/behavior-registry'
import { HISTORY_LIMIT, type EditorAction, type EditorDraft, type EditorState } from './types'

function defaultBindings(): BindingChain[] {
  return Array.from({ length: getBoard().matrix.keyCount }, () => ({ tokens: ['&trans'] }))
}

/**
 * Rewrites every layer-index reference in `draft` after a layer at index
 * `removedIdx` has been deleted. References to the removed layer collapse to
 * `&trans`; references to layers with a higher index are shifted down by 1.
 * Non-numeric layer arguments (preprocessor `#define` names) are left as-is.
 */
export function shiftLayerRefsOnRemove(draft: EditorDraft, removedIdx: number): EditorDraft {
  const LAYER_TAP_BEHAVIORS = getBoard().behaviors.layerTapBehaviors
  const shiftChain = (chain: BindingChain): BindingChain => {
    const head = chain.tokens[0]
    if (!head) return chain
    if (LAYER_INDEX_BEHAVIORS.has(head)) {
      const ref = chain.tokens[1]
      const n = Number(ref)
      if (!Number.isInteger(n)) return chain
      if (n === removedIdx) return { tokens: ['&trans'] }
      if (n > removedIdx) return { tokens: [head, String(n - 1), ...chain.tokens.slice(2)] }
      return chain
    }
    if (LAYER_TAP_BEHAVIORS.has(head)) {
      const ref = chain.tokens[1]
      const n = Number(ref)
      if (!Number.isInteger(n)) return chain
      if (n === removedIdx) return { tokens: ['&trans'] }
      if (n > removedIdx) return { tokens: [head, String(n - 1), ...chain.tokens.slice(2)] }
      return chain
    }
    return chain
  }

  return {
    ...draft,
    layers: draft.layers.map((l) => ({
      ...l,
      bindings: l.bindings.map(shiftChain),
      sensorBindings: l.sensorBindings
        ? { perEncoder: l.sensorBindings.perEncoder.map(shiftChain) }
        : null,
    })),
    combos: draft.combos.map((c) => ({
      ...c,
      bindings: shiftChain(c.bindings),
      layers: c.layers.filter((n) => n !== removedIdx).map((n) => (n > removedIdx ? n - 1 : n)),
    })),
    macros: draft.macros.map((m) => ({
      ...m,
      bindingsList: m.bindingsList.map(shiftChain),
    })),
    behaviors: draft.behaviors.map((b) => ({
      ...b,
      bindings: b.bindings?.map(shiftChain),
    })),
    mouseGestures: draft.mouseGestures.map((g) => ({
      ...g,
      entries: g.entries.map((e) => ({ ...e, bindings: shiftChain(e.bindings) })),
    })),
  }
}

/**
 * Rewrites every macro-label reference in `draft` after a macro has been
 * renamed. Bindings whose head token is `&<oldName>` are rewritten to
 * `&<newName>`; every other chain is left untouched. Traversal covers the
 * same surfaces as `shiftLayerRefsOnRemove` so no reference is missed.
 */
export function renameMacroRefs(
  draft: EditorDraft,
  oldName: string,
  newName: string,
): EditorDraft {
  const oldRef = `&${oldName}`
  const newRef = `&${newName}`
  const renameChain = (chain: BindingChain): BindingChain => {
    if (chain.tokens[0] !== oldRef) return chain
    return { tokens: [newRef, ...chain.tokens.slice(1)] }
  }
  return {
    ...draft,
    layers: draft.layers.map((l) => ({
      ...l,
      bindings: l.bindings.map(renameChain),
      sensorBindings: l.sensorBindings
        ? { perEncoder: l.sensorBindings.perEncoder.map(renameChain) }
        : null,
    })),
    combos: draft.combos.map((c) => ({
      ...c,
      bindings: renameChain(c.bindings),
    })),
    macros: draft.macros.map((m) => ({
      ...m,
      bindingsList: m.bindingsList.map(renameChain),
    })),
    behaviors: draft.behaviors.map((b) => ({
      ...b,
      bindings: b.bindings?.map(renameChain),
    })),
    mouseGestures: draft.mouseGestures.map((g) => ({
      ...g,
      entries: g.entries.map((e) => ({ ...e, bindings: renameChain(e.bindings) })),
    })),
  }
}

/**
 * Computes the `old → new` index mapping for a MOVE_LAYER (fromIdx → toIdx).
 * Layers between the two positions shift by ±1; layers outside the affected
 * range keep their index. Exported for tests and for MOVE_LAYER's own use.
 *
 * Example: layers = [A, B, C, D], MOVE 1 → 3 gives map = [0, 3, 1, 2]
 * (B moves to slot 3, C and D shift left by 1).
 */
export function computeMoveMap(
  fromIdx: number,
  toIdx: number,
  layerCount: number,
): number[] {
  const map = Array.from({ length: layerCount }, (_, i) => i)
  if (fromIdx === toIdx) return map
  if (fromIdx < 0 || fromIdx >= layerCount) return map
  if (toIdx < 0 || toIdx >= layerCount) return map
  map[fromIdx] = toIdx
  if (fromIdx < toIdx) {
    for (let i = fromIdx + 1; i <= toIdx; i++) map[i] = i - 1
  } else {
    for (let i = toIdx; i < fromIdx; i++) map[i] = i + 1
  }
  return map
}

/**
 * Rewrites every layer-index reference in `draft` using an `old → new`
 * mapping (produced by `computeMoveMap`). Non-numeric arguments (e.g. a
 * preprocessor `#define` name) are left as-is because our `#define`s do not
 * carry numeric indices today.
 */
export function remapLayerRefs(draft: EditorDraft, map: number[]): EditorDraft {
  const LAYER_TAP_BEHAVIORS = getBoard().behaviors.layerTapBehaviors
  const remap = (n: number): number => (n >= 0 && n < map.length ? map[n]! : n)
  const remapChain = (chain: BindingChain): BindingChain => {
    const head = chain.tokens[0]
    if (!head) return chain
    if (LAYER_INDEX_BEHAVIORS.has(head) || LAYER_TAP_BEHAVIORS.has(head)) {
      const ref = chain.tokens[1]
      const n = Number(ref)
      if (!Number.isInteger(n)) return chain
      const next = remap(n)
      if (next === n) return chain
      return { tokens: [head, String(next), ...chain.tokens.slice(2)] }
    }
    return chain
  }
  return {
    ...draft,
    layers: draft.layers.map((l) => ({
      ...l,
      bindings: l.bindings.map(remapChain),
      sensorBindings: l.sensorBindings
        ? { perEncoder: l.sensorBindings.perEncoder.map(remapChain) }
        : null,
    })),
    combos: draft.combos.map((c) => ({
      ...c,
      bindings: remapChain(c.bindings),
      layers: c.layers.map(remap),
    })),
    macros: draft.macros.map((m) => ({
      ...m,
      bindingsList: m.bindingsList.map(remapChain),
    })),
    behaviors: draft.behaviors.map((b) => ({
      ...b,
      bindings: b.bindings?.map(remapChain),
    })),
    mouseGestures: draft.mouseGestures.map((g) => ({
      ...g,
      entries: g.entries.map((e) => ({ ...e, bindings: remapChain(e.bindings) })),
    })),
  }
}

/**
 * Reports how many binding chains in `draft` would be replaced with `&trans`
 * if layer `idx` were removed (i.e. references to that specific layer index).
 * Used by the Layers tab to surface a confirmation count before deletion.
 */
export function countLayerRefs(draft: EditorDraft, idx: number): number {
  const LAYER_TAP_BEHAVIORS = getBoard().behaviors.layerTapBehaviors
  let count = 0
  const visit = (chain: BindingChain) => {
    const head = chain.tokens[0]
    if (!head) return
    if (LAYER_INDEX_BEHAVIORS.has(head) || LAYER_TAP_BEHAVIORS.has(head)) {
      if (Number(chain.tokens[1]) === idx) count++
    }
  }
  for (const l of draft.layers) {
    l.bindings.forEach(visit)
    l.sensorBindings?.perEncoder.forEach(visit)
  }
  for (const c of draft.combos) {
    visit(c.bindings)
    if (c.layers.includes(idx)) count++
  }
  for (const m of draft.macros) m.bindingsList.forEach(visit)
  for (const b of draft.behaviors) b.bindings?.forEach(visit)
  for (const g of draft.mouseGestures) g.entries.forEach((e) => visit(e.bindings))
  return count
}

export function emptyDraft(): EditorDraft {
  return {
    layers: [],
    combos: [],
    macros: [],
    behaviors: [],
    mouseGestures: [],
    rootBehaviors: [],
  }
}

export function initialState(): EditorState {
  return {
    baselineSource: '',
    baselineMtimeMs: 0,
    draft: emptyDraft(),
    past: [],
    future: [],
    activeTab: 'layers',
    activeLayerIdx: 0,
    clipboard: null,
  }
}

export function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        baselineSource: action.source,
        baselineMtimeMs: action.mtimeMs,
        draft: action.draft,
        past: [],
        future: [],
        activeTab: 'layers',
        activeLayerIdx: 0,
      }

    case 'SAVE_COMMIT': {
      const maxIdx = action.draft.layers.length - 1
      const clampedLayerIdx =
        maxIdx < 0 ? 0 : Math.max(0, Math.min(state.activeLayerIdx, maxIdx))
      return {
        ...state,
        baselineSource: action.source,
        baselineMtimeMs: action.mtimeMs,
        draft: action.draft,
        past: [],
        future: [],
        activeLayerIdx: clampedLayerIdx,
      }
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }

    case 'SET_ACTIVE_LAYER':
      return { ...state, activeLayerIdx: action.layerIdx }

    case 'SET_CLIPBOARD':
      return {
        ...state,
        clipboard: action.chain ? { tokens: [...action.chain.tokens] } : null,
      }

    case 'ADD_LAYER': {
      const trimmed = action.name.trim()
      if (!trimmed) return state
      if (state.draft.layers.some((l) => l.name === trimmed)) return state
      const newLayer: LayerData = {
        name: trimmed,
        bindings: defaultBindings(),
        sensorBindings: null,
      }
      const draft = cloneDraft(state.draft)
      draft.layers = [...draft.layers, newLayer]
      return {
        ...state,
        draft,
        past: pushHistory(state.past, state.draft),
        future: [],
        activeLayerIdx: draft.layers.length - 1,
      }
    }

    case 'REMOVE_LAYER': {
      // Protect the default_layer (idx 0). ZMK requires it AND the build-time
      // `codegen/vite-plugin.ts` looks it up by name.
      if (action.idx === 0) return state
      if (action.idx < 0 || action.idx >= state.draft.layers.length) return state
      const cloned = cloneDraft(state.draft)
      cloned.layers = cloned.layers.filter((_, i) => i !== action.idx)
      const shifted = shiftLayerRefsOnRemove(cloned, action.idx)
      const nextActive = Math.min(state.activeLayerIdx, shifted.layers.length - 1)
      return {
        ...state,
        draft: shifted,
        past: pushHistory(state.past, state.draft),
        future: [],
        activeLayerIdx: Math.max(0, nextActive),
      }
    }

    case 'MOVE_LAYER': {
      const { fromIdx, toIdx } = action
      const layers = state.draft.layers
      if (
        fromIdx === toIdx ||
        fromIdx < 0 ||
        fromIdx >= layers.length ||
        toIdx < 0 ||
        toIdx >= layers.length
      ) {
        return state
      }
      // codegen/vite-plugin.ts:46 looks up default_layer by name at idx 0, and
      // ZMK's base layer is always layer 0; letting either endpoint be idx 0
      // would rearrange those invariants and break the build downstream.
      if (fromIdx === 0 || toIdx === 0) return state
      const map = computeMoveMap(fromIdx, toIdx, layers.length)
      const reordered = layers.map((_, i) => layers[map.indexOf(i)]!)
      const nextActive = map[state.activeLayerIdx] ?? state.activeLayerIdx
      const nextDraft = remapLayerRefs(
        { ...state.draft, layers: reordered },
        map,
      )
      return {
        ...state,
        draft: nextDraft,
        past: pushHistory(state.past, state.draft),
        future: [],
        activeLayerIdx: nextActive,
      }
    }

    case 'RENAME_LAYER': {
      const { idx, name } = action
      const trimmed = name.trim()
      if (!trimmed) return state
      if (idx < 0 || idx >= state.draft.layers.length) return state
      // idx 0 must remain `default_layer` — codegen/vite-plugin.ts:46 looks it
      // up by name at build time, so a rename would break the ZMK build.
      if (idx === 0) return state
      // DT identifier rule (mirrors AddLayerDialog): first char letter/underscore,
      // rest letters/digits/underscores. Spaces or leading digits produce invalid
      // DTS at serialize time.
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return state
      const currentName = state.draft.layers[idx]!.name
      if (trimmed === currentName) return state
      // Reject collisions with any other layer's name — DT identifiers must
      // be unique within the keymap node.
      if (state.draft.layers.some((l, i) => i !== idx && l.name === trimmed)) {
        return state
      }
      return mutateDraft(state, (d) => {
        d.layers = d.layers.map((l, i) => (i === idx ? { ...l, name: trimmed } : l))
      })
    }

    case 'UPDATE_BINDING':
      return mutateDraft(state, (d) => {
        d.layers[action.layerIdx] = {
          ...d.layers[action.layerIdx],
          bindings: d.layers[action.layerIdx].bindings.map((b, i) =>
            i === action.keyIdx ? action.chain : b,
          ),
        }
      })

    case 'UPDATE_BINDINGS_BULK': {
      if (action.edits.length === 0) return state
      return mutateDraft(state, (d) => {
        const layer = d.layers[action.layerIdx]
        if (!layer) return
        const next = [...layer.bindings]
        for (const e of action.edits) {
          if (e.keyIdx < 0 || e.keyIdx >= next.length) continue
          next[e.keyIdx] = { tokens: [...e.chain.tokens] }
        }
        d.layers[action.layerIdx] = { ...layer, bindings: next }
      })
    }

    case 'UPDATE_SENSOR_BINDING':
      return mutateDraft(state, (d) => {
        const layer = d.layers[action.layerIdx]
        const perEncoder = (layer.sensorBindings?.perEncoder ?? [
          { tokens: [] },
          { tokens: [] },
        ]).map((b, i) => (i === action.encoderIdx ? action.chain : b))
        d.layers[action.layerIdx] = { ...layer, sensorBindings: { perEncoder } }
      })

    case 'INSERT_SENSOR_BINDING':
      return mutateDraft(state, (d) => {
        const layer = d.layers[action.layerIdx]
        if (layer.sensorBindings) return // already present; reducer is no-op
        d.layers[action.layerIdx] = {
          ...layer,
          sensorBindings: {
            perEncoder: [{ tokens: ['&trans'] }, { tokens: ['&trans'] }],
          },
        }
      })

    case 'REMOVE_SENSOR_BINDING': {
      const layer = state.draft.layers[action.layerIdx]
      if (!layer || !layer.sensorBindings) return state
      return mutateDraft(state, (d) => {
        d.layers[action.layerIdx] = { ...d.layers[action.layerIdx], sensorBindings: null }
      })
    }

    case 'SWAP_SENSOR_BINDING_ARGS': {
      const layer = state.draft.layers[action.layerIdx]
      const perEncoder = layer?.sensorBindings?.perEncoder
      const chain = perEncoder?.[action.encoderIdx]
      if (!perEncoder || !chain || chain.tokens.length < 3) return state
      return mutateDraft(state, (d) => {
        const dLayer = d.layers[action.layerIdx]
        const dPerEncoder = dLayer.sensorBindings!.perEncoder
        const dChain = dPerEncoder[action.encoderIdx]
        const nextTokens = [...dChain.tokens]
        const tmp = nextTokens[1]!
        nextTokens[1] = nextTokens[2]!
        nextTokens[2] = tmp
        const nextPerEncoder = dPerEncoder.map((b, i) =>
          i === action.encoderIdx ? { tokens: nextTokens } : b,
        )
        d.layers[action.layerIdx] = { ...dLayer, sensorBindings: { perEncoder: nextPerEncoder } }
      })
    }

    case 'COPY_SENSOR_BINDINGS': {
      const src = state.draft.layers[action.fromLayerIdx]?.sensorBindings
      const dst = state.draft.layers[action.toLayerIdx]
      if (!src || !dst) return state
      return mutateDraft(state, (d) => {
        d.layers[action.toLayerIdx] = {
          ...d.layers[action.toLayerIdx],
          sensorBindings: {
            perEncoder: src.perEncoder.map((b) => ({ tokens: [...b.tokens] })),
          },
        }
      })
    }

    case 'APPLY_SENSOR_BINDINGS_TO_ALL': {
      const src = state.draft.layers[action.fromLayerIdx]?.sensorBindings
      if (!src) return state
      return mutateDraft(state, (d) => {
        d.layers = d.layers.map((l) => ({
          ...l,
          sensorBindings: {
            perEncoder: src.perEncoder.map((b) => ({ tokens: [...b.tokens] })),
          },
        }))
      })
    }

    case 'ADD_COMBO':
      return mutateDraft(state, (d) => {
        const next: ComboEntry = {
          name: `combo_${d.combos.length + 1}`,
          bindings: { tokens: ['&trans'] },
          keyPositions: [],
          layers: [0],
        }
        d.combos = [...d.combos, next]
      })

    case 'UPDATE_COMBO':
      return mutateDraft(state, (d) => {
        d.combos = d.combos.map((c, i) => (i === action.index ? action.combo : c))
      })

    case 'REMOVE_COMBO':
      return mutateDraft(state, (d) => {
        d.combos = d.combos.filter((_, i) => i !== action.index)
      })

    case 'ADD_MACRO':
      return mutateDraft(state, (d) => {
        const next: MacroEntry = {
          name: `macro_${d.macros.length + 1}`,
          bindingsList: [{ tokens: ['&macro_tap'] }],
          props: [{ name: 'compatible', value: '"zmk,behavior-macro"' }, { name: '#binding-cells', value: '<0>' }],
        }
        d.macros = [...d.macros, next]
      })

    case 'UPDATE_MACRO':
      return mutateDraft(state, (d) => {
        d.macros = d.macros.map((m, i) => (i === action.index ? action.macro : m))
      })

    case 'REMOVE_MACRO':
      return mutateDraft(state, (d) => {
        d.macros = d.macros.filter((_, i) => i !== action.index)
      })

    case 'RENAME_MACRO': {
      const { index, name } = action
      const trimmed = name.trim()
      if (!trimmed) return state
      if (index < 0 || index >= state.draft.macros.length) return state
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return state
      const currentName = state.draft.macros[index].name
      if (trimmed === currentName) return state
      if (state.draft.macros.some((m, i) => i !== index && m.name === trimmed)) {
        return state
      }
      const renamed = renameMacroRefs(state.draft, currentName, trimmed)
      const nextDraft: EditorDraft = {
        ...renamed,
        macros: renamed.macros.map((m, i) =>
          i === index ? { ...m, name: trimmed } : m,
        ),
      }
      return {
        ...state,
        draft: nextDraft,
        past: pushHistory(state.past, state.draft),
        future: [],
      }
    }

    case 'UPDATE_BEHAVIOR':
      return mutateDraft(state, (d) => {
        d.behaviors = d.behaviors.map((b, i) => (i === action.index ? action.behavior : b))
      })

    case 'UPDATE_ROOT_BEHAVIOR':
      return mutateDraft(state, (d) => {
        d.rootBehaviors = d.rootBehaviors.map((b, i) => (i === action.index ? action.cfg : b))
      })

    case 'UPDATE_MOUSE_GESTURE':
      return mutateDraft(state, (d) => {
        d.mouseGestures = d.mouseGestures.map((b, i) => (i === action.index ? action.block : b))
      })

    case 'UNDO': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      // Clamp activeLayerIdx to the restored layers' bounds — UNDOing an
      // ADD_LAYER (or a chain that shortens layers) would otherwise leave
      // activeLayerIdx pointing past the array, which crashes LayersTab's
      // `activeLayer.bindings[k.index]` and manifests as "Undo does
      // nothing" because hono/jsx silently rejects the failed render.
      const maxIdx = Math.max(0, prev.layers.length - 1)
      return {
        ...state,
        draft: prev,
        past: state.past.slice(0, -1),
        future: [...state.future, state.draft],
        activeLayerIdx: Math.min(state.activeLayerIdx, maxIdx),
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[state.future.length - 1]
      // Same clamp as UNDO for the symmetric REDOing-a-REMOVE_LAYER case.
      const maxIdx = Math.max(0, next.layers.length - 1)
      return {
        ...state,
        draft: next,
        past: [...state.past, state.draft],
        future: state.future.slice(0, -1),
        activeLayerIdx: Math.min(state.activeLayerIdx, maxIdx),
      }
    }
  }
}

function mutateDraft(state: EditorState, mutator: (d: EditorDraft) => void): EditorState {
  const next = cloneDraft(state.draft)
  mutator(next)
  return {
    ...state,
    draft: next,
    past: pushHistory(state.past, state.draft),
    future: [],
  }
}

function pushHistory(past: EditorDraft[], current: EditorDraft): EditorDraft[] {
  const appended = [...past, current]
  return appended.length > HISTORY_LIMIT ? appended.slice(-HISTORY_LIMIT) : appended
}

function cloneDraft(d: EditorDraft): EditorDraft {
  return {
    layers: d.layers.map((l) => ({
      name: l.name,
      bindings: l.bindings.map((b) => ({ tokens: [...b.tokens] })),
      sensorBindings: l.sensorBindings
        ? {
            perEncoder: l.sensorBindings.perEncoder.map((b) => ({ tokens: [...b.tokens] })),
          }
        : null,
    })),
    combos: d.combos.map((c) => ({
      name: c.name,
      bindings: { tokens: [...c.bindings.tokens] },
      keyPositions: [...c.keyPositions],
      layers: [...c.layers],
    })),
    macros: d.macros.map((m) => ({
      name: m.name,
      nodeName: m.nodeName,
      bindingsList: m.bindingsList.map((b) => ({ tokens: [...b.tokens] })),
      props: m.props.map((p) => ({ ...p })),
    })),
    behaviors: d.behaviors.map((b) => ({
      name: b.name,
      nodeName: b.nodeName,
      compatible: b.compatible,
      props: b.props.map((p) => ({ ...p })),
      bindings: b.bindings?.map((c) => ({ tokens: [...c.tokens] })),
    })),
    mouseGestures: d.mouseGestures.map((mg) => ({
      kind: mg.kind,
      name: mg.name,
      props: mg.props.map((p) => ({ ...p })),
      entries: mg.entries.map((e) => ({
        name: e.name,
        pattern: e.pattern,
        bindings: { tokens: [...e.bindings.tokens] },
      })),
    })),
    rootBehaviors: d.rootBehaviors.map((rb) => ({
      kind: rb.kind,
      props: rb.props.map((p) => ({ ...p })),
    })),
  }
}
