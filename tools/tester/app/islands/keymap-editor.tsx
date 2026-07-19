import { useEffect, useState } from 'hono/jsx'
import { getBoard } from '../boards/active'
import { Button } from '../ui/button'
import { ToastProvider } from '../ui/toast'
import { NavRail, type NavRailItem } from '../features/editor/shell/nav-rail'
import {
  BehaviorsIcon,
  CombosIcon,
  LayersIcon,
  MacrosIcon,
  MouseGesturesIcon,
  SensorsIcon,
  TesterIcon,
} from '../ui/nav-icons'
import { EditorProvider, useEditor } from '../core/editor-state/context'
import { fetchKeymap } from '../core/editor-state/io'
import { ModalStackProvider, useModalStack } from '../ui/modal-stack'
import { parseKeymap } from '../core/keymap-dt/parse'
import type { EditorDraft, EditorTab } from '../core/editor-state/types'
import { BehaviorsTab } from '../features/editor/tabs/behaviors/behaviors-tab'
import { CombosTab } from '../features/editor/tabs/combos/combos-tab'
import { LayersTab } from '../features/editor/tabs/layers/layers-tab'
import { MacrosTab } from '../features/editor/tabs/macros/macros-tab'
import { MouseGesturesTab } from '../features/editor/tabs/mouse-gestures/mouse-gestures-tab'
import { SaveDialog } from '../features/editor/save/save-dialog'
import { SensorsTab } from '../features/editor/tabs/sensors/sensors-tab'

// The rail is the single source of truth for tab ordering + identity.
// The editor's header title needs a longer human-readable label than the
// 6-char icon rail can fit, so map short → long here rather than teach
// {@link NavRailItem} two labels.
const NAV_ITEMS: NavRailItem[] = [
  { id: 'layers', kind: 'editor-tab', label: 'Layers', Icon: LayersIcon },
  { id: 'combos', kind: 'editor-tab', label: 'Combos', Icon: CombosIcon },
  { id: 'macros', kind: 'editor-tab', label: 'Macros', Icon: MacrosIcon },
  { id: 'behaviors', kind: 'editor-tab', label: 'Behav', Icon: BehaviorsIcon },
  { id: 'sensors', kind: 'editor-tab', label: 'Sensor', Icon: SensorsIcon },
  { id: 'mouse-gestures', kind: 'editor-tab', label: 'Mouse', Icon: MouseGesturesIcon },
  { id: 'tester', kind: 'tester', label: 'Tester', Icon: TesterIcon, href: '/tester' },
]

const EDITOR_TAB_IDS: EditorTab[] = NAV_ITEMS.filter(
  (i): i is NavRailItem & { kind: 'editor-tab' } => i.kind === 'editor-tab',
).map((i) => i.id)

const EDITOR_TAB_HEADER_LABEL: Record<EditorTab, string> = {
  layers: 'Layers',
  combos: 'Combos',
  macros: 'Macros',
  behaviors: 'Behaviors',
  sensors: 'Sensors',
  'mouse-gestures': 'Mouse Gestures',
}

// Subtitle reflects the current draft's shape so the header at a glance
// signals what the tab is looking at (combos, layers, etc.). Per-tab labels
// that describe hardware come from the active board profile so a swap
// picks up its own naming.
function tabSubtitle(activeTab: EditorTab, draft: EditorDraft): string {
  const board = getBoard()
  switch (activeTab) {
    case 'layers':
      return board.branding.subtitle(draft.layers.length)
    case 'combos':
      return draft.combos.length === 1
        ? '1 combo defined'
        : `${draft.combos.length} combos defined`
    case 'macros':
      return draft.macros.length === 1
        ? '1 macro defined'
        : `${draft.macros.length} macros defined`
    case 'behaviors':
      return `${draft.rootBehaviors.length} global · ${draft.behaviors.length} custom`
    case 'sensors':
      return board.branding.encoderLabel
    case 'mouse-gestures':
      return board.branding.gestureLabel
  }
}

function EditorShell() {
  const { state, dispatch } = useEditor()
  const modalStack = useModalStack()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchKeymap()
      .then((r) => {
        if (cancelled) return
        try {
          const parsed = parseKeymap(r.text)
          dispatch({
            type: 'LOAD',
            source: r.text,
            mtimeMs: r.mtimeMs,
            draft: {
              layers: parsed.layers,
              combos: parsed.combos,
              macros: parsed.macros,
              behaviors: parsed.behaviors,
              mouseGestures: parsed.mouseGestures,
              rootBehaviors: parsed.rootBehaviors,
            },
          })
          setLoading(false)
        } catch (err) {
          setLoadError(`Failed to parse keymap: ${(err as Error).message}`)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(`Failed to load keymap: ${(err as Error).message}`)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dispatch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Modal open → hand shortcut to the modal (it owns the focus context).
      if (modalStack.count > 0) return
      // Text inputs handle their own text-editing shortcut semantics.
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      // Redo: Cmd/Ctrl+Shift+Z OR Ctrl+Y
      if ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        dispatch({ type: 'REDO' })
        return
      }
      // Undo: Cmd/Ctrl+Z
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        dispatch({ type: 'UNDO' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, modalStack.count])

  // Warn on tab-close when there are unsaved edits.
  useEffect(() => {
    if (state.past.length === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers ignore returnValue but still show a generic prompt
      // whenever the beforeunload handler calls preventDefault.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.past.length])

  if (loading) {
    return (
      <div class="flex-1 min-h-0 flex items-center justify-center text-fg-muted">
        Loading keymap…
      </div>
    )
  }
  if (loadError) {
    return (
      <div class="flex-1 min-h-0 flex items-center justify-center text-danger p-8">
        {loadError}
      </div>
    )
  }

  const dirty = state.past.length > 0
  const activeLabel = EDITOR_TAB_HEADER_LABEL[state.activeTab] ?? ''
  const activeSubtitle = tabSubtitle(state.activeTab, state.draft)

  const focusTab = (id: EditorTab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tab: id })
    queueMicrotask(() => {
      const el = document.querySelector<HTMLButtonElement>(
        `[data-editor-tab="${id}"]`,
      )
      el?.focus()
    })
  }

  const onRailKeyDown = (e: KeyboardEvent) => {
    if (
      e.key !== 'ArrowUp' &&
      e.key !== 'ArrowDown' &&
      e.key !== 'Home' &&
      e.key !== 'End'
    ) {
      return
    }
    e.preventDefault()
    const currentIdx = EDITOR_TAB_IDS.indexOf(state.activeTab)
    const last = EDITOR_TAB_IDS.length - 1
    let nextIdx = currentIdx
    if (e.key === 'ArrowUp') nextIdx = currentIdx <= 0 ? last : currentIdx - 1
    else if (e.key === 'ArrowDown') nextIdx = currentIdx >= last ? 0 : currentIdx + 1
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = last
    const target = EDITOR_TAB_IDS[nextIdx]
    if (target) focusTab(target)
  }

  return (
    <div class="flex-1 min-h-0 flex bg-surface-0 text-fg overflow-hidden">
      <NavRail
        items={NAV_ITEMS}
        activeId={state.activeTab}
        onSelect={(id) => dispatch({ type: 'SET_ACTIVE_TAB', tab: id })}
        onKeyDown={onRailKeyDown}
      />

      <div class="flex-1 min-w-0 flex flex-col">
        <header class="border-b border-border-subtle px-6 py-3.5 flex items-center justify-between gap-4">
          <div class="flex items-baseline gap-3 min-w-0">
            <h1 class="text-[17px] font-bold m-0 tracking-tight">{activeLabel}</h1>
            <span class="text-xs font-mono text-fg-subtle">{activeSubtitle}</span>
            {dirty && (
              <span
                class="inline-flex items-center gap-1.5 text-xs text-warning"
                aria-live="polite"
                title="You have unsaved edits"
              >
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-warning" />
                Unsaved
              </span>
            )}
          </div>
          <div class="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={state.past.length === 0}
              onClick={() => dispatch({ type: 'UNDO' })}
              title="Undo (⌘Z / Ctrl+Z)"
            >
              ↶ Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={state.future.length === 0}
              onClick={() => dispatch({ type: 'REDO' })}
              title="Redo (⌘⇧Z / Ctrl+Y)"
            >
              ↷ Redo
            </Button>
            <Button size="sm" variant="primary" onClick={() => setSaveDialogOpen(true)}>
              Save…
            </Button>
          </div>
        </header>

        <main
          class="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
          role="tabpanel"
          id={`tabpanel-${state.activeTab}`}
          aria-labelledby={`tab-${state.activeTab}`}
        >
          {state.activeTab === 'layers' && <LayersTab />}
          {state.activeTab === 'combos' && <CombosTab />}
          {state.activeTab === 'macros' && <MacrosTab />}
          {state.activeTab === 'behaviors' && <BehaviorsTab />}
          {state.activeTab === 'sensors' && <SensorsTab />}
          {state.activeTab === 'mouse-gestures' && <MouseGesturesTab />}
        </main>
      </div>

      {saveDialogOpen && <SaveDialog onClose={() => setSaveDialogOpen(false)} />}
    </div>
  )
}

export default function KeymapEditor() {
  return (
    <EditorProvider>
      <ModalStackProvider>
        <ToastProvider>
          <EditorShell />
        </ToastProvider>
      </ModalStackProvider>
    </EditorProvider>
  )
}
