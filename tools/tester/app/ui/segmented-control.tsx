import type { Child } from 'hono/jsx'

export type SegmentedOption<T extends string> = {
  value: T
  label: Child
  disabled?: boolean
  title?: string
}

export type SegmentedControlProps<T extends string> = {
  value: T
  options: SegmentedOption<T>[]
  onChange: (next: T) => void
  ariaLabel?: string
  class?: string
}

/**
 * Enum picker used by Behaviors (flavor: balanced/tap-preferred/hold-preferred)
 * and any other short mutually-exclusive choice. Renders as a `role="radiogroup"`
 * with per-option `role="radio"` — screen readers announce the group name and
 * the current selection; keyboard arrow-nav is native to radiogroups.
 *
 * The visual is a rounded pill container with the active option floating as
 * a white chip on top of a warm-grey base — matches the Behaviors mockup.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  class: className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      class={[
        'inline-flex p-[3px] rounded-lg bg-surface-4 gap-0.5',
        className || '',
      ].join(' ')}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active ? 'true' : 'false'}
            disabled={opt.disabled}
            title={opt.title}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              if (!opt.disabled) onChange(opt.value)
            }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              e.preventDefault()
              const enabled = options.filter((o) => !o.disabled)
              if (enabled.length === 0) return
              const currentIdx = enabled.findIndex((o) => o.value === value)
              const dir = e.key === 'ArrowRight' ? 1 : -1
              const next =
                enabled[(currentIdx + dir + enabled.length) % enabled.length]
              if (next) onChange(next.value)
            }}
            class={[
              'px-3 py-1.5 rounded-md text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              active
                ? 'bg-surface-0 text-fg font-semibold shadow-[0_1px_2px_rgb(22_24_29/0.08)]'
                : 'text-fg-subtle hover:text-fg font-medium',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
