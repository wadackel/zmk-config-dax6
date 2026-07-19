import { useId } from 'hono/jsx'
import type { Child } from 'hono/jsx'

export type SliderProps = {
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
  label?: Child
  hint?: Child
  /** Optional unit label rendered next to the numeric value (`ms`, `px`). */
  unit?: string
  ariaLabel?: string
  disabled?: boolean
  class?: string
}

/**
 * Range slider used by Inspector tuning fields (triggers-per-rotation,
 * stroke-size, tapping-term-ms). The visual track + thumb is drawn with
 * DOM overlays; a fully-transparent native `<input type="range">` sits on
 * top so keyboard and pointer input work without extra JS. Min/max
 * end-labels are optional because the tuning cards on the redesign show
 * them as monospace annotations below the track.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  hint,
  unit,
  ariaLabel,
  disabled = false,
  class: className,
}: SliderProps) {
  const autoId = useId()
  const inputId = `${autoId}-slider`
  const percent = max === min ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <div
      class={['flex flex-col gap-2', disabled ? 'opacity-40' : '', className || ''].join(' ')}
    >
      {(label || value !== undefined) && (
        <div class="flex items-baseline justify-between">
          {label && (
            <label
              htmlFor={inputId}
              class="text-[12px] font-semibold text-fg-muted leading-none"
            >
              {label}
            </label>
          )}
          <span class="text-[13px] font-mono font-semibold text-accent leading-none">
            {value}
            {unit && <span class="text-fg-subtle ml-0.5">{unit}</span>}
          </span>
        </div>
      )}
      <div class="relative h-4 flex items-center">
        <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[color:var(--color-border)]" />
        <div
          aria-hidden="true"
          class="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-accent"
          style={`left: 0; width: ${percent}%`}
        />
        <span
          aria-hidden="true"
          class="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-surface-0 border-2 border-accent shadow-[0_1px_3px_rgb(22_24_29/0.2)] -translate-x-1/2"
          style={`left: ${percent}%`}
        />
        <input
          id={inputId}
          type="range"
          role="slider"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onInput={(e: Event) => {
            const next = Number((e.target as HTMLInputElement).value)
            if (Number.isFinite(next)) onChange(next)
          }}
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
      {hint && (
        <p class="text-[10.5px] text-fg-subtle leading-snug m-0">{hint}</p>
      )}
    </div>
  )
}
