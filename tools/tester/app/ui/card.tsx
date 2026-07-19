import type { Child } from 'hono/jsx'

export type CardProps = {
  title?: Child
  description?: Child
  actions?: Child
  padded?: boolean
  class?: string
  children?: Child
}

export function Card({
  title,
  description,
  actions,
  padded = true,
  class: className,
  children,
}: CardProps) {
  return (
    <section
      class={[
        'bg-surface-0 border border-border rounded-xl shadow-[var(--shadow-key)] flex flex-col',
        padded ? 'p-4 gap-3' : '',
        className || '',
      ].join(' ')}
    >
      {(title || actions || description) && (
        <header class="flex items-start justify-between gap-3">
          <div class="flex flex-col gap-0.5">
            {title && (
              <h3 class="text-sm font-semibold text-fg leading-tight m-0">{title}</h3>
            )}
            {description && (
              <p class="text-xs text-fg-subtle leading-snug m-0">{description}</p>
            )}
          </div>
          {actions && <div class="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
