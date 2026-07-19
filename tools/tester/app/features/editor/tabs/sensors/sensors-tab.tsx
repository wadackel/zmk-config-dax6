import { useState } from 'hono/jsx'
import { useEditor } from '../../../../core/editor-state/context'
import type { BindingChain } from '../../../../core/keymap-dt/types'
import {
  describeEncoderRotation,
  shieldTriggersPerRotation,
} from '../../../../core/sensor-hints'
import { BindingDock } from '../../shared/binding-dock/binding-inspector'
import { SensorTuningDock } from './sensor-tuning-inspector'
import { EncoderDial } from './encoder-dial'
import { LayerSelectorColumn } from './layer-selector-column'
import { DockShell } from '../../shell/dock-shell'

const ENCODER_LABELS = ['left', 'right']

type EditingTarget = { encoderIdx: 0 | 1; direction: 'ccw' | 'cw' }

/**
 * Sensors tab. Two-column shell + bottom dock:
 *   - Left: LayerSelectorColumn (which layer's sensor-bindings to edit)
 *   - Center: encoder pill selector + CCW card / EncoderDial / CW card
 *   - Bottom dock: SensorTuningDock by default (tuning fields);
 *     swapped for the BindingDock dock variant when CCW/CW is clicked.
 *
 * The dial is decorative; interactions happen on the CCW/CW cards. Selecting
 * a layer without sensor-bindings surfaces an "Add sensor-bindings" prompt
 * (dispatches INSERT_SENSOR_BINDING so the reducer seeds `[&trans, &trans]`).
 */
export function SensorsTab() {
  const { state, dispatch } = useEditor()
  const layers = state.draft.layers
  const activeLayer = layers[state.activeLayerIdx]
  const [selectedEncoder, setSelectedEncoder] = useState<0 | 1>(0)
  const [editing, setEditing] = useState<EditingTarget | null>(null)

  const bindings = activeLayer?.sensorBindings?.perEncoder
  const editingChain =
    editing !== null && bindings ? bindings[editing.encoderIdx] : null

  const commitBinding = (chain: BindingChain) => {
    if (editing === null) return
    dispatch({
      type: 'UPDATE_SENSOR_BINDING',
      layerIdx: state.activeLayerIdx,
      encoderIdx: editing.encoderIdx,
      chain,
    })
    setEditing(null)
  }

  return (
    <div class="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-0">
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <LayerSelectorColumn />

        <div class="flex-1 bg-surface-3 flex flex-col min-w-0 overflow-auto">
        <EncoderPillSelector
          selected={selectedEncoder}
          onSelect={setSelectedEncoder}
        />

        {!bindings ? (
          <EmptySensorState
            layerName={activeLayer?.name ?? '—'}
            onInsert={() =>
              dispatch({ type: 'INSERT_SENSOR_BINDING', layerIdx: state.activeLayerIdx })
            }
          />
        ) : (
          <div class="flex-1 flex items-center justify-center gap-8 px-8 py-6 min-w-0 flex-wrap">
            <RotationCard
              direction="ccw"
              chain={bindings[selectedEncoder]!}
              isEditing={
                editing?.encoderIdx === selectedEncoder && editing?.direction === 'ccw'
              }
              onClick={() =>
                setEditing({ encoderIdx: selectedEncoder, direction: 'ccw' })
              }
            />

            <div class="flex flex-col items-center gap-3">
              <EncoderDial
                encoderIdx={selectedEncoder}
                label={ENCODER_LABELS[selectedEncoder]}
                layerIdx={state.activeLayerIdx}
              />
              <span class="text-[11px] font-medium leading-none text-fg-subtle">
                Rotation preview · {shieldTriggersPerRotation()} triggers / rotation
              </span>
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SWAP_SENSOR_BINDING_ARGS',
                    layerIdx: state.activeLayerIdx,
                    encoderIdx: selectedEncoder,
                  })
                }
                class="inline-flex items-center gap-[7px] px-[14px] py-[8px] rounded-full border border-[rgba(22,24,29,.14)] bg-white text-[12px] font-medium leading-none text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
              >
                ⇄ Swap CCW / CW
              </button>
            </div>

            <RotationCard
              direction="cw"
              chain={bindings[selectedEncoder]!}
              isEditing={
                editing?.encoderIdx === selectedEncoder && editing?.direction === 'cw'
              }
              onClick={() =>
                setEditing({ encoderIdx: selectedEncoder, direction: 'cw' })
              }
            />
          </div>
        )}
      </div>

      </div>

      <DockShell ariaLabel="Sensor tuning">
        {editing !== null && editingChain ? (
          <BindingDock
            key={`enc-${editing.encoderIdx}-l${state.activeLayerIdx}`}
            targetLabel={`Encoder ${editing.encoderIdx} · ${ENCODER_LABELS[editing.encoderIdx]}`}
            targetSubtitle={`layer ${state.activeLayerIdx} · ${activeLayer?.name ?? ''}`}
            initial={editingChain}
            onCancel={() => setEditing(null)}
            onCommit={commitBinding}
          />
        ) : (
          <SensorTuningDock encoderIdx={selectedEncoder} />
        )}
      </DockShell>
    </div>
  )
}

function EncoderPillSelector({
  selected,
  onSelect,
}: {
  selected: 0 | 1
  onSelect: (n: 0 | 1) => void
}) {
  const items: { idx: 0 | 1; label: string }[] = [
    { idx: 0, label: 'Encoder 0 · left' },
    { idx: 1, label: 'Encoder 1 · right' },
  ]
  return (
    <div role="radiogroup" aria-label="Encoder selection" class="flex items-center gap-[9px] px-8 pt-4">
      {items.map((it) => {
        const active = selected === it.idx
        return (
          <button
            key={it.idx}
            type="button"
            role="radio"
            aria-checked={active ? 'true' : 'false'}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(it.idx)}
            class={[
              'inline-flex items-center gap-2 px-[15px] py-[8px] rounded-full text-[12.5px] leading-none transition-colors',
              active
                ? 'bg-[#16181d] text-white font-semibold'
                : 'bg-white border border-[rgba(22,24,29,.14)] text-fg-muted font-medium hover:text-fg hover:bg-surface-2',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              class={[
                'w-[14px] h-[14px] border-2 rounded-full inline-block',
                active
                  ? 'border-white/50 border-t-white'
                  : 'border-[#c9ccd2] border-t-[#9096a0]',
              ].join(' ')}
            />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function EmptySensorState({
  layerName,
  onInsert,
}: {
  layerName: string
  onInsert: () => void
}) {
  return (
    <div class="flex-1 flex flex-col items-center justify-center gap-4 px-8 py-6">
      <span class="text-[14px] text-fg-muted">
        <span class="font-semibold text-fg">{layerName}</span> has no sensor-bindings yet
      </span>
      <button
        type="button"
        onClick={onInsert}
        class="px-4 py-2 rounded-lg bg-accent text-accent-fg text-[13px] font-semibold shadow-[0_1px_2px_rgb(79_91_107/0.35)]"
      >
        + Add sensor-bindings
      </button>
      <span class="text-[11px] text-fg-subtle">
        Defaults for CCW / CW are <code class="font-mono">&trans</code>
      </span>
    </div>
  )
}

type RotationCardProps = {
  direction: 'ccw' | 'cw'
  chain: BindingChain
  isEditing: boolean
  onClick: () => void
}

function RotationCard({ direction, chain, isEditing, onClick }: RotationCardProps) {
  const desc = describeEncoderRotation(chain)
  // arg positions per describeEncoderRotation: arg0 = CCW, arg1 = CW
  const argToken = direction === 'ccw' ? chain.tokens[1] : chain.tokens[2]
  const displayTokens = argToken
    ? `${chain.tokens[0] ?? ''} ${argToken}`.trim()
    : chain.tokens.join(' ') || '—'
  const hint = desc ? (direction === 'ccw' ? desc.ccw : desc.cw) : ''
  const label = direction === 'ccw' ? 'CCW' : 'CW'
  const symbol = direction === 'ccw' ? '↺' : '↻'
  return (
    <button
      type="button"
      onClick={onClick}
      class={[
        'w-[212px] flex-none bg-white rounded-[9px] overflow-hidden text-left transition-shadow border box-border',
        isEditing
          ? 'border-[1.5px] border-accent shadow-[0_0_0_3px_rgba(79,91,107,.12)]'
          : 'border-[rgba(22,24,29,.12)] shadow-[0_1px_2px_rgba(22,24,29,.05)] hover:shadow-md',
      ].join(' ')}
    >
      <div class="flex items-center gap-2 px-[14px] py-[12px] border-b border-[rgba(22,24,29,.07)]">
        <span class="text-[15px] font-mono font-semibold text-fg leading-none">{symbol}</span>
        <span class="text-[12.5px] font-semibold text-fg leading-none">{label}</span>
        <span class="ml-auto text-[10.5px] font-medium text-fg-subtle leading-none">
          {direction === 'ccw' ? 'counter-clockwise' : 'clockwise'}
        </span>
      </div>
      <div class="p-[14px] flex flex-col gap-[9px]">
        <span class="text-[10.5px] font-medium text-fg-subtle leading-none">Binding</span>
        <span class="flex items-center justify-between px-[12px] py-[11px] border border-[rgba(22,24,29,.14)] rounded-[6px] bg-[rgba(22,24,29,.03)]">
          <span class="truncate font-mono font-semibold text-[13.5px] leading-none text-fg">
            {displayTokens}
          </span>
          <span class="text-[11px] leading-none text-fg-subtler shrink-0 ml-2" aria-hidden="true">
            ▾
          </span>
        </span>
        {hint && <span class="text-[11px] font-medium text-fg-subtle leading-[1.5]">{hint}</span>}
      </div>
    </button>
  )
}
