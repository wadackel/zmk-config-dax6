import { useEditor } from '../../../../core/editor-state/context'
import type { BehaviorEntry } from '../../../../core/keymap-dt/types'
import {
  checkScrlVal,
  checkTriggersPerRotation,
  extractScrlVal,
  MSC_PERIOD_MS,
  scrollRotateTapMs,
  shieldSteps,
  shieldTriggersPerRotation,
  type HintLevel,
  type ScrollRotateTapMs,
} from '../../../../core/sensor-hints'
import { CommittingTextInput } from '../../../../ui/field'
import { SensorsIcon } from '../../../../ui/nav-icons'

const TAP_MS_MAX = 80

export type SensorTuningDockProps = {
  /** Which encoder is currently focused. Used in the identity summary. */
  encoderIdx: 0 | 1
}

/**
 * Bottom-dock tuning strip for the Sensors tab. Layout:
 *   - Identity (left): encoder chip + "Encoder N · left/right" + a rules
 *     status pill that aggregates the sensor-hints checks.
 *   - Fields (center): TRIGGERS-PER-ROTATION and SCRL_VAL are read-only —
 *     they live outside the keymap file (shield DTS + #define) so the
 *     dock cannot round-trip edits without touching those sources. TAP-MS
 *     is editable via `UPDATE_BEHAVIOR`, one field per runtime-sensor-rotate
 *     behavior that scrolls through `&msc` — the 16 ms floor is a property
 *     of each behavior node, not of the encoder or layer in focus.
 *
 * No Apply button — edits commit immediately on the CommittingTextInput,
 * so an Apply row would be a placeholder that adds a step users don't
 * need to take.
 *
 * The richer per-layer summary and AGENTS.md rule cards from the previous
 * right-panel version were dropped because the dock is a single row — a
 * future iteration may surface them as an expandable helper panel.
 */
export function SensorTuningDock({ encoderIdx }: SensorTuningDockProps) {
  const { state, dispatch } = useEditor()
  const behaviors = state.draft.behaviors
  const scrlVal = extractScrlVal(state.baselineSource)
  const scrollTapMs = scrollRotateTapMs(behaviors)
  const activeLayer = state.draft.layers[state.activeLayerIdx]

  const scrlValHint = checkScrlVal(scrlVal)
  const tprHint = checkTriggersPerRotation(shieldTriggersPerRotation(), shieldSteps())
  const hints = [...scrollTapMs.map((t) => t.hint), scrlValHint, tprHint]
  const rulesLevel: HintLevel = hints.some((h) => h.level === 'error')
    ? 'error'
    : hints.some((h) => h.level === 'warn')
      ? 'warn'
      : 'ok'

  const encoderLabel = encoderIdx === 0 ? 'left' : 'right'

  const setTapMs = (index: number, nextMs: number) => {
    const clamped = Math.max(MSC_PERIOD_MS, Math.min(TAP_MS_MAX, nextMs))
    const target = behaviors[index]
    const value = `<${clamped}>`
    // A node relying on the binding default has no `tap-ms` row to rewrite.
    const props = target.props.some((p) => p.name === 'tap-ms')
      ? target.props.map((p) => (p.name === 'tap-ms' ? { ...p, value } : p))
      : [...target.props, { name: 'tap-ms', value }]
    const behavior: BehaviorEntry = { ...target, props }
    dispatch({ type: 'UPDATE_BEHAVIOR', index, behavior })
  }

  return (
    <div class="contents">
      <div class="flex-none flex items-center gap-3 pr-5 border-r border-border-subtle">
        <div
          aria-hidden="true"
          class="w-[46px] h-[46px] flex-none rounded-full border-[1.5px] border-accent bg-[rgba(79,91,107,.07)] shadow-[0_0_0_3px_rgba(79,91,107,.1)] flex items-center justify-center text-accent [&_svg]:w-[22px] [&_svg]:h-[22px] box-border"
        >
          <SensorsIcon />
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-[13px] font-semibold text-fg">
              Encoder {encoderIdx} · {encoderLabel}
            </span>
            <RulesPill level={rulesLevel} />
          </div>
          <span class="text-[11px] font-mono text-fg-subtle whitespace-nowrap">
            layer {state.activeLayerIdx} · {activeLayer?.name ?? '—'}
          </span>
        </div>
      </div>

      <div class="flex-1 min-w-0 flex flex-wrap items-end gap-x-5 gap-y-4 px-5">
        <ReadOnlyField
          label="TRIGGERS-PER-ROTATION"
          value={String(shieldTriggersPerRotation())}
          hint={tprHint.level === 'ok' ? undefined : tprHint.message}
          hintLevel={tprHint.level}
        />
        {scrollTapMs.length === 0 ? (
          <ReadOnlyField label="TAP-MS" value="—" hintLevel="ok" />
        ) : (
          scrollTapMs.map((entry) => (
            <TapMsField
              key={entry.name}
              entry={entry}
              onCommit={(ms) => setTapMs(entry.index, ms)}
            />
          ))
        )}
        <ReadOnlyField
          label="SCRL_VAL"
          value={scrlVal !== null ? String(scrlVal) : '—'}
          hint={scrlValHint.level === 'ok' ? undefined : scrlValHint.message}
          hintLevel={scrlValHint.level}
        />
      </div>

    </div>
  )
}

function TapMsField({
  entry,
  onCommit,
}: {
  entry: ScrollRotateTapMs
  onCommit: (ms: number) => void
}) {
  const inputId = `tap-ms-${entry.name}`
  return (
    <div class="flex flex-col gap-[6px] min-w-[104px] max-w-[150px]">
      <label
        htmlFor={inputId}
        class={[
          'font-mono font-semibold text-[8.5px] leading-none tracking-[.06em] whitespace-nowrap',
          entry.hint.level === 'error' ? 'text-danger' : 'text-fg-subtler',
        ].join(' ')}
      >
        TAP-MS · {entry.name}
      </label>
      <div class="flex items-center justify-between w-[104px] px-[12px] py-[8px] border border-[rgba(22,24,29,.14)] rounded-[6px] bg-white box-border">
        <CommittingTextInput
          id={inputId}
          type="number"
          inputMode="numeric"
          min={MSC_PERIOD_MS}
          max={TAP_MS_MAX}
          value={entry.tapMs === null ? '' : String(entry.tapMs)}
          class="!w-full !min-w-0 !border-0 !bg-transparent !p-0 font-mono font-semibold !text-[13px] !leading-none text-fg !shadow-none focus:!ring-0"
          onCommit={(v) => {
            if (v === '') return
            onCommit(Number(v))
          }}
        />
        <span class="text-[9.5px] font-medium leading-none text-fg-subtler ml-2 shrink-0">ms</span>
      </div>
      {entry.hint.message && (
        <span class="text-[10.5px] leading-snug text-danger">{entry.hint.message}</span>
      )}
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
  hint,
  hintLevel,
}: {
  label: string
  value: string
  hint?: string
  hintLevel: HintLevel
}) {
  const labelColor =
    hintLevel === 'error'
      ? 'text-danger'
      : hintLevel === 'warn'
        ? 'text-warning'
        : 'text-fg-subtler'
  const isWide = label === 'TRIGGERS-PER-ROTATION'
  return (
    <div class={`flex flex-col gap-[6px] ${isWide ? 'min-w-[220px]' : 'min-w-[104px]'}`}>
      <span
        class={[
          'font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.06em]',
          labelColor,
        ].join(' ')}
      >
        {label}
      </span>
      <div class={`flex items-center px-[12px] py-[9px] rounded-[6px] border border-[rgba(22,24,29,.14)] bg-white box-border font-mono font-semibold text-[13px] leading-none text-fg ${isWide ? 'w-[220px]' : 'w-[104px]'}`}>
        {value}
      </div>
      {hint && (
        <span
          class={[
            'text-[10.5px] leading-snug',
            hintLevel === 'error' ? 'text-danger' : 'text-warning',
          ].join(' ')}
        >
          {hint}
        </span>
      )}
    </div>
  )
}

function RulesPill({ level }: { level: HintLevel }) {
  const style =
    level === 'ok'
      ? 'text-success'
      : level === 'warn'
        ? 'text-warning'
        : 'text-danger'
  const dot =
    level === 'ok'
      ? 'bg-success'
      : level === 'warn'
        ? 'bg-warning'
        : 'bg-danger'
  const label =
    level === 'ok' ? 'rules OK' : level === 'warn' ? 'rules warn' : 'rules error'
  return (
    <span class={['inline-flex items-center gap-1 text-[10px]', style].join(' ')}>
      <span aria-hidden="true" class={['w-[6px] h-[6px] rounded-full', dot].join(' ')} />
      {label}
    </span>
  )
}
