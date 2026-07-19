import type { MacroEntry } from '../../../../core/keymap-dt/types'
import { isMacroSimple } from './macro-shape'

export type MacroListProps = {
  macros: MacroEntry[]
  activeIdx: number | null
  onSelect: (idx: number) => void
  onAdd: () => void
}

/**
 * Left column of the Macros tab. Rows carry a SIMPLE / RAW badge computed
 * from `isMacroSimple` so users know which macros will open in the picker
 * inspector vs. the raw text fallback before they click.
 */
export function MacroList({ macros, activeIdx, onSelect, onAdd }: MacroListProps) {
  return (
    <aside
      aria-label="Macros"
      class="w-[190px] flex-none border-r border-border-subtle p-4 flex flex-col gap-1 overflow-auto"
    >
      <div class="flex items-center justify-between px-1.5 pb-2">
        <span class="text-[10.5px] font-mono font-semibold tracking-wider text-fg-subtle">
          MACROS
        </span>
        <button
          type="button"
          onClick={onAdd}
          class="text-[15px] font-semibold text-fg-muted hover:text-fg leading-none"
          aria-label="Add macro"
          title="Add macro"
        >
          +
        </button>
      </div>
      {macros.length === 0 && (
        <span class="text-[11px] text-fg-subtle px-1.5 py-1">No macros defined.</span>
      )}
      {macros.map((macro, idx) => {
        const isActive = idx === activeIdx
        const simple = isMacroSimple(macro)
        return (
          <button
            key={`${macro.name}-${idx}`}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(idx)}
            class={[
              'flex flex-col gap-1 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left',
              isActive ? 'bg-ink text-ink-fg' : 'hover:bg-surface-3 border border-border-subtle',
            ].join(' ')}
          >
            <div class="flex items-center gap-2">
              <span
                class={[
                  'text-[13px] font-semibold truncate',
                  isActive ? '' : 'text-fg',
                ].join(' ')}
              >
                {macro.name}
              </span>
              <span
                class={[
                  'text-[9px] font-mono font-semibold uppercase tracking-wider rounded-md px-1.5 py-0.5',
                  simple
                    ? isActive
                      ? 'bg-[color:var(--color-ink-fg)]/20 text-[color:var(--color-ink-fg)]'
                      : 'bg-surface-4 text-fg-muted'
                    : 'bg-warning-soft text-warning',
                ].join(' ')}
              >
                {simple ? 'Simple' : 'Raw'}
              </span>
            </div>
            <span
              class={[
                'text-[11px] font-mono',
                isActive ? 'text-[color:var(--color-ink-fg)]/60' : 'text-fg-subtle',
              ].join(' ')}
            >
              {simple ? `${macro.bindingsList.length} steps` : 'multi-behaviour'}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
