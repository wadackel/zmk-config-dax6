import { useEffect, useRef, useState } from 'hono/jsx'
import { Button } from '../../../../ui/button'
import { CommittingTextInput } from '../../../../ui/field'
import { useEditor } from '../../../../core/editor-state/context'
import { countLayerRefs } from '../../../../core/editor-state/reducer'
import { Dialog } from '../../../../ui/dialog'
import { Field, TextInput } from '../../../../ui/field'

const DT_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

type LayerDialogState =
  | { kind: 'add' }
  | { kind: 'remove'; idx: number }
  | null

/**
 * Vertical layer list with drag-handle reorder, inline rename, add/remove.
 *
 * Reorder uses HTML5 drag-and-drop for pointer users and Alt+Up/Alt+Down for
 * keyboard users — pure HTML5 DnD has poor screen-reader coverage, so the
 * key alternative is exposed via the same handle's `onKeyDown`.
 *
 * Rename uses CommittingTextInput (blur / Enter commits, Esc reverts) so
 * intra-edit typing doesn't spam the undo history — one keystroke pushes one
 * history entry, not one entry per character.
 */
export function LayerList() {
  const { state, dispatch } = useEditor()
  const layers = state.draft.layers
  const activeIdx = state.activeLayerIdx
  const [renaming, setRenaming] = useState<number | null>(null)
  const [layerDialog, setLayerDialog] = useState<LayerDialogState>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  // Position where the drag would drop right now (0..N inclusive; N = end).
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const startRename = (idx: number) => setRenaming(idx)
  const commitRename = (idx: number, name: string) => {
    if (name.trim() !== layers[idx].name) {
      dispatch({ type: 'RENAME_LAYER', idx, name })
    }
    setRenaming(null)
  }

  const onDragStart = (idx: number) => (e: DragEvent) => {
    setDragging(idx)
    e.dataTransfer?.setData('text/plain', String(idx))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOverRow = (idx: number) => (e: DragEvent) => {
    if (dragging === null) return
    e.preventDefault()
    const target = e.currentTarget as HTMLElement | null
    if (!target) return
    const rect = target.getBoundingClientRect()
    const halfway = rect.top + rect.height / 2
    const before = e.clientY < halfway
    setDropTarget(before ? idx : idx + 1)
  }
  const onDrop = () => {
    if (dragging === null || dropTarget === null) {
      setDragging(null)
      setDropTarget(null)
      return
    }
    // MOVE_LAYER expects a slot index, but dropTarget is a between-row
    // insertion point in [0..N]; when dropping past the dragged item the
    // slot shifts left by one because the source will vacate first.
    let toIdx = dropTarget
    if (dropTarget > dragging) toIdx = dropTarget - 1
    if (toIdx !== dragging) {
      dispatch({ type: 'MOVE_LAYER', fromIdx: dragging, toIdx })
    }
    setDragging(null)
    setDropTarget(null)
  }
  const onDragEnd = () => {
    setDragging(null)
    setDropTarget(null)
  }

  const moveByKeyboard = (idx: number, dir: -1 | 1) => {
    const toIdx = idx + dir
    if (toIdx < 0 || toIdx >= layers.length) return
    dispatch({ type: 'MOVE_LAYER', fromIdx: idx, toIdx })
  }

  return (
    <>
      <aside
        aria-label="Layers"
        class="w-[190px] flex-none border-r border-border-subtle p-4 flex flex-col gap-1 overflow-auto"
      >
        <span class="text-[10.5px] font-mono font-semibold tracking-wider text-fg-subtle px-1.5 pb-2">
          LAYERS
        </span>
        {layers.map((l, i) => {
          const isActive = i === activeIdx
          const isRenaming = renaming === i
          // idx 0 (default_layer) is immovable + unrenamable: codegen looks
          // it up by name, ZMK requires it as the base layer. Reducer also
          // rejects these mutations as a second line of defense.
          const isProtected = i === 0
          const showTopDropLine = dropTarget === i && dragging !== null && dragging !== i
          return (
            <div key={l.name}>
              {showTopDropLine && (
                <div class="h-0.5 rounded-full bg-accent mb-1" aria-hidden="true" />
              )}
              <div
                role="button"
                tabIndex={isRenaming ? -1 : 0}
                aria-current={isActive ? 'true' : undefined}
                aria-label={
                  isProtected
                    ? `Layer ${l.name} (locked at position 0)`
                    : `Layer ${l.name}. Enter to select, F2 to rename, Alt+↑/↓ to move`
                }
                draggable={!isRenaming && !isProtected ? 'true' : 'false'}
                onDragStart={onDragStart(i)}
                onDragOver={onDragOverRow(i)}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onClick={() => {
                  if (!isRenaming) dispatch({ type: 'SET_ACTIVE_LAYER', layerIdx: i })
                }}
                onDblClick={() => {
                  if (!isProtected) startRename(i)
                }}
                onKeyDown={(e: KeyboardEvent) => {
                  if (isRenaming) return
                  // Enter / Space activate the row (select layer). F2
                  // starts rename, mirroring the desktop convention users
                  // expect when the row is focused via keyboard.
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    dispatch({ type: 'SET_ACTIVE_LAYER', layerIdx: i })
                    return
                  }
                  if (e.key === 'F2' && !isProtected) {
                    e.preventDefault()
                    startRename(i)
                    return
                  }
                  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault()
                    moveByKeyboard(i, e.key === 'ArrowUp' ? -1 : 1)
                  }
                }}
                class={[
                  'flex items-center gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors',
                  isActive
                    ? 'bg-ink text-ink-fg'
                    : 'hover:bg-surface-3 text-fg-muted',
                  dragging === i ? 'opacity-40' : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-label={
                    isProtected
                      ? `${l.name} is locked at position 0`
                      : `Reorder layer ${l.name}`
                  }
                  title={
                    isProtected
                      ? 'default_layer is fixed at idx 0 (ZMK requirement)'
                      : 'Drag to reorder · Alt+↑/↓ to move'
                  }
                  tabIndex={isProtected ? -1 : 0}
                  disabled={isProtected}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (isProtected) return
                    if (!e.altKey) return
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      moveByKeyboard(i, -1)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      moveByKeyboard(i, 1)
                    }
                  }}
                  class={[
                    'text-[10px] font-mono',
                    isProtected
                      ? 'cursor-not-allowed opacity-30'
                      : 'cursor-grab active:cursor-grabbing',
                    isActive ? 'text-[color:var(--color-ink-fg)]/50' : 'text-fg-subtle',
                  ].join(' ')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="14"
                    viewBox="0 0 10 14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="3" cy="3" r="1" />
                    <circle cx="7" cy="3" r="1" />
                    <circle cx="3" cy="7" r="1" />
                    <circle cx="7" cy="7" r="1" />
                    <circle cx="3" cy="11" r="1" />
                    <circle cx="7" cy="11" r="1" />
                  </svg>
                </button>
                <span
                  class={[
                    'text-[11px] font-mono font-semibold w-3 text-right',
                    isActive ? 'text-[color:var(--color-ink-fg)]/60' : 'text-fg-subtle',
                  ].join(' ')}
                >
                  {i}
                </span>
                {isRenaming ? (
                  <CommittingTextInput
                    value={l.name}
                    onCommit={(name) => commitRename(i, name)}
                    onBlur={() => setRenaming(null)}
                    class="flex-1 min-w-0 !px-1.5 !py-0.5 !text-[13px]"
                    autoFocus
                  />
                ) : (
                  <span
                    class={[
                      'text-[13px] leading-none flex-1 truncate',
                      isActive ? 'font-semibold' : 'font-medium',
                    ].join(' ')}
                  >
                    {l.name}
                  </span>
                )}
                {i !== 0 && !isRenaming && (
                  <button
                    type="button"
                    aria-label={`Remove layer ${l.name}`}
                    title={`Remove layer ${l.name}`}
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      setLayerDialog({ kind: 'remove', idx: i })
                    }}
                    class={[
                      'text-[13px] leading-none px-1 rounded-md transition-colors',
                      isActive
                        ? 'text-[color:var(--color-ink-fg)]/60 hover:text-[color:var(--color-ink-fg)]'
                        : 'text-fg-subtle hover:text-danger',
                    ].join(' ')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {/* Drop line at end of list */}
        {dropTarget === layers.length &&
          dragging !== null &&
          dragging !== layers.length - 1 && (
            <div class="h-0.5 rounded-full bg-accent mt-1" aria-hidden="true" />
          )}

        <Button
          size="sm"
          variant="ghost"
          class="!border-dashed mt-2 justify-center"
          onClick={() => setLayerDialog({ kind: 'add' })}
        >
          + Add layer
        </Button>
      </aside>

      {layerDialog?.kind === 'add' && (
        <AddLayerDialog
          existingNames={layers.map((l) => l.name)}
          defaultName={`Layer${layers.length}`}
          onCancel={() => setLayerDialog(null)}
          onConfirm={(name) => {
            dispatch({ type: 'ADD_LAYER', name })
            setLayerDialog(null)
          }}
        />
      )}
      {layerDialog?.kind === 'remove' && layers[layerDialog.idx] && (
        <RemoveLayerDialog
          idx={layerDialog.idx}
          layerName={layers[layerDialog.idx].name}
          refCount={countLayerRefs(state.draft, layerDialog.idx)}
          onCancel={() => setLayerDialog(null)}
          onConfirm={() => {
            dispatch({ type: 'REMOVE_LAYER', idx: layerDialog.idx })
            setLayerDialog(null)
          }}
        />
      )}
    </>
  )
}

function AddLayerDialog({
  existingNames,
  defaultName,
  onCancel,
  onConfirm,
}: {
  existingNames: string[]
  defaultName: string
  onCancel: () => void
  onConfirm: (name: string) => void
}) {
  const [name, setName] = useState(defaultName)
  const trimmed = name.trim()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const invalidIdent = !DT_IDENT.test(trimmed)
  const duplicate = existingNames.includes(trimmed)
  const error = !trimmed
    ? 'Name required.'
    : invalidIdent
      ? 'DT identifiers must start with a letter/underscore and contain only letters, digits, underscores.'
      : duplicate
        ? `A layer named "${trimmed}" already exists.`
        : undefined
  const canSubmit = !error

  useEffect(() => {
    queueMicrotask(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.select()
    })
  }, [])

  return (
    <Dialog
      open
      onClose={onCancel}
      size="sm"
      title="Add layer"
      description="DT identifier used as the layer node name."
      footer={({ close, runTeardown }) => (
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return
              runTeardown()
              onConfirm(trimmed)
            }}
          >
            Add layer
          </Button>
        </>
      )}
    >
      {({ runTeardown }) => (
        <Field htmlFor="add-layer-name" label="Name" error={error}>
          <TextInput
            id="add-layer-name"
            ref={inputRef as any}
            class="font-mono"
            invalid={!!error && trimmed !== ''}
            value={name}
            onInput={(e: Event) => setName((e.target as HTMLInputElement).value)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!canSubmit) return
                runTeardown()
                onConfirm(trimmed)
              }
            }}
          />
        </Field>
      )}
    </Dialog>
  )
}

function RemoveLayerDialog({
  idx,
  layerName,
  refCount,
  onCancel,
  onConfirm,
}: {
  idx: number
  layerName: string
  refCount: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open
      onClose={onCancel}
      size="sm"
      title={`Remove layer "${layerName}"`}
      hint="esc to cancel"
      footer={({ close, runTeardown }) => (
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              runTeardown()
              onConfirm()
            }}
          >
            Remove
          </Button>
        </>
      )}
    >
      <div class="flex flex-col gap-2 text-sm">
        <p class="m-0">
          <span class="text-fg-subtle">Index </span>
          <span class="font-mono text-fg">{idx}</span>
          <span class="text-fg-subtle"> · </span>
          <span class="text-warning">
            {refCount} reference{refCount === 1 ? '' : 's'}
          </span>
          {refCount > 0 && (
            <span class="text-fg-subtle"> will be replaced with &amp;trans / dropped.</span>
          )}
        </p>
        <p class="text-xs text-fg-subtle m-0">
          Layer indices &gt; {idx} will shift down by 1.
        </p>
      </div>
    </Dialog>
  )
}
