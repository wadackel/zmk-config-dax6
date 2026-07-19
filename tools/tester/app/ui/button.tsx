import type { JSX } from 'hono/jsx'

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle' | 'plain'
export type ButtonSize = 'xs' | 'sm' | 'md'

export type ButtonProps = Omit<JSX.IntrinsicElements['button'], 'size' | 'type'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  type?: 'button' | 'submit' | 'reset'
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 font-medium select-none whitespace-nowrap rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

const SIZE: Record<ButtonSize, string> = {
  xs: 'text-[11px] px-2 py-1',
  sm: 'text-xs px-3 py-1.5',
  md: 'text-[13px] px-4 py-2',
}

// Primary carries the slate accent + soft drop shadow that the redesign uses
// on Save / Apply / Commit. Ghost stays outline-only for header controls.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_1px_2px_rgb(79_91_107/0.35)]',
  ghost:
    'bg-surface-0 text-fg-muted border border-border hover:text-fg hover:bg-surface-2',
  subtle:
    'bg-surface-0 text-fg-muted border border-border hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger text-danger-fg hover:brightness-105 shadow-[0_1px_2px_rgb(224_82_77/0.35)]',
  plain: 'bg-transparent text-fg-muted hover:text-fg hover:bg-surface-2 border border-transparent',
}

export function Button({
  variant = 'ghost',
  size = 'md',
  type = 'button',
  class: className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      class={[BASE, SIZE[size], VARIANT[variant], className || ''].join(' ')}
    />
  )
}
