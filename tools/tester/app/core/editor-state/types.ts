// Editor-side domain state. Wraps the parsed keymap with a draft we can mutate
// before sending it to the server.

import type {
  BehaviorEntry,
  BindingChain,
  ComboEntry,
  LayerData,
  MacroEntry,
  MouseGestureBlock,
  RootBehaviorConfig,
} from '../keymap-dt/types'

export type EditorTab =
  | 'layers'
  | 'combos'
  | 'macros'
  | 'behaviors'
  | 'sensors'
  | 'mouse-gestures'

export type EditorDraft = {
  layers: LayerData[]
  combos: ComboEntry[]
  macros: MacroEntry[]
  behaviors: BehaviorEntry[]
  mouseGestures: MouseGestureBlock[]
  rootBehaviors: RootBehaviorConfig[]
}

export type EditorState = {
  /** Source text on disk when we last loaded; used by the IO layer to compute the patched output. */
  baselineSource: string
  /** mtimeMs from the GET; sent back via If-Match on PUT. */
  baselineMtimeMs: number
  /** Current editable draft. */
  draft: EditorDraft
  /** Undo stack (last N states). Latest is at the end. */
  past: EditorDraft[]
  /** Redo stack. */
  future: EditorDraft[]
  /** Active editor tab. */
  activeTab: EditorTab
  /** Layer index currently being displayed/edited in the layers tab. */
  activeLayerIdx: number
  /**
   * Editor-internal clipboard for cell binding chains, OS-clipboard-like.
   * Populated by Copy on a layer cell; consumed by Paste via UPDATE_BINDING.
   * Not persisted across page reloads; survives Save → LOAD round-trips.
   */
  clipboard: BindingChain | null
}

export type EditorAction =
  | { type: 'LOAD'; source: string; mtimeMs: number; draft: EditorDraft }
  | { type: 'SAVE_COMMIT'; source: string; mtimeMs: number; draft: EditorDraft }
  | { type: 'SET_ACTIVE_TAB'; tab: EditorTab }
  | { type: 'SET_ACTIVE_LAYER'; layerIdx: number }
  | { type: 'ADD_LAYER'; name: string }
  | { type: 'REMOVE_LAYER'; idx: number }
  | { type: 'MOVE_LAYER'; fromIdx: number; toIdx: number }
  | { type: 'RENAME_LAYER'; idx: number; name: string }
  | { type: 'SET_CLIPBOARD'; chain: BindingChain | null }
  | { type: 'UPDATE_BINDING'; layerIdx: number; keyIdx: number; chain: BindingChain }
  | {
      type: 'UPDATE_BINDINGS_BULK'
      layerIdx: number
      edits: Array<{ keyIdx: number; chain: BindingChain }>
    }
  | { type: 'UPDATE_SENSOR_BINDING'; layerIdx: number; encoderIdx: number; chain: BindingChain }
  | { type: 'INSERT_SENSOR_BINDING'; layerIdx: number }
  | { type: 'REMOVE_SENSOR_BINDING'; layerIdx: number }
  | { type: 'SWAP_SENSOR_BINDING_ARGS'; layerIdx: number; encoderIdx: number }
  | { type: 'COPY_SENSOR_BINDINGS'; fromLayerIdx: number; toLayerIdx: number }
  | { type: 'APPLY_SENSOR_BINDINGS_TO_ALL'; fromLayerIdx: number }
  | { type: 'ADD_COMBO' }
  | { type: 'UPDATE_COMBO'; index: number; combo: ComboEntry }
  | { type: 'REMOVE_COMBO'; index: number }
  | { type: 'ADD_MACRO' }
  | { type: 'UPDATE_MACRO'; index: number; macro: MacroEntry }
  | { type: 'REMOVE_MACRO'; index: number }
  | { type: 'RENAME_MACRO'; index: number; name: string }
  | { type: 'UPDATE_BEHAVIOR'; index: number; behavior: BehaviorEntry }
  | { type: 'UPDATE_ROOT_BEHAVIOR'; index: number; cfg: RootBehaviorConfig }
  | { type: 'UPDATE_MOUSE_GESTURE'; index: number; block: MouseGestureBlock }
  | { type: 'UNDO' }
  | { type: 'REDO' }

export const HISTORY_LIMIT = 50
