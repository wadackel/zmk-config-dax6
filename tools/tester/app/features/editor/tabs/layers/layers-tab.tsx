import { useEffect, useRef, useState } from 'hono/jsx'
import { KeyCap } from '../../../../ui/key-cap'
import type { KeyCapState } from '../../../../ui/key-cap'
import { useEditor } from '../../../../core/editor-state/context'
import { KEYS } from '../../../../core/layout'
import { KeyboardGrid } from '../../shared/keyboard-view/keyboard-grid'
import type { BindingChain } from '../../../../core/keymap-dt/types'
import type { KeyDef } from '../../../../core/layout'
import { formatBindingForCell, mainLineSizeClass } from '../../../../core/binding-display'
import { BindingDock } from '../../shared/binding-dock/binding-inspector'
import { LayerList } from './layer-list'
import { ExportPanel } from './export-panel'
import { DockShell } from '../../shell/dock-shell'
import {
  applyClickSelection,
  commonChain,
  DRAG_THRESHOLD_PX,
  hitTestCells,
  marqueeSelection,
  normalizeRect,
  resolvePasteEdits,
} from './selection'
import type { Rect } from './selection'

// Monotonic per-mount token. Each LayersTab instance grabs the next value
// from a lazy useState initializer (see below) so incrementing does not
// happen inside a bare render body. Window listeners installed by that
// instance compare against `currentLayersInstance` before running: when
// hono/jsx skips useEffect cleanup on conditional unmount (tab switch),
// the old listener stays in memory but its captured token no longer
// matches, so subsequent keyboard / marquee events on a re-mounted Layers
// tab only reach the newest closure.
let layersInstanceCounter = 0
let currentLayersInstance = 0

const EMPTY_SELECTION: ReadonlySet<number> = new Set()

type ContextMenuState = { x: number; y: number; keyIdx: number } | null

type DragState = {
  startX: number
  startY: number
  additive: boolean
  base: ReadonlySet<number>
  active: boolean
}

// Per-render snapshot read by the window listeners through a ref. The
// listeners themselves subscribe once per mount: re-subscribing on dep
// changes is unsafe here because hono/jsx defers effect runners to the next
// animation frame and replaces still-pending runners on every re-render —
// under rapid renders (marquee mousemove updates selection continuously) a
// replaced runner's listener never gets its cleanup registered, leaking a
// live listener whose closure holds a mid-drag selection.
type LayersSnapshot = {
  exportOpen: boolean
  contextMenu: ContextMenuState
  selection: ReadonlySet<number>
  hoveredKeyIdx: number | null
  closeExport: () => void
  clearSelection: () => void
  setSelection: (keys: ReadonlySet<number>) => void
  doCopy: () => void
  doPaste: (fallbackIdx: number | null) => boolean
}

export function LayersTab() {
  const { state, dispatch } = useEditor()
  // Lazy initializer keeps the counter increment out of speculative render
  // paths; the token stays stable across re-renders of the same mount and
  // a fresh token is only minted when the component actually mounts anew.
  const [instanceToken] = useState(() => ++layersInstanceCounter)
  currentLayersInstance = instanceToken
  // The selection remembers which layer it belongs to and evaporates by
  // derivation when the active layer changes. An effect clearing it on
  // `state.activeLayerIdx` cannot be trusted here: hono/jsx defers queued
  // effect runners to the next update cycle, so the mount-queued runner can
  // fire long after mount and wipe a selection the user just made.
  const [selectionState, setSelectionState] = useState<{
    layer: number
    keys: ReadonlySet<number>
  }>({ layer: 0, keys: EMPTY_SELECTION })
  const [hoveredKeyIdx, setHoveredKeyIdx] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null)
  const exportChipRef = useRef<HTMLButtonElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const latestRef = useRef<LayersSnapshot | null>(null)
  // A completed marquee drag ends with the browser still firing `click` on
  // whatever sits under the pointer; this flag swallows exactly that one
  // click so releasing over a keycap doesn't collapse the fresh selection.
  const suppressClickRef = useRef(false)

  const closeExport = () => {
    setExportOpen(false)
    queueMicrotask(() => exportChipRef.current?.focus())
  }

  const selection =
    selectionState.layer === state.activeLayerIdx ? selectionState.keys : EMPTY_SELECTION
  const setSelection = (keys: ReadonlySet<number>) =>
    setSelectionState({ layer: state.activeLayerIdx, keys })
  const clearSelection = () =>
    setSelectionState({ layer: state.activeLayerIdx, keys: EMPTY_SELECTION })

  const activeLayer = state.draft.layers[state.activeLayerIdx]

  const sortedSelection = [...selection].sort((a, b) => a - b)

  const copyEntries = (idxs: number[]) => {
    if (!activeLayer) return
    const entries = idxs.flatMap((keyIdx) => {
      const src = activeLayer.bindings[keyIdx]
      return src ? [{ keyIdx, chain: { tokens: [...src.tokens] } }] : []
    })
    if (entries.length === 0) return
    dispatch({ type: 'SET_CLIPBOARD', entries })
  }

  const doCopy = () => {
    if (selection.size > 0) copyEntries(sortedSelection)
    else if (hoveredKeyIdx !== null) copyEntries([hoveredKeyIdx])
  }

  const doPaste = (fallbackIdx: number | null) => {
    const edits = resolvePasteEdits(state.clipboard, selection, fallbackIdx)
    if (!edits) return false
    dispatch({ type: 'UPDATE_BINDINGS_BULK', layerIdx: state.activeLayerIdx, edits })
    clearSelection()
    return true
  }

  const doReset = (tokens: string[]) => {
    const targets = selection.size > 0 ? sortedSelection : []
    if (targets.length === 0) return
    dispatch({
      type: 'UPDATE_BINDINGS_BULK',
      layerIdx: state.activeLayerIdx,
      edits: targets.map((keyIdx) => ({ keyIdx, chain: { tokens: [...tokens] } })),
    })
  }

  // Rebuilt every render, so the once-per-mount listeners below always act on
  // the current state and the freshest helper closures (including the
  // post-Undo draft — doCopy/doPaste re-close over `state.draft` each render).
  latestRef.current = {
    exportOpen,
    contextMenu,
    selection,
    hoveredKeyIdx,
    closeExport,
    clearSelection,
    setSelection,
    doCopy,
    doPaste,
  }

  // hono/jsx can invoke the SAME queued effect runner twice when two commits
  // land before one rAF flush (mount + initial LOAD render, e.g.) — the
  // runner's callback slot is only cleared when it executes, so both commits
  // collect it. Without this guard the window listeners below get attached
  // twice and a single keydown is processed twice (an Esc would cancel the
  // drag AND then clear the restored selection in one press).
  const keyListenerAttachedRef = useRef(false)
  const mouseListenersAttachedRef = useRef(false)

  useEffect(() => {
    if (keyListenerAttachedRef.current) return
    keyListenerAttachedRef.current = true
    const myToken = instanceToken
    const onKey = (e: KeyboardEvent) => {
      if (myToken !== currentLayersInstance) return
      const ctx = latestRef.current
      if (!ctx) return
      const layersActive = document
        .querySelector<HTMLElement>('[role="tab"][data-editor-tab="layers"]')
        ?.getAttribute('aria-selected') === 'true'
      if (!layersActive) return
      if (e.key === 'Escape' && ctx.exportOpen) {
        e.preventDefault()
        ctx.closeExport()
        return
      }
      if (e.key === 'Escape' && dragRef.current) {
        e.preventDefault()
        ctx.setSelection(new Set(dragRef.current.base))
        dragRef.current = null
        setMarqueeRect(null)
        return
      }
      // Esc while the Inspector is open clears the selection, which closes
      // the Inspector by derivation — the Inspector itself only intercepts
      // Cmd+Enter, so top-level Esc lives here.
      if (e.key === 'Escape' && ctx.contextMenu === null && ctx.selection.size > 0) {
        e.preventDefault()
        ctx.clearSelection()
        return
      }
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'c' && e.key !== 'v') return
      if (ctx.contextMenu !== null) return
      // Opening the dock autofocuses the keycode input, so a blanket
      // "focused input → native copy/paste" guard would shadow ⌘C/⌘V for
      // every active selection. Only defer to the native behavior when the
      // user is actually working with text: a non-collapsed text selection
      // (or any contentEditable focus). With a collapsed caret, ⌘V still
      // falls through to native paste when the editor clipboard resolves to
      // nothing (doPaste returns false → no preventDefault).
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
        const field = ae as HTMLInputElement | HTMLTextAreaElement
        let collapsed = true
        try {
          collapsed = field.selectionStart === field.selectionEnd
        } catch {
          collapsed = true
        }
        if (!collapsed) return
      } else if (ae?.isContentEditable) {
        return
      }
      if (e.key === 'v') {
        if (ctx.doPaste(ctx.hoveredKeyIdx)) e.preventDefault()
      } else {
        if (ctx.selection.size === 0 && ctx.hoveredKeyIdx === null) return
        e.preventDefault()
        ctx.doCopy()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      keyListenerAttachedRef.current = false
      window.removeEventListener('keydown', onKey)
    }
  }, [instanceToken])

  useEffect(() => {
    if (mouseListenersAttachedRef.current) return
    mouseListenersAttachedRef.current = true
    const myToken = instanceToken
    // Same instance-token guard as the keydown listener above — a leaked
    // mousemove listener firing against a stale closure is far noisier than
    // a leaked keydown, so this guard is load-bearing here.
    const onMove = (e: MouseEvent) => {
      if (myToken !== currentLayersInstance) return
      const drag = dragRef.current
      if (!drag) return
      if (!drag.active) {
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        drag.active = true
        suppressClickRef.current = true
      }
      e.preventDefault()
      const rect = normalizeRect(
        { x: drag.startX, y: drag.startY },
        { x: e.clientX, y: e.clientY },
      )
      setMarqueeRect(rect)
      const board = boardRef.current
      if (!board) return
      const cells = Array.from(board.querySelectorAll<HTMLElement>('[data-key]')).map((el) => {
        const r = el.getBoundingClientRect()
        return {
          idx: Number(el.getAttribute('data-key')),
          rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        }
      })
      latestRef.current?.setSelection(
        marqueeSelection(drag.base, hitTestCells(rect, cells), drag.additive),
      )
    }
    const onUp = () => {
      if (myToken !== currentLayersInstance) return
      if (!dragRef.current) return
      dragRef.current = null
      setMarqueeRect(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      mouseListenersAttachedRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [instanceToken])

  useEffect(() => {
    if (!contextMenu) return
    const myToken = instanceToken
    // Same instance-token guard as the copy/paste keydown listener above:
    // hono/jsx skipping cleanup on conditional unmount would otherwise leak
    // these mousedown / scroll listeners across tab switches and let stale
    // closures fire against a re-mounted LayersTab.
    const close = () => {
      if (myToken !== currentLayersInstance) return
      setContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (myToken !== currentLayersInstance) return
      const layersActive = document
        .querySelector<HTMLElement>('[role="tab"][data-editor-tab="layers"]')
        ?.getAttribute('aria-selected') === 'true'
      if (!layersActive) return
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu, instanceToken])

  if (state.draft.layers.length === 0) {
    return <div class="text-fg-subtle text-sm">No layers loaded.</div>
  }

  const clipboardEntries = state.clipboard?.entries ?? null
  const clipboardPreview = clipboardEntries
    ? clipboardEntries.length === 1
      ? clipboardEntries[0].chain.tokens.join(' ')
      : `${clipboardEntries.length} keys`
    : ''

  const onBoardMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    if (contextMenu) return
    // A drag that ended outside the board never gets its click swallowed
    // here, so the flag could survive into the next interaction — reset it
    // at the start of every fresh press instead of on a timer.
    suppressClickRef.current = false
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      additive: e.shiftKey || e.metaKey || e.ctrlKey,
      base: selection,
      active: false,
    }
  }

  const onBoardClick = (e: MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-key]')) return
    if (e.shiftKey || e.metaKey || e.ctrlKey) return
    clearSelection()
  }

  const onKeyCellClick = (e: MouseEvent, keyIdx: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setSelection(
      applyClickSelection(selection, keyIdx, {
        shift: e.shiftKey,
        toggle: e.metaKey || e.ctrlKey,
      }),
    )
  }

  const renderKeyCell = (k: KeyDef) => {
    const binding = activeLayer.bindings[k.index]
    const display = binding
      ? formatBindingForCell(binding)
      : { topLine: '', mainLine: '', faint: true }
    const isHovered = hoveredKeyIdx === k.index
    const isSelected = selection.has(k.index)
    const isTrans =
      binding && binding.tokens.length === 1 && binding.tokens[0] === '&trans'
    const isMod =
      binding &&
      binding.tokens.length > 0 &&
      binding.tokens[0].startsWith('&') &&
      binding.tokens[0] !== '&kp' &&
      binding.tokens[0] !== '&trans' &&
      binding.tokens[0] !== '&none'
    const capState: KeyCapState = isSelected
      ? 'selected'
      : isHovered
        ? 'hover'
        : isTrans
          ? 'trans'
          : isMod
            ? 'mod'
            : 'idle'
    const mainColor = display.faint ? 'text-fg-subtle' : 'text-fg'
    return (
      <KeyCap
        state={capState}
        asButton
        hoverable
        interactive
        class="relative"
        title={binding ? binding.tokens.join(' ') : ''}
        onClick={(e: MouseEvent) => onKeyCellClick(e, k.index)}
        onMouseEnter={() => setHoveredKeyIdx(k.index)}
        onMouseLeave={() => setHoveredKeyIdx((cur) => (cur === k.index ? null : cur))}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault()
          if (!selection.has(k.index)) setSelection(new Set([k.index]))
          setContextMenu({ x: e.clientX, y: e.clientY, keyIdx: k.index })
        }}
      >
        {display.topLine && (
          <span class="absolute top-0.5 inset-x-1 text-[8px] text-fg-subtle leading-none truncate text-left">
            {display.topLine}
          </span>
        )}
        <span class={`${mainLineSizeClass(display.mainLine)} ${mainColor}`}>
          {display.mainLine}
        </span>
        {display.subLine && (
          <span class="absolute bottom-0.5 inset-x-1 text-[8px] text-fg-subtle leading-none truncate">
            {display.subLine}
          </span>
        )}
      </KeyCap>
    )
  }

  const sharedChain = commonChain(activeLayer.bindings, selection)
  const contextTargets = selection.size > 1 ? selection.size : 1
  const canPaste =
    contextMenu !== null &&
    resolvePasteEdits(state.clipboard, selection, contextMenu.keyIdx) !== null

  return (
    <div class="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-0">
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <LayerList />
        <div class="flex-1 bg-surface-3 flex flex-col min-w-0 overflow-auto">
          <BoardHeader
            layerName={activeLayer.name}
            layerIdx={state.activeLayerIdx}
            clipboardPreview={clipboardPreview}
            onClearClipboard={() => dispatch({ type: 'SET_CLIPBOARD', entries: null })}
            exportOpen={exportOpen}
            onToggleExport={() => setExportOpen((v) => !v)}
            exportChipRef={exportChipRef}
          />
          <div
            ref={boardRef}
            class="flex-1 flex items-center justify-center px-8 py-6 min-w-0"
            onMouseDown={onBoardMouseDown}
            onClick={onBoardClick}
          >
            <KeyboardGrid keys={KEYS} renderCell={renderKeyCell} />
          </div>
        </div>
        {exportOpen && (
          <ExportPanel
            layers={state.draft.layers}
            draft={state.draft}
            onClose={closeExport}
          />
        )}
      </div>

      <DockShell ariaLabel="Layers binding editor">
        {/* While a marquee drag is live the selection changes on every
            mousemove; mounting the dock then would remount it (and its
            autofocused keycode popover) per move — the popover also swallows
            the first Esc, delaying drag-cancel by one keypress. Mount once,
            after the drag settles. */}
        {selection.size > 0 && marqueeRect === null ? (
          <BindingDock
            key={`${state.activeLayerIdx}:${sortedSelection.join(',')}`}
            keyIdx={selection.size === 1 ? sortedSelection[0] : -1}
            targetLabel={selection.size > 1 ? `${selection.size} keys` : undefined}
            targetSubtitle={
              selection.size > 1
                ? (sharedChain ? sharedChain.tokens.join(' ') : 'mixed bindings')
                : undefined
            }
            initial={
              selection.size === 1
                ? (activeLayer.bindings[sortedSelection[0]] ?? { tokens: [] })
                : (sharedChain ?? { tokens: [] })
            }
            onCancel={clearSelection}
            onCommit={(chain) => {
              dispatch({
                type: 'UPDATE_BINDINGS_BULK',
                layerIdx: state.activeLayerIdx,
                edits: sortedSelection.map((keyIdx) => ({ keyIdx, chain })),
              })
              clearSelection()
            }}
          />
        ) : (
          <DockEmptyState />
        )}
      </DockShell>

      {marqueeRect && (
        <div
          class="fixed z-30 border border-accent bg-[rgb(79_91_107/0.08)] pointer-events-none"
          style={`left: ${marqueeRect.left}px; top: ${marqueeRect.top}px; width: ${marqueeRect.right - marqueeRect.left}px; height: ${marqueeRect.bottom - marqueeRect.top}px;`}
          aria-hidden="true"
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetCount={contextTargets}
          clipboardPreview={clipboardPreview}
          canPaste={canPaste}
          onEdit={() => setContextMenu(null)}
          onCopy={() => {
            copyEntries(selection.size > 0 ? sortedSelection : [contextMenu.keyIdx])
            setContextMenu(null)
          }}
          onPaste={() => {
            doPaste(contextMenu.keyIdx)
            setContextMenu(null)
          }}
          onResetTrans={() => {
            doReset(['&trans'])
            setContextMenu(null)
          }}
          onResetNone={() => {
            doReset(['&none'])
            setContextMenu(null)
          }}
        />
      )}
    </div>
  )
}

function DockEmptyState() {
  return (
    <div class="flex items-center gap-4 min-h-[68px]">
      <div class="w-[58px] h-[58px] flex-none border-[1.5px] border-dashed border-[rgba(22,24,29,.2)] rounded-[7px] flex items-center justify-center box-border">
        <span
          class="w-[16px] h-[16px] border-2 border-fg-subtler rounded-[4px] inline-block"
          aria-hidden="true"
        />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[13.5px] font-semibold text-fg-muted leading-none">
          No key selected
        </span>
        <span class="text-[12px] text-fg-subtle leading-[1.5]">
          Click a keycap — drag or shift-click to select several and edit them
          at once. Copy / paste a selection with{' '}
          <kbd class="inline-block px-[4px] py-[1px] font-mono font-semibold text-[10.5px] leading-none text-fg-muted bg-[rgba(22,24,29,.05)] rounded-[3px]">
            ⌘C
          </kbd>{' '}
          <kbd class="inline-block px-[4px] py-[1px] font-mono font-semibold text-[10.5px] leading-none text-fg-muted bg-[rgba(22,24,29,.05)] rounded-[3px]">
            ⌘V
          </kbd>
          .
        </span>
      </div>
    </div>
  )
}

type BoardHeaderProps = {
  layerName: string
  layerIdx: number
  clipboardPreview: string
  onClearClipboard: () => void
  exportOpen: boolean
  onToggleExport: () => void
  exportChipRef: { current: HTMLButtonElement | null }
}

function BoardHeader({
  layerName,
  layerIdx,
  clipboardPreview,
  onClearClipboard,
  exportOpen,
  onToggleExport,
  exportChipRef,
}: BoardHeaderProps) {
  return (
    <div class="flex items-center justify-between px-6 py-3 border-b border-border-subtle gap-4 flex-wrap">
      <div class="flex items-center gap-3">
        <span class="text-[14px] font-semibold text-fg">{layerName}</span>
        <span class="text-[11px] font-mono text-fg-subtle">layer {layerIdx}</span>
      </div>
      <div class="flex items-center gap-4">
        <Legend />
        <span class="w-px h-4 bg-border" aria-hidden="true" />
        {clipboardPreview && (
          <span
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/30 bg-success-soft text-[11.5px] font-mono text-success"
            title="Editor clipboard — ⌘V to paste"
          >
            <span class="uppercase tracking-wide font-semibold">Clip</span>
            <span class="text-fg">{clipboardPreview}</span>
            <button
              type="button"
              onClick={onClearClipboard}
              class="text-fg-subtle hover:text-fg"
              aria-label="Clear clipboard"
              title="Clear clipboard"
            >
              ×
            </button>
          </span>
        )}
        <button
          type="button"
          ref={exportChipRef}
          aria-pressed={exportOpen ? 'true' : 'false'}
          onClick={onToggleExport}
          title="Export layers as PNG"
          class={[
            'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[12.5px] transition-colors',
            exportOpen
              ? 'bg-accent text-accent-fg border-accent shadow-[0_1px_2px_rgb(79_91_107/0.35)]'
              : 'bg-surface-0 border-border text-fg-muted hover:text-fg hover:bg-surface-2',
          ].join(' ')}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M8 2v7M5 6.5 8 9.5 11 6.5M3 12h10" />
          </svg>
          Export image
        </button>
      </div>
    </div>
  )
}

/**
 * Cap-color legend rendered next to the layer name — matches the redesign's
 * `&kp` / mod / `&trans` swatches so users can decode the board at a glance.
 */
function Legend() {
  const items = [
    { swatch: 'bg-[color:var(--color-keycap-idle)] border-border', label: '&kp' },
    { swatch: 'bg-[color:var(--color-keycap-mod)] border-border', label: 'mod / layer-tap' },
    { swatch: 'bg-[color:var(--color-keycap-trans)] border-border-strong', label: '&trans' },
  ]
  return (
    <div class="flex items-center gap-4 text-[11px] text-fg-subtle">
      {items.map((it) => (
        <span key={it.label} class="inline-flex items-center gap-2">
          <span
            class={['w-3 h-3 rounded-sm border', it.swatch].join(' ')}
            aria-hidden="true"
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}

type ContextMenuProps = {
  x: number
  y: number
  targetCount: number
  clipboardPreview: string
  canPaste: boolean
  onEdit: () => void
  onCopy: () => void
  onPaste: () => void
  onResetTrans: () => void
  onResetNone: () => void
}

function ContextMenu({
  x,
  y,
  targetCount,
  clipboardPreview,
  canPaste,
  onEdit,
  onCopy,
  onPaste,
  onResetTrans,
  onResetNone,
}: ContextMenuProps) {
  const stop = (e: Event) => e.stopPropagation()
  const many = targetCount > 1
  return (
    <div
      class="fixed z-40 min-w-[240px] bg-surface-0 border border-border rounded-lg shadow-popover py-1 text-xs"
      style={`top: ${y}px; left: ${x}px;`}
      onMouseDown={stop}
      onClick={stop}
      role="menu"
    >
      <MenuItem onSelect={onEdit}>Edit binding…</MenuItem>
      <div class="border-t border-border-subtle my-1" />
      <MenuItem onSelect={onCopy} shortcut="⌘C">
        {many ? `Copy ${targetCount} bindings` : 'Copy binding'}
      </MenuItem>
      <MenuItem onSelect={onPaste} shortcut="⌘V" disabled={!canPaste}>
        {canPaste ? `Paste — ${clipboardPreview}` : 'Paste (empty)'}
      </MenuItem>
      <div class="border-t border-border-subtle my-1" />
      <MenuItem onSelect={onResetTrans}>
        {many ? `Reset ${targetCount} keys to &trans` : 'Reset to &trans'}
      </MenuItem>
      <MenuItem onSelect={onResetNone}>
        {many ? `Reset ${targetCount} keys to &none` : 'Reset to &none'}
      </MenuItem>
    </div>
  )
}

function MenuItem({
  onSelect,
  disabled,
  shortcut,
  children,
}: {
  onSelect: () => void
  disabled?: boolean
  shortcut?: string
  children: unknown
}) {
  return (
    <button
      type="button"
      role="menuitem"
      class={[
        'w-full flex items-center justify-between gap-4 px-3 py-1.5 text-left',
        disabled
          ? 'text-fg-subtle cursor-not-allowed'
          : 'text-fg hover:bg-surface-2 cursor-pointer',
      ].join(' ')}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect()
      }}
    >
      <span>{children}</span>
      {shortcut && <span class="text-fg-subtle text-[10px]">{shortcut}</span>}
    </button>
  )
}
