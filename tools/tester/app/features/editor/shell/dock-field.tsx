import type { Child } from 'hono/jsx'

export type DockFieldProps = {
  label: string
  active?: boolean
  children: Child
  /**
   * Optional overlay rendered as a sibling of the pill inside the same
   * `position:relative` wrapper. Used by comboboxes to anchor their
   * popover to the field's coordinate space without introducing a
   * second positioned ancestor that would fight the pill's flex layout.
   */
  overlay?: Child
}

const LABEL_BASE =
  'absolute bottom-full left-0 mb-[6px] whitespace-nowrap font-mono font-semibold text-[8.5px] leading-none uppercase tracking-[.06em]'

const CHROME_BASE =
  'flex items-center gap-[7px] w-full px-[12px] py-[9px] rounded-[6px] bg-white box-border'

const CHROME_IDLE = 'border border-[rgba(22,24,29,.14)]'

const CHROME_ACTIVE =
  'border-[1.5px] border-accent shadow-[0_0_0_3px_rgba(79,91,107,.1)]'

/**
 * Shared field chrome for the bottom dock: an absolutely-positioned
 * uppercase micro-label floating above a white pill container. Callers
 * supply the inner controls (input + secondary label + arrow, or a
 * select, or a preview span) as `children`.
 *
 * The absolute label sits outside the container's flow so a row of
 * fields stays vertically aligned on the pill baseline regardless of
 * label presence — dropping labels below the row would push everything
 * downward and break the single-baseline design.
 */
export function DockField({ label, active = false, children, overlay }: DockFieldProps) {
  const labelColor = active ? 'text-accent' : 'text-fg-subtler'
  const chrome = active ? CHROME_ACTIVE : CHROME_IDLE
  return (
    <div class="relative">
      <span class={`${LABEL_BASE} ${labelColor}`}>{label}</span>
      <div class={`${CHROME_BASE} ${chrome}`}>{children}</div>
      {overlay}
    </div>
  )
}
