import { useState } from 'hono/jsx'
import { Button } from '../../../../ui/button'
import { Dialog } from '../../../../ui/dialog'
import { useEditor } from '../../../../core/editor-state/context'

const OUTLINED_ACTION =
  'flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-surface-0 text-[12px] font-medium text-fg-muted text-left transition-colors hover:text-fg hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-0'

/**
 * Left column of the Sensors tab. Shows every layer as a selectable row and
 * exposes bulk operations that scope this tab's edits:
 *   - **Copy from…** — copies another layer's sensor-bindings into the
 *     active layer (`COPY_SENSOR_BINDINGS`).
 *   - **Apply to all layers** — pushes the active layer's sensor-bindings
 *     to every layer, past the confirmation dialog
 *     (`APPLY_SENSOR_BINDINGS_TO_ALL`).
 *
 * Reorder is intentionally omitted here — layer order is edited on the
 * Layers tab and mirroring the drag handle would let two tabs race on the
 * same reducer action.
 */
export function LayerSelectorColumn() {
  const { state, dispatch } = useEditor()
  const layers = state.draft.layers
  const activeIdx = state.activeLayerIdx
  const [copyFromOpen, setCopyFromOpen] = useState(false)
  const [applyAllOpen, setApplyAllOpen] = useState(false)

  const sourceLayers = layers.filter(
    (l, i) => i !== activeIdx && l.sensorBindings !== null,
  )

  return (
    <>
      <aside
        aria-label="Sensors layer selector"
        class="w-[190px] flex-none border-r border-border-subtle p-4 flex flex-col gap-1 overflow-auto"
      >
        <span class="text-[10.5px] font-mono font-semibold tracking-wider text-fg-subtle px-1.5 pb-2">
          EDIT LAYER
        </span>
        {layers.map((l, i) => {
          const isActive = i === activeIdx
          return (
            <button
              key={l.name}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', layerIdx: i })}
              class={[
                'flex items-center gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left',
                isActive
                  ? 'bg-ink text-ink-fg'
                  : 'hover:bg-surface-3 text-fg-muted',
              ].join(' ')}
            >
              <span
                class={[
                  'text-[11px] font-mono font-semibold',
                  isActive ? 'text-[color:var(--color-ink-fg)]/60' : 'text-fg-subtle',
                ].join(' ')}
              >
                {i}
              </span>
              <span
                class={[
                  'text-[13px] leading-none flex-1 truncate',
                  isActive ? 'font-semibold' : 'font-medium',
                ].join(' ')}
              >
                {l.name}
              </span>
            </button>
          )
        })}

        <div class="mt-4 pt-4 border-t border-border-subtle flex flex-col gap-2">
          <span class="text-[11.5px] text-fg-subtle">This layer's config…</span>
          <button
            type="button"
            class={OUTLINED_ACTION}
            disabled={sourceLayers.length === 0}
            onClick={() => setCopyFromOpen(true)}
          >
            <span aria-hidden="true">⇩</span> Copy from…
          </button>
          <button
            type="button"
            class={OUTLINED_ACTION}
            disabled={!layers[activeIdx]?.sensorBindings}
            onClick={() => setApplyAllOpen(true)}
          >
            <span aria-hidden="true">⇅</span> Apply to all layers
          </button>
        </div>
      </aside>

      {copyFromOpen && (
        <Dialog
          open
          onClose={() => setCopyFromOpen(false)}
          size="sm"
          title="Copy sensor-bindings from…"
          description={`Overwrite ${layers[activeIdx]?.name} with another layer's sensor-bindings.`}
          footer={({ close }) => (
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
        >
          {({ runTeardown }) => (
            <div class="flex flex-col gap-1.5">
              {sourceLayers.map((l) => {
                const fromIdx = layers.indexOf(l)
                return (
                  <button
                    key={l.name}
                    type="button"
                    class="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-surface-2 flex items-center gap-3"
                    onClick={() => {
                      runTeardown()
                      dispatch({
                        type: 'COPY_SENSOR_BINDINGS',
                        fromLayerIdx: fromIdx,
                        toLayerIdx: activeIdx,
                      })
                      setCopyFromOpen(false)
                    }}
                  >
                    <span class="text-[11px] font-mono text-fg-subtle w-3">
                      {fromIdx}
                    </span>
                    <span class="text-[13px] font-medium">{l.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Dialog>
      )}

      {applyAllOpen && (
        <Dialog
          open
          onClose={() => setApplyAllOpen(false)}
          size="sm"
          title="Apply to every layer?"
          description={`Copy ${layers[activeIdx]?.name}'s sensor-bindings to every layer. This overwrites all existing per-layer sensor-bindings.`}
          footer={({ close, runTeardown }) => (
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  runTeardown()
                  dispatch({
                    type: 'APPLY_SENSOR_BINDINGS_TO_ALL',
                    fromLayerIdx: activeIdx,
                  })
                  setApplyAllOpen(false)
                }}
              >
                Apply
              </Button>
            </>
          )}
        >
          <span class="sr-only">Apply to every layer</span>
        </Dialog>
      )}
    </>
  )
}
