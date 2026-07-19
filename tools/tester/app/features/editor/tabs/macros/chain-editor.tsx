import { useState } from 'hono/jsx'
import { CommittingTextInput } from '../../../../ui/field'
import { MiniCode } from '../../../../ui/mini-code'
import type { BindingChain, MacroEntry } from '../../../../core/keymap-dt/types'
import { isSimpleChain } from './macro-shape'

const DT_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

const INSERT_BEHAVIOURS: { token: string; label: string }[] = [
  { token: '&kp', label: '&kp' },
  { token: '&macro_tap', label: '&macro_tap' },
  { token: '&macro_press', label: '&macro_press' },
  { token: '&macro_release', label: '&macro_release' },
  { token: '&macro_wait_time', label: '&macro_wait' },
]

export type ChainEditorProps = {
  macro: MacroEntry
  selectedStepIdx: number | null
  onSelectStep: (idx: number) => void
  onInsertStep: (idx: number, chain: BindingChain) => void
  onRemoveStep: (idx: number) => void
  onRename: (name: string) => void
}

/**
 * Horizontal chain visualisation for a macro's `bindingsList`. Each step
 * card renders one `BindingChain`; between cards is a `→` glyph and after
 * the last card an outlined `+` inserter. Below the chain is the "Insert:"
 * toolbar exposing the five most common macro step behaviours, and at the
 * bottom a dark MiniCode preview of the serialised DTS form.
 */
export function ChainEditor({
  macro,
  selectedStepIdx,
  onSelectStep,
  onInsertStep,
  onRemoveStep,
  onRename,
}: ChainEditorProps) {
  const preview = buildRawPreview(macro)
  // `CommittingTextInput` (defined in ui/field.tsx) keeps the local
  // buffer until `externalValue` changes, so a reducer that rejects the commit
  // (duplicate name, empty string, invalid identifier) would leave the input
  // showing text that no longer matches the model. Bumping the key on every
  // commit re-mounts the input, forcing its local state to re-seed from
  // `macro.name`. On accept the seed is the new name (visible); on reject it
  // is the old name (visible revert). UI-side identifier check short-circuits
  // the dispatch for obviously bad input so the undo stack stays clean.
  const [nameAttempt, setNameAttempt] = useState(0)
  const handleRename = (next: string) => {
    setNameAttempt((n) => n + 1)
    if (!DT_IDENT.test(next.trim())) return
    onRename(next)
  }
  return (
    <div class="flex-1 flex flex-col gap-5 px-8 py-5 min-w-0 overflow-auto">
      <div class="flex items-baseline gap-3">
        <CommittingTextInput
          key={`${macro.name}#${nameAttempt}`}
          class="font-mono !py-1.5 !text-[15px] !font-semibold !max-w-[240px]"
          aria-label="Macro name"
          value={macro.name}
          onCommit={handleRename}
        />
        <span class="text-[11px] text-fg-subtle">
          {macro.bindingsList.length} step{macro.bindingsList.length === 1 ? '' : 's'} · click a step to edit
        </span>
      </div>

      <div class="flex flex-wrap items-start gap-0">
        {macro.bindingsList.map((chain, i) => (
          <StepCard
            key={i}
            chain={chain}
            index={i}
            isSelected={selectedStepIdx === i}
            onClick={() => onSelectStep(i)}
            onRemove={() => onRemoveStep(i)}
            isLast={i === macro.bindingsList.length - 1}
          />
        ))}
        <button
          type="button"
          class="mb-5 mt-1 w-[46px] h-[46px] flex items-center justify-center border border-dashed border-border-strong rounded-xl text-[18px] font-semibold text-fg-subtle hover:text-accent hover:border-accent transition-colors"
          onClick={() =>
            onInsertStep(macro.bindingsList.length, { tokens: ['&kp', 'A'] })
          }
          aria-label="Append step"
        >
          +
        </button>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] text-fg-subtle mr-1">Insert:</span>
        {INSERT_BEHAVIOURS.map((b) => (
          <button
            key={b.token}
            type="button"
            onClick={() =>
              onInsertStep(macro.bindingsList.length, {
                tokens: [b.token, ...(b.token === '&kp' ? ['A'] : [])],
              })
            }
            class="px-3 py-1.5 rounded-lg border border-border bg-surface-0 font-mono text-[11.5px] font-semibold text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          >
            {b.label}
          </button>
        ))}
      </div>

      <div class="mt-auto">
        <MiniCode dark multiline>{preview}</MiniCode>
      </div>
    </div>
  )
}

function StepCard({
  chain,
  index,
  isSelected,
  onClick,
  onRemove,
  isLast,
}: {
  chain: BindingChain
  index: number
  isSelected: boolean
  onClick: () => void
  onRemove: () => void
  isLast: boolean
}) {
  const simple = isSimpleChain(chain)
  return (
    <div class="flex items-center">
      <div class="flex flex-col items-center gap-1.5">
        <div
          class={[
            'flex items-center gap-2 px-3.5 py-3 bg-surface-0 rounded-xl transition-shadow',
            isSelected
              ? 'border-2 border-accent shadow-[var(--shadow-focus-ring)]'
              : 'border border-border shadow-[var(--shadow-key)] hover:shadow-[var(--shadow-key-hover)]',
          ].join(' ')}
        >
          {/* Step body is the interactive area; keeping the remove control
             as a sibling avoids the WAI-ARIA APG "no nested interactive"
             violation the earlier <div role="button"> shell caused. */}
          <button
            type="button"
            aria-current={isSelected ? 'true' : undefined}
            aria-label={`Step ${index + 1}: ${chain.tokens.join(' ') || 'none'}`}
            onClick={onClick}
            class="flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer"
          >
            <span
              class={[
                'w-[22px] h-[22px] flex items-center justify-center rounded-md text-[11px] font-mono font-semibold',
                isSelected ? 'bg-accent text-accent-fg' : 'bg-ink text-ink-fg',
              ].join(' ')}
            >
              {index + 1}
            </span>
            <span class="text-[13.5px] font-mono font-semibold text-fg">
              {chain.tokens.join(' ') || '&none'}
            </span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            class="text-fg-subtle hover:text-danger text-[11px] leading-none ml-1"
            aria-label={`Remove step ${index + 1}`}
          >
            ×
          </button>
        </div>
        <span
          class={[
            'text-[10px]',
            simple ? 'text-fg-subtle' : 'text-warning',
          ].join(' ')}
        >
          {simple ? 'tap' : 'raw'}
        </span>
      </div>
      {!isLast && (
        <span
          class="text-[16px] font-mono font-semibold text-fg-subtle mx-3 mb-4"
          aria-hidden="true"
        >
          →
        </span>
      )}
    </div>
  )
}

function buildRawPreview(macro: MacroEntry): string {
  const label = macro.nodeName ?? macro.name
  const chains = macro.bindingsList
    .map((c) => `<${c.tokens.join(' ')}>`)
    .join(', ')
  return `${macro.name}: ${label} {\n  compatible = "zmk,behavior-macro";\n  bindings = ${chains};\n};`
}
