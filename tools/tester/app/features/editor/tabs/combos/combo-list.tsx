import { useState } from 'hono/jsx'
import { CommittingTextInput } from '../../../../ui/field'
import { useEditor } from '../../../../core/editor-state/context'
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
 *
 * Inline rename mirrors the LayerList contract: double-click / F2 swaps
 * the name into a CommittingTextInput; commit-on-blur / Enter dispatches
 * RENAME_COMBO, Escape reverts. The row is `<div role="button">` rather
 * than `<button>` because a native button cannot legally nest an input.
 */
export function ComboList({ combos, activeIdx, onSelect, onAdd }: ComboListProps) {
  const { dispatch } = useEditor()
  const [renaming, setRenaming] = useState<number | null>(null)

  const startRename = (idx: number) => setRenaming(idx)
  const commitRename = (idx: number, name: string) => {
    if (name.trim() !== combos[idx].name) {
      dispatch({ type: 'RENAME_COMBO', index: idx, name })
    }
    setRenaming(null)
  }

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
        const isRenaming = renaming === idx
        const summary = `${combo.bindings.tokens.join(' ')} · pos ${combo.keyPositions.join(',')}`
        return (
          <div
            key={idx}
            role="button"
            tabIndex={isRenaming ? -1 : 0}
            aria-current={isActive ? 'true' : undefined}
            aria-label={`Combo ${combo.name}. Enter to select, F2 to rename`}
            onClick={() => {
              if (!isRenaming) onSelect(idx)
            }}
            onDblClick={() => startRename(idx)}
            onKeyDown={(e: KeyboardEvent) => {
              if (isRenaming) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(idx)
                return
              }
              if (e.key === 'F2') {
                e.preventDefault()
                startRename(idx)
              }
            }}
            class={[
              'flex flex-col gap-1 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left',
              isActive ? 'bg-ink text-ink-fg' : 'hover:bg-surface-3 border border-border-subtle',
            ].join(' ')}
          >
            {isRenaming ? (
              <CommittingTextInput
                value={combo.name}
                onCommit={(name) => commitRename(idx, name)}
                onBlur={() => setRenaming(null)}
                class="!px-1.5 !py-0.5 !text-[13px] font-semibold"
                autoFocus
                aria-label={`Rename combo ${combo.name}`}
              />
            ) : (
              <span
                class={[
                  'text-[13px] font-semibold truncate',
                  isActive ? '' : 'text-fg',
                ].join(' ')}
              >
                {combo.name}
              </span>
            )}
            <span
              class={[
                'text-[11px] font-mono truncate',
                isActive ? 'text-[color:var(--color-ink-fg)]/60' : 'text-fg-subtle',
              ].join(' ')}
            >
              {summary}
            </span>
          </div>
        )
      })}
    </aside>
  )
}
