import { useEditor } from '../../../../core/editor-state/context'
import type { BehaviorEntry } from '../../../../core/keymap-dt/types'
import {
  checkScrlVal,
  checkTapMs,
  checkTriggersPerRotation,
  extractScrlVal,
  getEncScrollTapMs,
  shieldSteps,
  shieldTriggersPerRotation,
} from '../../../../core/sensor-hints'
import { Button } from '../../../../ui/button'
import { CommittingTextInput } from '../../../../ui/field'
import { SensorsIcon } from '../../../../ui/nav-icons'

const MSC_PERIOD_MS = 16 // enc_scroll.tap-ms must be ≥ this for scroll events to fire.
const TAP_MS_MAX = 80

export type SensorTuningDockProps = {
  /** Which encoder is currently focused. Used in the identity summary. */
  encoderIdx: 0 | 1
}

/**
 * Bottom-dock tuning strip for the Sensors tab. Layout:
 *   - Identity (left): encoder chip + "Encoder N · left/right" + a rules
 *     status pill that aggregates the three sensor-hints checks.
 *   - Fields (center): TRIGGERS-PER-ROTATION and SCRL_VAL are read-only —
 *     they live outside the keymap file (shield DTS + #define) so the
 *     dock cannot round-trip edits without touching those sources. Only
 *     TAP-MS is editable via the existing `UPDATE_BEHAVIOR` action.
 *   - Actions (right): Reset (revert TAP-MS to the MSC 16 ms floor). No
 *     Apply button — edits commit immediately on the CommittingTextInput,
 *     so an Apply row would be a placeholder that adds a step users don't
 *     need to take.
 *
 * The richer per-layer summary and CLAUDE.md rule cards from the previous
 * right-panel version were dropped because the dock is a single row — a
 * future iteration may surface them as an expandable helper panel.
 */
export function SensorTuningDock({ encoderIdx }: SensorTuningDockProps) {
  const { state, dispatch } = useEditor()
  const behaviors = state.draft.behaviors
  const scrlVal = extractScrlVal(state.baselineSource)
  const tapMs = getEncScrollTapMs(behaviors)
  const encScrollIdx = behaviors.findIndex((b) => b.name === 'enc_scroll')
  const encScrollDefined = encScrollIdx >= 0
  const activeLayer = state.draft.layers[state.activeLayerIdx]

  const tapMsHint = checkTapMs(tapMs)
  const scrlValHint = checkScrlVal(scrlVal)
  const tprHint = checkTriggersPerRotation(shieldTriggersPerRotation(), shieldSteps())
  const rulesLevel: 'ok' | 'warn' | 'error' = [tapMsHint, scrlValHint, tprHint].some(
    (h) => h.level === 'error',
  )
    ? 'error'
    : [tapMsHint, scrlValHint, tprHint].some((h) => h.level === 'warn')
      ? 'warn'
      : 'ok'

  const encoderLabel = encoderIdx === 0 ? 'left' : 'right'

  const setTapMs = (nextMs: number) => {
    if (encScrollIdx < 0) return
    const clamped = Math.max(MSC_PERIOD_MS, Math.min(TAP_MS_MAX, nextMs))
    const target = behaviors[encScrollIdx]
    const nextProps = target.props.map((p) =>
      p.name === 'tap-ms' ? { ...p, value: `<${clamped}>` } : p,
    )
    const behavior: BehaviorEntry = { ...target, props: nextProps }
    dispatch({ type: 'UPDATE_BEHAVIOR', index: encScrollIdx, behavior })
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
        <div class="flex flex-col gap-[6px]">
          <span
            class={[
              'font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.06em]',
              tapMsHint.level === 'error'
                ? 'text-danger'
                : tapMsHint.level === 'warn'
                  ? 'text-warning'
                  : 'text-fg-subtler',
            ].join(' ')}
          >
            TAP-MS
          </span>
          {encScrollDefined ? (
            <div class="flex items-center justify-between w-[104px] px-[12px] py-[8px] border border-[rgba(22,24,29,.14)] rounded-[6px] bg-white box-border">
              <CommittingTextInput
                type="number"
                inputMode="numeric"
                min={MSC_PERIOD_MS}
                max={TAP_MS_MAX}
                value={String(tapMs ?? MSC_PERIOD_MS)}
                class="!w-full !min-w-0 !border-0 !bg-transparent !p-0 font-mono font-semibold !text-[13px] !leading-none text-fg !shadow-none focus:!ring-0"
                aria-label="tap-ms"
                aria-describedby="tap-ms-hint"
                onCommit={(v) => {
                  if (v === '') return
                  setTapMs(Number(v))
                }}
              />
              <span
                id="tap-ms-hint"
                class="text-[9.5px] font-medium leading-none text-fg-subtler ml-2 shrink-0"
              >
                ms
              </span>
            </div>
          ) : (
            <span class="text-[11px] text-fg-subtle italic max-w-[200px]">
              enc_scroll undefined — create in Behaviors tab
            </span>
          )}
        </div>
        <ReadOnlyField
          label="SCRL_VAL"
          value={scrlVal !== null ? String(scrlVal) : '—'}
          hint={scrlValHint.level === 'ok' ? undefined : scrlValHint.message}
          hintLevel={scrlValHint.level}
        />
      </div>

      <div class="flex-none flex items-center gap-2 pl-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTapMs(MSC_PERIOD_MS)}
          disabled={!encScrollDefined}
        >
          Reset
        </Button>
      </div>
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
  hintLevel: 'ok' | 'warn' | 'error'
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

function RulesPill({ level }: { level: 'ok' | 'warn' | 'error' }) {
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
