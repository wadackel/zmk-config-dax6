import { useState } from 'hono/jsx'
import { Button } from '../../../../ui/button'
import { Toggle } from '../../../../ui/toggle'
import { CommittingTextInput } from '../../../../ui/field'
import { BindingDock } from '../../shared/binding-dock/binding-inspector'
import { getDirectionMeta } from './direction-pad'
import type {
  BindingChain,
  MouseGestureBlock,
  MouseGesturePattern,
  MouseGesturePatternEntry,
} from '../../../../core/keymap-dt/types'

const NUMBER_PROPS = [
  {
    key: 'stroke-size',
    label: 'STROKE-SIZE',
    unit: 'px',
    min: 1,
    max: 400,
    hint: 'Movement counted as one stroke (smaller = more sensitive)',
  },
  {
    key: 'idle-timeout-ms',
    label: 'IDLE-TIMEOUT-MS',
    unit: 'ms',
    min: 0,
    max: 1000,
    hint: 'Time before a stroke commits after going idle',
  },
  {
    key: 'gesture-cooldown-ms',
    label: 'COOLDOWN-MS',
    unit: 'ms',
    min: 0,
    max: 500,
    hint: 'Debounce between gestures',
  },
  {
    key: 'quick-tap-ms',
    label: 'QUICK-TAP-MS',
    unit: 'ms',
    min: 0,
    max: 1000,
    hint: 'Threshold to fire immediately on quick tap',
  },
] as const

const BOOLEAN_PROPS = [
  {
    key: 'enable-eager-mode',
    label: 'EAGER-MODE',
    hint: 'Fire as soon as the threshold is reached',
  },
  {
    key: 'suppress-movement',
    label: 'SUPPRESS',
    hint: 'Suppress raw pointer movement during a stroke',
  },
  {
    key: 'always-active',
    label: 'ALWAYS-ACT',
    hint: 'Ignore layer gating on the input-processor',
  },
] as const

const parseIntValue = (raw: string | undefined): number | null => {
  if (!raw) return null
  const m = raw.match(/^<\s*(-?\d+)\s*>$/)
  if (m) return Number(m[1])
  const n = Number(raw.replace(/^<|>$/g, ''))
  return Number.isFinite(n) ? n : null
}

const findProp = (block: MouseGestureBlock, name: string) =>
  block.props.find((p) => p.name === name)

const setPropValue = (
  block: MouseGestureBlock,
  name: string,
  value: string | null,
): MouseGestureBlock => {
  const idx = block.props.findIndex((p) => p.name === name)
  if (value === null) {
    if (idx === -1) return block
    return { ...block, props: block.props.filter((_, i) => i !== idx) }
  }
  if (idx === -1) return { ...block, props: [...block.props, { name, value }] }
  return {
    ...block,
    props: block.props.map((p, i) => (i === idx ? { ...p, value } : p)),
  }
}

const upsertEntry = (
  entries: MouseGesturePatternEntry[],
  pattern: MouseGesturePattern,
  entry: MouseGesturePatternEntry,
): MouseGesturePatternEntry[] => {
  const idx = entries.findIndex((e) => e.pattern === pattern)
  if (idx === -1) return [...entries, entry]
  return entries.map((e, i) => (i === idx ? entry : e))
}

export type GestureDockProps = {
  block: MouseGestureBlock
  selected: MouseGesturePattern | null
  onChange: (next: MouseGestureBlock) => void
  onDeselect: () => void
}

/**
 * Bottom-dock gesture editor. Two modes:
 *   1. Property mode (default) — surfaces gesture-wide DT properties
 *      (4 number fields + 3 boolean toggles + selected-direction chip
 *      with an edit-name field).
 *   2. Binding-edit mode — when the user clicks Change binding… the dock
 *      body swaps for a {@link BindingDock} dock variant; committing
 *      writes the new binding into the selected pattern's entry.
 *
 * Both number and boolean prop sets remain complete (the plan preserves
 * NUMBER_PROPS + BOOLEAN_PROPS). The dock wraps them into a single
 * flex-row instead of the previous vertical stack.
 */
export function GestureDock({
  block,
  selected,
  onChange,
  onDeselect,
}: GestureDockProps) {
  const [editingBinding, setEditingBinding] = useState(false)

  const selectedEntry = selected
    ? block.entries.find((e) => e.pattern === selected)
    : null

  const commitBinding = (chain: BindingChain) => {
    if (!selected) return
    const existing = block.entries.find((e) => e.pattern === selected)
    const nextEntry: MouseGesturePatternEntry = {
      name: existing?.name ?? getDirectionMeta(selected).defaultName,
      pattern: selected,
      bindings: chain,
    }
    onChange({
      ...block,
      entries: upsertEntry(block.entries, selected, nextEntry),
    })
    setEditingBinding(false)
  }

  if (editingBinding && selected && selectedEntry) {
    return (
      <BindingDock
        key={`gesture-${selected}`}
        targetLabel={`${selected} stroke`}
        targetSubtitle={selectedEntry.name}
        initial={selectedEntry.bindings}
        onCancel={() => setEditingBinding(false)}
        onCommit={commitBinding}
      />
    )
  }

  return (
    <div class="contents">
      <div class="flex-none flex items-center gap-3 pr-5 border-r border-border-subtle">
        {selected && selectedEntry ? (
          <>
            <div class="w-[46px] h-[46px] flex-none rounded-[8px] border-[1.5px] border-accent bg-[rgba(79,91,107,.09)] shadow-[0_0_0_3px_rgba(79,91,107,.12)] flex items-center justify-center text-[18px] font-mono font-semibold text-accent leading-none box-border">
              {getDirectionMeta(selected).symbol}
            </div>
            <div class="flex flex-col gap-[5px]">
              <div class="flex items-center gap-2">
                <span class="text-[13.5px] font-semibold leading-none text-fg">
                  {selected} stroke
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...block,
                      entries: block.entries.filter((e) => e.pattern !== selected),
                    })
                    onDeselect()
                  }}
                  class="text-[11px] font-mono leading-none text-danger hover:brightness-95"
                >
                  Remove
                </button>
              </div>
              <span class="text-[11px] font-mono font-medium leading-none text-fg-subtle whitespace-nowrap">
                {block.kind === 'root' ? 'root block' : 'named block'} ·{' '}
                {block.kind === 'root' ? '&zip_mouse_gesture' : block.name}
              </span>
            </div>
          </>
        ) : (
          <>
            <div class="w-[46px] h-[46px] flex-none border-[1.5px] border-dashed border-[rgba(22,24,29,.2)] rounded-[8px] flex items-center justify-center box-border">
              <span class="text-fg-subtler font-semibold text-[15px] leading-none">◈</span>
            </div>
            <span class="text-[11.5px] font-medium text-fg-subtle max-w-[220px] leading-[1.5]">
              Select a direction card to edit its binding and per-block properties.
            </span>
          </>
        )}
      </div>

      <div class="flex-1 min-w-0 flex flex-wrap items-end gap-x-5 gap-y-4 px-5">
        {selected && selectedEntry && (
          <div class="flex flex-col gap-[6px]">
            <span class="font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.06em] text-fg-subtler">
              BINDING
            </span>
            <button
              type="button"
              onClick={() => setEditingBinding(true)}
              aria-label={`Edit ${selected} stroke binding: ${
                selectedEntry.bindings.tokens.join(' ') || '&none'
              }`}
              class="flex items-center gap-[7px] w-[180px] px-[12px] py-[9px] border border-[rgba(22,24,29,.14)] rounded-[6px] bg-white hover:bg-surface-2 transition-colors box-border"
            >
              <span class="truncate font-mono font-semibold text-[13px] leading-none text-fg flex-1 text-left">
                {selectedEntry.bindings.tokens.join(' ') || '&none'}
              </span>
              <span class="text-[11px] leading-none text-fg-subtler shrink-0" aria-hidden="true">
                ▾
              </span>
            </button>
          </div>
        )}

        {selected && selectedEntry && NUMBER_PROPS.map((p) => {
          const currentRaw = findProp(block, p.key)?.value
          const currentNum = parseIntValue(currentRaw)
          return (
            <div key={p.key} class="flex flex-col gap-[6px]" title={p.hint}>
              <span class="font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.06em] text-fg-subtler">
                {p.label}
              </span>
              <div class="flex items-center justify-between w-[110px] px-[12px] py-[8px] border border-[rgba(22,24,29,.14)] rounded-[6px] bg-white box-border">
                <CommittingTextInput
                  type="number"
                  inputMode="numeric"
                  min={p.min}
                  max={p.max}
                  value={currentNum !== null ? String(currentNum) : ''}
                  class="!w-full !min-w-0 !border-0 !bg-transparent !p-0 font-mono font-semibold !text-[13px] !leading-none text-fg !shadow-none focus:!ring-0"
                  aria-label={p.label}
                  onCommit={(v) => {
                    if (v === '') onChange(setPropValue(block, p.key, null))
                    else onChange(setPropValue(block, p.key, `<${Number(v)}>`))
                  }}
                />
                {p.unit && (
                  <span class="text-[9.5px] font-medium leading-none text-fg-subtler ml-2 shrink-0">
                    {p.unit}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {selected && selectedEntry && BOOLEAN_PROPS.map((p) => {
          const on = findProp(block, p.key) !== undefined
          return (
            <div key={p.key} class="flex flex-col gap-[6px]" title={p.hint}>
              <span class="font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.06em] text-fg-subtler">
                {p.label}
              </span>
              <div class="flex items-center gap-[9px] h-[36px]">
                <Toggle
                  checked={on}
                  onChange={(next) =>
                    onChange(setPropValue(block, p.key, next ? '' : null))
                  }
                  ariaLabel={p.label}
                />
                <span class="text-[11.5px] font-medium leading-none text-fg-subtle">
                  {on ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          )
        })}

        {selected && selectedEntry && (
          <div class="flex flex-col gap-[6px]">
            <span class="font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.06em] text-fg-subtler">
              ENTRY NAME
            </span>
            <div class="flex items-center w-[160px] px-[12px] py-[8px] border border-[rgba(22,24,29,.14)] rounded-[6px] bg-white box-border">
              <CommittingTextInput
                class="!w-full !min-w-0 !border-0 !bg-transparent !p-0 font-mono font-semibold !text-[13px] !leading-none text-fg !shadow-none focus:!ring-0"
                aria-label="Direction entry name"
                value={selectedEntry.name}
                invalid={selectedEntry.name.trim() === ''}
                onCommit={(name) => {
                  onChange({
                    ...block,
                    entries: upsertEntry(block.entries, selected, {
                      ...selectedEntry,
                      name,
                    }),
                  })
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div class="flex-none flex items-center pl-3">
        {selected ? (
          <Button size="sm" variant="ghost" onClick={onDeselect}>
            Close
          </Button>
        ) : null}
      </div>
    </div>
  )
}
