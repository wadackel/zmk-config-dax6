import type { Child } from 'hono/jsx'

export type MiniCodeProps = {
  /** When true, renders as a dark card (ink surface) — used for raw DTS
   *  previews on the light board area. Default renders as a light chip. */
  dark?: boolean
  /** Multi-line content preserves whitespace + wraps long tokens. */
  multiline?: boolean
  class?: string
  children: Child
}

/**
 * Monospace code presentation used in two places:
 *   - **Chip mode** (default): inline `&kp A` style pill on light surface.
 *   - **Dark mode**: raw DTS preview block on the ink surface, e.g. the
 *     macro chain raw preview at the bottom of the Macros stage.
 *
 * Extracted so the two visual variants stay in one place; the redesign uses
 * both across every tab. The dark variant matches the `#16181d` fill used
 * in the Macros / MouseGestures / Sensors previews on the design canvas.
 */
export function MiniCode({
  dark = false,
  multiline = false,
  class: className,
  children,
}: MiniCodeProps) {
  if (dark) {
    return (
      <pre
        class={[
          'bg-ink text-[color:var(--color-fg-subtle)] rounded-xl p-4 text-[12px] leading-[1.7] font-mono overflow-auto m-0',
          multiline ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
          className || '',
        ].join(' ')}
      >
        {children}
      </pre>
    )
  }
  return (
    <code
      class={[
        'inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-3 text-fg text-[12px] font-mono border border-border-subtle',
        multiline ? 'whitespace-pre-wrap' : '',
        className || '',
      ].join(' ')}
    >
      {children}
    </code>
  )
}
