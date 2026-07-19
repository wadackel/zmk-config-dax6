import type { ComboEntry } from '../../../../core/keymap-dt/types'

export type ComboListProps = {
  combos: ComboEntry[]
  activeIdx: number | null
  onSelect: (idx: number) => void
  onAdd: () => void
}

/**
 * Left column of the Combos tab. Each row shows the combo name plus a
 * one-line summary (`&kp ESC · pos 13,14`) so the user can identify a
 * combo without opening the inspector.
 */
export function ComboList({ combos, activeIdx, onSelect, onAdd }: ComboListProps) {
  return (
    <aside
      aria-label="Combos"
      class="w-[190px] flex-none border-r border-border-subtle p-4 flex flex-col gap-1 overflow-auto"
    >
      <div class="flex items-center justify-between px-1.5 pb-2">
        <span class="text-[10.5px] font-mono font-semibold tracking-wider text-fg-subtle">
          COMBOS
        </span>
        <button
          type="button"
          onClick={onAdd}
          class="text-[15px] font-semibold text-fg-muted hover:text-fg leading-none"
          aria-label="Add combo"
          title="Add combo"
        >
          +
        </button>
      </div>
      {combos.length === 0 && (
        <span class="text-[11px] text-fg-subtle px-1.5 py-1">
          No combos defined.
        </span>
      )}
      {combos.map((combo, idx) => {
        const isActive = idx === activeIdx
        const summary = `${combo.bindings.tokens.join(' ')} · pos ${combo.keyPositions.join(',')}`
        return (
          <button
            key={`${combo.name}-${idx}`}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(idx)}
            class={[
              'flex flex-col gap-1 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left',
              isActive ? 'bg-ink text-ink-fg' : 'hover:bg-surface-3 border border-border-subtle',
            ].join(' ')}
          >
            <span
              class={[
                'text-[13px] font-semibold truncate',
                isActive ? '' : 'text-fg',
              ].join(' ')}
            >
              {combo.name}
            </span>
            <span
              class={[
                'text-[11px] font-mono truncate',
                isActive ? 'text-[color:var(--color-ink-fg)]/60' : 'text-fg-subtle',
              ].join(' ')}
            >
              {summary}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
