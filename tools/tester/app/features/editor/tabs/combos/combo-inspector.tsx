import { useState } from 'hono/jsx'
import { CommittingTextInput } from '../../../../ui/field'
import { CombosIcon } from '../../../../ui/nav-icons'
import { BindingDock } from '../../shared/binding-dock/binding-inspector'
import type { BindingChain, ComboEntry, LayerData } from '../../../../core/keymap-dt/types'

export type ComboDockProps = {
  combo: ComboEntry
  layers: LayerData[]
  pickMode: boolean
  onChange: (next: ComboEntry) => void
  onRemove: () => void
  onEnterPickMode: () => void
  onExitPickMode: () => void
}

/**
 * Bottom-dock Combo editor. Fields flow horizontally:
 *   - Identity (icon + combo name + Delete link + summary) — left
 *   - Name, Binding trigger, Key positions chips, Target layers — center
 *   - No explicit action buttons (auto-committed via onChange) — right slot
 *     left empty so the DockShell divider still frames the row.
 *
 * `timeout-ms` and `require-prior-idle-ms` are absent by design: our
 * parser/serializer does not round-trip those properties yet, so the
 * dock avoids exposing values the reducer would silently drop.
 *
 * When the user clicks the Binding button we swap in a `BindingDock`
 * (dock variant) that reuses the parent DockShell — the caller checks the
 * `editingBinding` state via a render-prop-shaped return to decide which
 * body to draw.
 */
export function ComboDock({
  combo,
  layers,
  pickMode,
  onChange,
  onRemove,
  onEnterPickMode,
  onExitPickMode,
}: ComboDockProps) {
  const [editingBinding, setEditingBinding] = useState(false)

  const commitBinding = (chain: BindingChain) => {
    onChange({ ...combo, bindings: chain })
    setEditingBinding(false)
  }

  if (editingBinding) {
    return (
      <BindingDock
        key={`combo-${combo.name}`}
        targetLabel={`${combo.name} binding`}
        targetSubtitle={`pos ${combo.keyPositions.join(',')}`}
        initial={combo.bindings}
        onCancel={() => setEditingBinding(false)}
        onCommit={commitBinding}
      />
    )
  }

  const activeLayerSet = new Set(combo.layers)
  const bindingSummary = combo.bindings.tokens.join(' ') || '&none'
  const positionsSummary =
    combo.keyPositions.length > 0 ? `pos ${combo.keyPositions.join(',')}` : 'no positions'

  return (
    <div class="contents">
      <div class="flex-none flex items-center gap-3 pr-5 border-r border-border-subtle">
        <div class="w-[46px] h-[46px] flex-none flex items-center justify-center rounded-input bg-accent-soft border border-accent text-accent [&_svg]:w-[22px] [&_svg]:h-[22px]">
          <CombosIcon />
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-[13px] font-mono font-semibold text-fg">{combo.name}</span>
            <button
              type="button"
              onClick={onRemove}
              class="text-[11px] font-mono text-danger hover:brightness-95"
            >
              Delete
            </button>
          </div>
          <span class="text-[11px] font-mono text-fg-subtle whitespace-nowrap">
            {bindingSummary} · {positionsSummary}
          </span>
        </div>
      </div>

      <div class="flex-1 min-w-0 flex flex-wrap items-end gap-4 px-5">
        <div class="flex flex-col gap-1.5 min-w-[140px] max-w-[180px]">
          <span class="font-mono font-semibold text-[9px] leading-none uppercase tracking-[.06em] text-fg-subtle">
            NAME
          </span>
          <CommittingTextInput
            class="font-mono !py-2 !text-[13px]"
            aria-label="Combo name"
            value={combo.name}
            onCommit={(name) => onChange({ ...combo, name })}
          />
        </div>

        <div class="flex flex-col gap-1.5 min-w-[140px] max-w-[200px]">
          <span class="font-mono font-semibold text-[9px] leading-none uppercase tracking-[.06em] text-fg-subtle">
            BINDING
          </span>
          <button
            type="button"
            onClick={() => setEditingBinding(true)}
            aria-label={`Edit combo binding: ${bindingSummary}`}
            class="flex items-center justify-between px-3 py-2 border border-border rounded-input bg-surface-0 text-[13px] font-mono font-semibold text-fg hover:bg-surface-2 transition-colors"
          >
            <span class="truncate">{bindingSummary}</span>
            <span
              class="text-fg-subtle text-[10px] pl-2 tracking-wider"
              aria-hidden="true"
            >
              EDIT
            </span>
          </button>
        </div>

        <div class="flex flex-col gap-1.5 min-w-[160px]">
          <span class="font-mono font-semibold text-[9px] leading-none uppercase tracking-[.06em] text-fg-subtle">
            KEY POSITIONS ({combo.keyPositions.length})
          </span>
          <div class="flex items-center gap-1.5 flex-wrap">
            {combo.keyPositions.map((pos) => (
              <span
                key={pos}
                class="inline-flex items-center gap-1 px-2 py-1 rounded-input bg-accent-soft border border-accent font-mono text-[11px] font-semibold text-accent"
              >
                {pos}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...combo,
                      keyPositions: combo.keyPositions.filter((p) => p !== pos),
                    })
                  }
                  class="text-fg-subtle hover:text-fg"
                  aria-label={`Remove position ${pos}`}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={pickMode ? onExitPickMode : onEnterPickMode}
              class={[
                'inline-flex items-center gap-1 px-2 py-1 rounded-input border font-mono text-[11px] transition-colors',
                pickMode
                  ? 'bg-accent text-accent-fg border-accent'
                  : 'border-dashed border-border-strong text-fg-subtle hover:text-fg',
              ].join(' ')}
            >
              {pickMode ? 'Done' : '+ Pick'}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 min-w-[180px]">
          <span class="font-mono font-semibold text-[9px] leading-none uppercase tracking-[.06em] text-fg-subtle">
            TARGET LAYERS
          </span>
          <div
            role="group"
            aria-label="Target layers"
            class="flex flex-wrap gap-1"
          >
            {layers.map((l, i) => {
              const isActive = activeLayerSet.has(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={isActive ? 'true' : 'false'}
                  aria-label={`Layer ${i} ${l.name}`}
                  onClick={() => {
                    const next = new Set(activeLayerSet)
                    if (isActive) next.delete(i)
                    else next.add(i)
                    onChange({
                      ...combo,
                      layers: Array.from(next).sort((a, b) => a - b),
                    })
                  }}
                  class={[
                    'px-2 py-1 rounded-input font-mono text-[11px] font-semibold transition-colors',
                    isActive
                      ? 'bg-ink text-ink-fg'
                      : 'border border-border bg-surface-0 text-fg-subtle hover:text-fg hover:bg-surface-2',
                  ].join(' ')}
                >
                  {i}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => onChange({ ...combo, layers: [] })}
              class="px-2 py-1 rounded-input border border-border bg-surface-0 font-mono text-[11px] text-fg-muted hover:text-fg hover:bg-surface-2"
              title="Clear selection — combo active on every layer"
            >
              Any
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
