// Dispatches each ZMK behaviour argument slot to the most appropriate input
// control for its `argType` (keycode → combobox, layer → native select, etc.).

import { useEffect } from 'hono/jsx'
import { DockField } from '../../../../features/editor/shell/dock-field'
import type { BehaviorArgType } from '../../../../core/picker'
import type { LayerData } from '../../../../core/keymap-dt/types'
import { KeycodeCombobox } from './keycode-combobox'

type Props = {
  argType: BehaviorArgType | undefined
  value: string
  onChange: (next: string) => void
  /** Optional `overrideValue` propagates a synchronous arg value (e.g. the
   *  pending listbox selection in the keycode combobox). The parent uses it
   *  to commit immediately without waiting for the async setArgs round-trip. */
  onCommit?: (overrideValue?: string) => void
  /** When true (e.g. `&mt` arg0), pin modifiers in the keycode combobox. */
  pinModifiers?: boolean
  layers: LayerData[]
  isActive: boolean
  onFocus: () => void
  label: string
  autoFocus?: boolean
  /** Forwarded to the keycode combobox — see {@link KeycodeCombobox}. */
  popoverPlacement?: 'below' | 'above'
  /**
   * When true, render the slot inline as a bottom-dock cell (no border
   * around the slot itself, tight micro label above). Default false
   * keeps the boxed inspector look.
   */
  compact?: boolean
  /**
   * When true, do NOT render the internal `ModifierToggles` bar above
   * the keycode input. The parent (bottom dock) uses this so the
   * modifier chips sit as a peer cell to the KEYCODE input rather than
   * stacked above it, matching the design's single-baseline row.
   */
  hideModifiers?: boolean
}

const MSC_OPTIONS = ['SCRL_UP', 'SCRL_DOWN', 'SCRL_LEFT', 'SCRL_RIGHT']
const OUTPUT_OPTIONS = ['OUT_USB', 'OUT_BLE', 'OUT_TOG']
const GESTURE_OPTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT']

export function ArgumentControl({
  argType,
  value,
  onChange,
  onCommit,
  pinModifiers,
  layers,
  isActive,
  onFocus,
  label,
  autoFocus,
  popoverPlacement,
  compact = false,
  hideModifiers = false,
}: Props) {
  if (compact) {
    // Keycode combobox owns its own DockField chrome so it can wire `active`
    // to the popover-open state and mount the listbox in the field's own
    // relative coord space. Every other argType wraps its plain input/select
    // in a DockField here, using `isActive` as the visual accent.
    if (argType === 'keycode') {
      return (
        <div onFocusin={onFocus}>
          <KeycodeCombobox
            value={value}
            onChange={onChange}
            onCommit={onCommit}
            pinModifiers={pinModifiers}
            autoFocus={autoFocus}
            popoverPlacement={popoverPlacement}
            hideModifiers={hideModifiers}
            dockField
            fieldLabel={label}
          />
        </div>
      )
    }
    return (
      <div onFocusin={onFocus}>
        <DockField label={label} active={isActive}>
          <ArgumentInput
            argType={argType}
            value={value}
            onChange={onChange}
            onCommit={onCommit}
            pinModifiers={pinModifiers}
            layers={layers}
            autoFocus={autoFocus}
            popoverPlacement={popoverPlacement}
            hideModifiers={hideModifiers}
            compact
          />
        </DockField>
      </div>
    )
  }
  const wrapperClass = `flex flex-col gap-1 p-2 rounded-md border ${
    isActive ? 'border-accent' : 'border-border'
  }`
  return (
    <div class={wrapperClass} onFocusin={onFocus}>
      <span class="text-[10px] text-fg-subtle">{label}</span>
      <ArgumentInput
        argType={argType}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        pinModifiers={pinModifiers}
        layers={layers}
        autoFocus={autoFocus}
        popoverPlacement={popoverPlacement}
      />
    </div>
  )
}

function ArgumentInput({
  argType,
  value,
  onChange,
  onCommit,
  pinModifiers,
  layers,
  autoFocus,
  popoverPlacement,
  hideModifiers,
  compact,
}: Pick<Props, 'argType' | 'value' | 'onChange' | 'onCommit' | 'pinModifiers' | 'layers' | 'autoFocus' | 'popoverPlacement' | 'hideModifiers' | 'compact'>) {
  switch (argType) {
    case 'keycode':
      return (
        <KeycodeCombobox
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          pinModifiers={pinModifiers}
          autoFocus={autoFocus}
          popoverPlacement={popoverPlacement}
          hideModifiers={hideModifiers}
        />
      )
    case 'layer':
      return (
        <LayerSelect
          value={value}
          onChange={onChange}
          layers={layers}
          autoFocus={autoFocus}
          compact={compact}
        />
      )
    case 'msc-action':
      return (
        <NativeSelect
          value={value}
          options={MSC_OPTIONS}
          onChange={onChange}
          autoFocus={autoFocus}
          fallback="SCRL_UP"
          compact={compact}
        />
      )
    case 'output':
      return (
        <NativeSelect
          value={value}
          options={OUTPUT_OPTIONS}
          onChange={onChange}
          autoFocus={autoFocus}
          fallback="OUT_USB"
          compact={compact}
        />
      )
    case 'gesture':
      return (
        <NativeSelect
          value={value}
          options={GESTURE_OPTIONS}
          onChange={onChange}
          autoFocus={autoFocus}
          fallback="UP"
          compact={compact}
        />
      )
    case 'profile':
    case 'free':
    default:
      return (
        <input
          type="text"
          class={
            compact
              ? 'flex-1 min-w-0 border-none outline-none bg-transparent font-mono font-semibold text-[13px] leading-none text-fg'
              : 'w-full bg-surface-3 border border-border-strong rounded-md px-2 py-1 text-fg font-mono'
          }
          value={value}
          autoFocus={autoFocus}
          onInput={(e: Event) => onChange((e.target as HTMLInputElement).value)}
          onKeyDown={(e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onCommit?.()
            }
          }}
        />
      )
  }
}

function LayerSelect({
  value,
  onChange,
  layers,
  autoFocus,
  compact,
}: {
  value: string
  onChange: (next: string) => void
  layers: LayerData[]
  autoFocus?: boolean
  compact?: boolean
}) {
  // Sync the displayed fallback ("0") back to the parent so commit() never
  // records an empty layer index. Triggered on mount or after a behaviour
  // swap reseeds args with empty strings.
  const validIndices = new Set(layers.map((_, i) => String(i)))
  useEffect(() => {
    if (!validIndices.has(value)) onChange('0')
  }, [value, layers.length])

  // hono/jsx/dom sets `select.value` before <option> children are appended, so
  // `<select value=X>` falls back to selectedIndex 0. Mark the intended option
  // as `selected` instead — that path runs per-option at DOM creation time and
  // survives the append order.
  const current = value || '0'

  return (
    <select
      class={
        compact
          ? 'flex-1 min-w-0 border-none outline-none bg-transparent font-mono font-semibold text-[13px] leading-none text-fg cursor-pointer'
          : 'w-full bg-surface-3 border border-border-strong rounded-md px-2 py-1 text-fg font-mono'
      }
      autoFocus={autoFocus}
      onChange={(e: Event) => onChange((e.target as HTMLSelectElement).value)}
    >
      {layers.map((l, i) => (
        <option key={i} value={String(i)} selected={String(i) === current}>
          {i} - {l.name || `Layer ${i}`}
        </option>
      ))}
    </select>
  )
}

function NativeSelect({
  value,
  options,
  onChange,
  autoFocus,
  fallback,
  compact,
}: {
  value: string
  options: readonly string[]
  onChange: (next: string) => void
  autoFocus?: boolean
  fallback: string
  compact?: boolean
}) {
  const current = options.includes(value) ? value : fallback
  // Sync the displayed fallback back to the parent so commit() never records
  // an empty / out-of-options value. Without this, behaviour-swap reseeded
  // args = [''] reaches commit and emits `&msc` / `&out` / `&mouse_gesture`
  // with no action argument.
  useEffect(() => {
    if (value !== current) onChange(current)
  }, [value, current])

  // See LayerSelect: `<select value=X>` loses X because hono/jsx applies it
  // before children mount. Mark the target <option> as `selected` instead.
  return (
    <select
      class={
        compact
          ? 'flex-1 min-w-0 border-none outline-none bg-transparent font-mono font-semibold text-[13px] leading-none text-fg cursor-pointer'
          : 'w-full bg-surface-3 border border-border-strong rounded-md px-2 py-1 text-fg font-mono'
      }
      autoFocus={autoFocus}
      onChange={(e: Event) => onChange((e.target as HTMLSelectElement).value)}
    >
      {options.map((o) => (
        <option key={o} value={o} selected={o === current}>
          {o}
        </option>
      ))}
    </select>
  )
}
