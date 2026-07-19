import { Button } from '../../../../ui/button'
import { CommittingTextInput } from '../../../../ui/field'
import { BindingDock } from '../../shared/binding-dock/binding-inspector'
import { isSimpleChain } from './macro-shape'
import type { BindingChain, MacroEntry } from '../../../../core/keymap-dt/types'

export type MacroStepDockProps = {
  macro: MacroEntry
  stepIdx: number
  onCommitStep: (chain: BindingChain) => void
  onRemoveStep: () => void
  onCancel: () => void
}

/**
 * Bottom-dock editor for a single macro step. Simple chains route
 * through the dock-variant {@link BindingDock} so the same
 * behaviour+keycode picker used by Layers renders inline. Multi-
 * behaviour ("raw") chains fall back to a monospace token editor
 * because the picker cannot round-trip them.
 */
export function MacroStepDock({
  macro,
  stepIdx,
  onCommitStep,
  onRemoveStep,
  onCancel,
}: MacroStepDockProps) {
  const step = macro.bindingsList[stepIdx]
  if (!step) return null

  if (isSimpleChain(step)) {
    return (
      <BindingDock
        key={`macro-${macro.name}-step-${stepIdx}`}
        targetLabel={`Step ${stepIdx + 1}`}
        targetSubtitle={macro.name}
        initial={step}
        onCancel={onCancel}
        onCommit={onCommitStep}
      />
    )
  }

  return (
    <div class="contents">
      <div class="flex-none flex items-center gap-3 pr-5 border-r border-border-subtle">
        <div class="w-[46px] h-[46px] flex-none rounded-input bg-warning-soft border border-warning/40 flex items-center justify-center font-mono font-semibold text-[15px] text-warning">
          {stepIdx + 1}
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-[13px] font-mono font-semibold text-fg">
              Step {stepIdx + 1}
            </span>
            <button
              type="button"
              onClick={onRemoveStep}
              class="text-[11px] font-mono text-danger hover:brightness-95"
            >
              Remove
            </button>
          </div>
          <span class="text-[11px] font-mono text-fg-subtle whitespace-nowrap">
            raw · multi-behaviour
          </span>
        </div>
      </div>

      <div class="flex-1 min-w-0 flex items-center gap-3 px-5">
        <div class="flex flex-col gap-1.5 flex-1 min-w-0 max-w-[560px]">
          <span class="font-mono font-semibold text-[9px] leading-none uppercase tracking-[.06em] text-fg-subtle">
            TOKENS
          </span>
          <CommittingTextInput
            class="font-mono !py-2 !text-[12.5px]"
            aria-label="Macro step tokens"
            value={step.tokens.join(' ')}
            onCommit={(next) =>
              onCommitStep({
                tokens: next.split(/\s+/).filter(Boolean),
              })
            }
          />
        </div>
        <span
          class="text-[10.5px] text-fg-subtle italic max-w-[220px]"
          role="note"
        >
          Multi-behaviour step — edit the token list directly.
        </span>
      </div>

      <div class="flex-none flex items-center pl-3">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </div>
    </div>
  )
}
