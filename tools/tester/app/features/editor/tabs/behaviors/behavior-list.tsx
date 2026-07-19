import type { BehaviorEntry, RootBehaviorConfig } from '../../../../core/keymap-dt/types'

const KIND_LABEL: Record<'mt' | 'lt', string> = {
  mt: 'mod-tap',
  lt: 'layer-tap',
}

export type BehaviorSelection =
  | { kind: 'root'; idx: number }
  | { kind: 'custom'; idx: number }

export type BehaviorListProps = {
  root: RootBehaviorConfig[]
  custom: BehaviorEntry[]
  active: BehaviorSelection | null
  onSelect: (sel: BehaviorSelection) => void
}

/**
 * Two-section left column for the Behaviors tab. Global (`&mt` / `&lt`)
 * are the ZMK-provided root behaviours whose props tune every use of that
 * behaviour keymap-wide. Custom entries are `behavior-hold-tap` /
 * `behavior-tap-dance` / … blocks defined in the keymap and reachable via
 * their `&label`.
 */
export function BehaviorList({ root, custom, active, onSelect }: BehaviorListProps) {
  return (
    <aside
      aria-label="Behaviors"
      class="w-[190px] flex-none border-r border-border-subtle p-4 flex flex-col gap-1 overflow-auto"
    >
      <span class="text-[10.5px] font-mono font-semibold tracking-wider text-fg-subtle px-1.5 pb-2">
        GLOBAL
      </span>
      {root.map((rb, i) => {
        const isActive = active?.kind === 'root' && active.idx === i
        return (
          <button
            key={`${rb.kind}-${i}`}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect({ kind: 'root', idx: i })}
            class={[
              'flex flex-col gap-1 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left',
              isActive ? 'bg-ink text-ink-fg' : 'hover:bg-surface-3 border border-border-subtle',
            ].join(' ')}
          >
            <span
              class={[
                'text-[13px] font-mono font-semibold',
                isActive ? '' : 'text-fg',
              ].join(' ')}
            >
              &{rb.kind}
            </span>
            <span
              class={[
                'text-[10.5px]',
                isActive ? 'text-[color:var(--color-ink-fg)]/60' : 'text-fg-subtle',
              ].join(' ')}
            >
              {KIND_LABEL[rb.kind]}
            </span>
          </button>
        )
      })}

      <span class="text-[10.5px] font-mono font-semibold tracking-wider text-fg-subtle px-1.5 pt-3 pb-2">
        CUSTOM
      </span>
      {custom.length === 0 && (
        <span class="text-[11px] text-fg-subtle px-1.5">
          No custom behaviours.
        </span>
      )}
      {custom.map((b, i) => {
        const isActive = active?.kind === 'custom' && active.idx === i
        const subtitle = b.compatible.replace(/^"|"$/g, '').replace(/^zmk,behavior-/, '')
        return (
          <button
            key={`${b.name}-${i}`}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect({ kind: 'custom', idx: i })}
            class={[
              'flex flex-col gap-1 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left',
              isActive ? 'bg-ink text-ink-fg' : 'hover:bg-surface-3 border border-border-subtle',
            ].join(' ')}
          >
            <span
              class={[
                'text-[13px] font-mono font-semibold truncate',
                isActive ? '' : 'text-fg',
              ].join(' ')}
            >
              &{b.name}
            </span>
            <span
              class={[
                'text-[10.5px] truncate',
                isActive ? 'text-[color:var(--color-ink-fg)]/60' : 'text-fg-subtle',
              ].join(' ')}
            >
              {subtitle}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
