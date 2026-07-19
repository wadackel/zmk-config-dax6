import { useId } from 'hono/jsx'
import type { Child } from 'hono/jsx'

export type ToggleProps = {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  /** Visible label rendered before the switch. Prefer wrapping in <Field>
   *  when you need a description; this is the compact inline form. */
  label?: Child
  /** Optional short description under/beside the label — same tone. */
  hint?: Child
  ariaLabel?: string
  class?: string
}

/**
 * iOS-style switch used by the redesigned Inspector for single-bool
 * properties (eager-mode, hold-trigger-on-release, etc.). Semantically a
 * `role="switch"` button with `aria-checked`; the visual affordance is a
 * pill with a knob that slides on state change.
 *
 * The ARIA choice is deliberate: `role="switch"` conveys "on/off setting",
 * matching the redesign's usage exclusively for individual property flags.
 * A `role="checkbox"` (like Chip) would imply set membership.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  hint,
  ariaLabel,
  class: className,
}: ToggleProps) {
  const autoId = useId()
  const descId = hint ? `${autoId}-hint` : undefined
  return (
    <label
      class={[
        'flex items-center justify-between gap-3 select-none',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        className || '',
      ].join(' ')}
    >
      {(label || hint) && (
        <span class="flex flex-col gap-0.5 min-w-0">
          {label && (
            <span class="text-[12.5px] font-semibold text-fg leading-none">{label}</span>
          )}
          {hint && (
            <span id={descId} class="text-[10.5px] text-fg-subtle leading-snug">
              {hint}
            </span>
          )}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked ? 'true' : 'false'}
        aria-label={ariaLabel}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        class={[
          'relative inline-block w-10 h-[23px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-[color:var(--color-border)]',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          class={[
            'absolute top-[2px] w-[19px] h-[19px] rounded-full bg-surface-0 shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-[left]',
            checked ? 'left-[18px]' : 'left-[2px]',
          ].join(' ')}
        />
      </button>
    </label>
  )
}
