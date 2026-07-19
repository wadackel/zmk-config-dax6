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

// Monotonic per-mount token. Each LayersTab instance grabs the next value
// from a lazy useState initializer (see below) so incrementing does not
// happen inside a bare render body. Window listeners installed by that
// instance compare against `currentLayersInstance` before running: when
// hono/jsx skips useEffect cleanup on conditional unmount (tab switch),
// the old listener stays in memory but its captured token no longer
// matches, so subsequent Cmd+C / Cmd+V events on a re-mounted Layers tab
// only reach the newest closure.
let layersInstanceCounter = 0
let currentLayersInstance = 0

type ContextMenuState = { x: number; y: number; keyIdx: number } | null
type EditMode = 'edit' | 'copy'

export function LayersTab() {
  const { state, dispatch } = useEditor()
  // Lazy initializer keeps the counter increment out of speculative render
  // paths; the token stays stable across re-renders of the same mount and
  // a fresh token is only minted when the component actually mounts anew.
  const [instanceToken] = useState(() => ++layersInstanceCounter)
  currentLayersInstance = instanceToken
  const [selectedKeyIdx, setSelectedKeyIdx] = useState<number | null>(null)
  const [hoveredKeyIdx, setHoveredKeyIdx] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [mode, setMode] = useState<EditMode>('edit')
  const [exportOpen, setExportOpen] = useState(false)
  const exportChipRef = useRef<HTMLButtonElement | null>(null)

  const closeExport = () => {
    setExportOpen(false)
    queueMicrotask(() => exportChipRef.current?.focus())
  }
  // Paste-target selection used in Copy mode: click toggles membership, then
  // Cmd/Ctrl+V commits a single bulk paste to every selected cell.
  const [selectedKeyIdxs, setSelectedKeyIdxs] = useState<Set<number>>(new Set())

  const clearSelection = () => setSelectedKeyIdxs(new Set())
  const toggleSelected = (idx: number) =>
    setSelectedKeyIdxs((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })

  useEffect(() => {
    if (mode === 'edit') clearSelection()
  }, [mode])
  useEffect(() => {
    clearSelection()
    setSelectedKeyIdx(null)
  }, [state.activeLayerIdx])

  const activeLayer = state.draft.layers[state.activeLayerIdx]

  const doCopy = (keyIdx: number) => {
    if (!activeLayer) return
    const src = activeLayer.bindings[keyIdx]
    if (!src) return
    dispatch({ type: 'SET_CLIPBOARD', chain: { tokens: [...src.tokens] } })
  }

  const doPaste = (keyIdx: number) => {
    if (!state.clipboard) return
    dispatch({
      type: 'UPDATE_BINDING',
      layerIdx: state.activeLayerIdx,
      keyIdx,
      chain: { tokens: [...state.clipboard.tokens] },
    })
  }

  const doReset = (keyIdx: number, tokens: string[]) => {
    dispatch({
      type: 'UPDATE_BINDING',
      layerIdx: state.activeLayerIdx,
      keyIdx,
      chain: { tokens: [...tokens] },
    })
  }

  const pasteToSelection = () => {
    if (!state.clipboard || selectedKeyIdxs.size === 0) return
    const chain: BindingChain = { tokens: [...state.clipboard.tokens] }
    dispatch({
      type: 'UPDATE_BINDINGS_BULK',
      layerIdx: state.activeLayerIdx,
      edits: Array.from(selectedKeyIdxs).map((keyIdx) => ({ keyIdx, chain })),
    })
    clearSelection()
  }

  useEffect(() => {
    const myToken = instanceToken
    const onKey = (e: KeyboardEvent) => {
      if (myToken !== currentLayersInstance) return
      const layersActive = document
        .querySelector<HTMLElement>('[role="tab"][data-editor-tab="layers"]')
        ?.getAttribute('aria-selected') === 'true'
      if (!layersActive) return
      if (e.key === 'Escape' && exportOpen) {
        e.preventDefault()
        closeExport()
        return
      }
      if (
        e.key === 'Escape' &&
        selectedKeyIdx === null &&
        contextMenu === null
      ) {
        if (selectedKeyIdxs.size > 0) {
          e.preventDefault()
          clearSelection()
          return
        }
        if (mode === 'copy') {
          e.preventDefault()
          setMode('edit')
          return
        }
      }
      // Esc while Inspector is open closes the Inspector — the Inspector
      // itself only intercepts Cmd+Enter, so top-level Esc lives here.
      if (e.key === 'Escape' && selectedKeyIdx !== null) {
        e.preventDefault()
        setSelectedKeyIdx(null)
        return
      }
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'c' && e.key !== 'v') return
      if (contextMenu !== null) return
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
        return
      }
      if (e.key === 'v') {
        if (state.clipboard && selectedKeyIdxs.size > 0) {
          e.preventDefault()
          pasteToSelection()
          return
        }
        if (hoveredKeyIdx === null) return
        e.preventDefault()
        doPaste(hoveredKeyIdx)
      } else {
        if (hoveredKeyIdx === null) return
        e.preventDefault()
        doCopy(hoveredKeyIdx)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    hoveredKeyIdx,
    selectedKeyIdx,
    contextMenu,
    state.clipboard,
    state.activeLayerIdx,
    // `state.draft.layers` reference changes after Undo/Redo/SAVE_COMMIT/LOAD;
    // without it the effect keeps a closure over the pre-Undo bindings, so
    // Undo → hover → Cmd+C copies the wrong (post-Undo) draft's value.
    state.draft.layers,
    mode,
    selectedKeyIdxs,
    instanceToken,
    exportOpen,
  ])

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

  const clipboardPreview = state.clipboard?.tokens.join(' ') ?? ''

  const onKeyCellClick = (keyIdx: number) => {
    if (mode === 'copy') {
      if (state.clipboard === null) doCopy(keyIdx)
      else toggleSelected(keyIdx)
    } else {
      setSelectedKeyIdx(keyIdx)
    }
  }

  const renderKeyCell = (k: KeyDef) => {
    const binding = activeLayer.bindings[k.index]
    const display = binding
      ? formatBindingForCell(binding)
      : { topLine: '', mainLine: '', faint: true }
    const isHovered = hoveredKeyIdx === k.index
    const isCopySelected = selectedKeyIdxs.has(k.index)
    const isEditSelected = selectedKeyIdx === k.index
    const isTrans =
      binding && binding.tokens.length === 1 && binding.tokens[0] === '&trans'
    const isMod =
      binding &&
      binding.tokens.length > 0 &&
      binding.tokens[0].startsWith('&') &&
      binding.tokens[0] !== '&kp' &&
      binding.tokens[0] !== '&trans' &&
      binding.tokens[0] !== '&none'
    const capState: KeyCapState = isEditSelected
      ? 'selected'
      : isCopySelected
        ? 'clip-target'
        : isHovered
          ? mode === 'copy'
            ? state.clipboard
              ? 'clip-target'
              : 'clip-source'
            : 'hover'
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
        onClick={() => onKeyCellClick(k.index)}
        onMouseEnter={() => setHoveredKeyIdx(k.index)}
        onMouseLeave={() => setHoveredKeyIdx((cur) => (cur === k.index ? null : cur))}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault()
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

  const selectedBinding =
    selectedKeyIdx !== null ? activeLayer.bindings[selectedKeyIdx] : null

  return (
    <div class="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-0">
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <LayerList />
        <div class="flex-1 bg-surface-3 flex flex-col min-w-0 overflow-auto">
          <BoardHeader
            layerName={activeLayer.name}
            layerIdx={state.activeLayerIdx}
            mode={mode}
            onToggleMode={() => setMode((m) => (m === 'copy' ? 'edit' : 'copy'))}
            clipboardPreview={clipboardPreview}
            selectedCount={selectedKeyIdxs.size}
            onClearClipboard={() => dispatch({ type: 'SET_CLIPBOARD', chain: null })}
            exportOpen={exportOpen}
            onToggleExport={() => setExportOpen((v) => !v)}
            exportChipRef={exportChipRef}
          />
          <div class="flex-1 flex items-center justify-center px-8 py-6 min-w-0">
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
        {selectedBinding && selectedKeyIdx !== null ? (
          <BindingDock
            key={selectedKeyIdx}
            keyIdx={selectedKeyIdx}
            initial={selectedBinding}
            onCancel={() => setSelectedKeyIdx(null)}
            onCommit={(chain) => {
              dispatch({
                type: 'UPDATE_BINDING',
                layerIdx: state.activeLayerIdx,
                keyIdx: selectedKeyIdx,
                chain,
              })
              setSelectedKeyIdx(null)
            }}
          />
        ) : (
          <DockEmptyState />
        )}
      </DockShell>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipboardPreview={clipboardPreview}
          canPaste={state.clipboard !== null}
          onEdit={() => {
            setSelectedKeyIdx(contextMenu.keyIdx)
            setContextMenu(null)
          }}
          onCopy={() => {
            doCopy(contextMenu.keyIdx)
            setContextMenu(null)
          }}
          onPaste={() => {
            doPaste(contextMenu.keyIdx)
            setContextMenu(null)
          }}
          onResetTrans={() => {
            doReset(contextMenu.keyIdx, ['&trans'])
            setContextMenu(null)
          }}
          onResetNone={() => {
            doReset(contextMenu.keyIdx, ['&none'])
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
          Click a keycap on the board — or press{' '}
          <kbd class="inline-block px-[4px] py-[1px] font-mono font-semibold text-[10.5px] leading-none text-fg-muted bg-[rgba(22,24,29,.05)] rounded-[3px]">
            ↵
          </kbd>
          {' '}to edit the focused key. Copy mode lets you paste to many at once.
        </span>
      </div>
    </div>
  )
}

type BoardHeaderProps = {
  layerName: string
  layerIdx: number
  mode: EditMode
  onToggleMode: () => void
  clipboardPreview: string
  selectedCount: number
  onClearClipboard: () => void
  exportOpen: boolean
  onToggleExport: () => void
  exportChipRef: { current: HTMLButtonElement | null }
}

function BoardHeader({
  layerName,
  layerIdx,
  mode,
  onToggleMode,
  clipboardPreview,
  selectedCount,
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
        <button
          type="button"
          aria-pressed={mode === 'copy' ? 'true' : 'false'}
          onClick={onToggleMode}
          class={[
            'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[12.5px] transition-colors',
            mode === 'copy'
              ? 'bg-accent text-accent-fg border-accent shadow-[0_1px_2px_rgb(79_91_107/0.35)]'
              : 'bg-surface-0 border-border text-fg-muted hover:text-fg hover:bg-surface-2',
          ].join(' ')}
          title={
            mode === 'copy'
              ? 'Click to exit copy mode (Esc)'
              : 'Click cells to copy/paste instead of opening the picker'
          }
        >
          <span
            class={[
              'w-[11px] h-[11px] border-2 rounded-full inline-block',
              mode === 'copy' ? 'border-accent-fg' : 'border-fg-subtle',
            ].join(' ')}
            aria-hidden="true"
          />
          {mode === 'copy'
            ? clipboardPreview
              ? selectedCount > 0
                ? `Paste to ${selectedCount} · ⌘V`
                : 'Pick targets'
              : 'Pick source'
            : 'Copy mode'}
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
  clipboardPreview,
  canPaste,
  onEdit,
  onCopy,
  onPaste,
  onResetTrans,
  onResetNone,
}: ContextMenuProps) {
  const stop = (e: Event) => e.stopPropagation()
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
        Copy binding
      </MenuItem>
      <MenuItem onSelect={onPaste} shortcut="⌘V" disabled={!canPaste}>
        {canPaste ? `Paste — ${clipboardPreview}` : 'Paste (empty)'}
      </MenuItem>
      <div class="border-t border-border-subtle my-1" />
      <MenuItem onSelect={onResetTrans}>Reset to &amp;trans</MenuItem>
      <MenuItem onSelect={onResetNone}>Reset to &amp;none</MenuItem>
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
