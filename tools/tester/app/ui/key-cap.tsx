import type { Child, JSX } from 'hono/jsx'

/**
 * Semantic states for a keyboard cap. The concrete visual (background,
 * border, ring, shadow) is derived by CSS from these tokens so Editor and
 * Tester share a single vocabulary — the same `data-state="pressed"` reads
 * the same way in either context.
 */
export type KeyCapState =
  /** Default — neutral `&kp` cell (white). */
  | 'idle'
  /** Behaviour tap variant — `&mt` / `&mo` / `&lt` (off-white). */
  | 'mod'
  /** `&trans` / `&none` placeholder — dashed outline. */
  | 'trans'
  /** Hovered in Editor edit mode. */
  | 'hover'
  /** Selected as an edit target (Inspector focused this cell). */
  | 'selected'
  /** Copy-mode paste target (multi-select). */
  | 'clip-target'
  /** Copy-mode hover with empty clipboard — needs a source pick. */
  | 'clip-source'
  /** Highlighted as part of the active Combo's key positions. */
  | 'combo-target'
  /** Tester: not yet exercised. */
  | 'tester-idle'
  /** Tester: successfully tested. */
  | 'tester-tested'
  /** Tester: currently pressed (glow). */
  | 'tester-pressed'
  /** Tester: chattering detected (danger). */
  | 'tester-error'
  /** Tester: physically absent / marked untestable. */
  | 'tester-untestable'

// `position` is deliberately omitted from BASE so callers can choose between
// `relative` (Editor cells, whose top/sub labels are positioned inside) and
// `absolute` (Tester cells, positioned via left/top style props). Adding
// `relative` here made `absolute` in the caller's class lose the Tailwind
// class-order tiebreaker, collapsing the Tester grid into normal flow.
//
// `aspect-square` enforces 1:1 explicitly so parent flex containers that
// try to stretch cells (Combos board pick-mode grid, e.g.) cannot distort
// the cap regardless of the surrounding layout.
const BASE =
  'w-14 h-14 aspect-square flex flex-col items-center justify-center rounded-lg border font-mono px-1 leading-tight text-center break-words transition-[colors,box-shadow,transform] duration-150 select-none'

const VARIANT: Record<KeyCapState, string> = {
  idle:
    'bg-[color:var(--color-keycap-idle)] border-border text-fg shadow-[var(--shadow-key)]',
  mod: 'bg-[color:var(--color-keycap-mod)] border-border text-fg shadow-[var(--shadow-key)]',
  trans:
    'bg-[color:var(--color-keycap-trans)] border-dashed border-[color:var(--color-border-strong)] text-[color:var(--color-keycap-trans-fg)]',
  hover:
    'bg-[color:var(--color-keycap-idle)] border-[color:var(--color-border-strong)] text-fg shadow-[var(--shadow-key-hover)] -translate-y-px',
  selected:
    'bg-accent-soft border-2 border-accent text-fg shadow-[var(--shadow-focus-ring)]',
  'clip-target':
    'bg-accent-soft border-2 border-accent text-fg shadow-[var(--shadow-focus-ring)]',
  'clip-source':
    'bg-warning-soft border-2 border-warning text-fg shadow-[0_0_0_3px_rgb(176_125_28/0.16)]',
  'combo-target':
    'bg-[rgb(79_91_107/0.12)] border-2 border-accent text-accent shadow-[0_0_0_3px_rgb(79_91_107/0.14)]',
  'tester-idle': 'bg-surface-2 border-border text-fg-muted',
  'tester-tested':
    'bg-accent-soft border-accent text-fg shadow-[0_0_12px_rgb(79_91_107/0.35)]',
  'tester-pressed':
    'bg-accent border-accent text-accent-fg shadow-[0_0_18px_rgb(79_91_107/0.5)] scale-[1.02]',
  'tester-error':
    'bg-danger-soft border-danger text-fg shadow-[0_0_12px_rgb(224_82_77/0.4)]',
  'tester-untestable':
    'bg-[repeating-linear-gradient(45deg,var(--color-surface-2),var(--color-surface-2)_6px,var(--color-surface-3)_6px,var(--color-surface-3)_10px)] border-border text-fg-subtle',
}

export type KeyCapProps = {
  state?: KeyCapState
  /**
   * When true, hover state gets a subtle raised effect. Non-interactive caps
   * (Tester's absolute-positioned keys used purely for display) should keep
   * this off.
   */
  interactive?: boolean
  /**
   * When true, the cap is rendered as a `<button>`. When false, a `<div>`
   * with role="presentation" — used by Tester where physical keys aren't
   * clickable.
   */
  asButton?: boolean
  /**
   * Add hoverable behavior. Combined with `asButton` this yields a
   * keyboard-focusable, clickable cell (Editor).
   */
  hoverable?: boolean
  disabled?: boolean
  title?: string
  ariaLabel?: string
  class?: string
  onClick?: JSX.IntrinsicElements['button']['onClick']
  onContextMenu?: JSX.IntrinsicElements['button']['onContextMenu']
  onMouseEnter?: JSX.IntrinsicElements['button']['onMouseEnter']
  onMouseLeave?: JSX.IntrinsicElements['button']['onMouseLeave']
  style?: string
  children?: Child
}

/**
 * Unified key-cap primitive shared by the keyboard tester and the editor
 * layer grid. Both render the same geometry / border / focus semantics; the
 * `state` prop drives the colour + glow variant so behaviour changes are
 * one-liner CSS tweaks instead of parallel implementations.
 */
export function KeyCap({
  state = 'idle',
  interactive = false,
  asButton = true,
  hoverable = false,
  disabled = false,
  title,
  ariaLabel,
  class: className,
  style,
  onClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  children,
}: KeyCapProps) {
  const hoverClass =
    hoverable && !disabled ? 'hover:shadow-[var(--shadow-key-hover)] cursor-pointer' : ''
  const interactiveClass = interactive && !disabled ? 'active:scale-[0.98]' : ''
  const composedClass = [BASE, VARIANT[state], hoverClass, interactiveClass, className || '']
    .join(' ')
    .trim()

  if (!asButton) {
    return (
      <div
        role="presentation"
        data-state={state}
        title={title}
        aria-label={ariaLabel}
        class={composedClass}
        style={style}
      >
        {children}
      </div>
    )
  }
  return (
    <button
      type="button"
      data-state={state}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      class={composedClass}
      style={style}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  )
}
