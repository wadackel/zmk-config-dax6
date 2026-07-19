import { createContext, useContext, useEffect, useId, useRef } from 'hono/jsx'
import type { Child } from 'hono/jsx'
import { useModalStack } from './modal-stack'

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

// Every consumer button that closes a Dialog — Cancel, Confirm, Commit, and
// so on — must funnel through this context so the modal-stack pop / body
// scroll unlock / focus restore all fire BEFORE the parent's state change
// unmounts the Dialog. If a caller invokes its own onCancel/onCommit prop
// directly the teardown is skipped (hono/jsx does not fire useEffect cleanup
// on conditional unmount) and the shortcuts stay suppressed forever.
type DialogCloseApi = {
  /** Runs teardown then invokes the parent's `onClose`. Use for Cancel. */
  close: () => void
  /** Runs teardown only; the caller then invokes its own callback that will
   *  unmount the Dialog (e.g. `commit()` → parent setEditing(null)). */
  runTeardown: () => void
}

const DialogCloseContext = createContext<DialogCloseApi>({
  close: () => {},
  runTeardown: () => {},
})

/**
 * Access the current Dialog's close API from inside `children`/`footer`.
 * Consumers replace their footer button's `onClick={props.onCancel}` with
 * `onClick={close}`, and their commit path with `runTeardown(); customAction()`.
 */
export function useDialogClose(): DialogCloseApi {
  return useContext(DialogCloseContext)
}

// Walks the ancestor chain from `start` to `stopAt`, marking every SIBLING at
// each level with the `inert` attribute (skipping siblings that were already
// inert so we don't clobber a caller's own setting). Returns a cleanup fn
// that removes only the attributes this call set — nested dialogs stay safe.
//
// The alternative — a single `inert` on `document.body` — would also silence
// the dialog itself, since the dialog is rendered inside the same tree. A
// portal to `document.body` would side-step that, but hono/jsx has no
// createPortal, so we walk instead.
function inertSiblingsUpTo(start: HTMLElement, stopAt: HTMLElement): () => void {
  const marked: HTMLElement[] = []
  let cur: HTMLElement | null = start
  while (cur && cur !== stopAt) {
    const parent: HTMLElement | null = cur.parentElement
    if (!parent) break
    for (const child of Array.from(parent.children)) {
      if (child === cur) continue
      if (!(child instanceof HTMLElement)) continue
      if (child.hasAttribute('inert')) continue
      // Toast container carries `data-live-region`; inert-ing it would
      // silence screen-reader announcements that fire while the dialog is
      // still open (e.g. Save failure toasts).
      if (child.hasAttribute('data-live-region')) continue
      if (child.querySelector('[data-live-region]')) continue
      child.setAttribute('inert', '')
      marked.push(child)
    }
    cur = parent
  }
  return () => {
    for (const el of marked) el.removeAttribute('inert')
  }
}

const SIZE: Record<DialogSize, string> = {
  sm: 'w-[min(90vw,420px)]',
  md: 'w-[min(90vw,640px)]',
  lg: 'w-[min(94vw,880px)]',
  xl: 'w-[min(96vw,1100px)]',
}

export type DialogProps = {
  open: boolean
  onClose: () => void
  title?: Child
  description?: Child
  size?: DialogSize
  /**
   * When true (default), clicking the backdrop closes the dialog.
   */
  closeOnBackdrop?: boolean
  /**
   * When true (default), Escape closes the dialog. Pickers that want to
   * intercept Escape (e.g. to close an inner combobox first) can set false
   * and handle Escape themselves.
   */
  closeOnEscape?: boolean
  /**
   * Additional class names applied to the panel container.
   */
  panelClass?: string
  /**
   * Optional hint rendered top-right ("⌘↵ to commit · esc to cancel").
   */
  hint?: Child
  /**
   * Optional footer. Accepts either static JSX (for footers that only route
   * close through their own state changes — e.g. `close` from context) or a
   * render function that receives `{ close, runTeardown }` so buttons can
   * fire teardown synchronously before triggering parent unmount.
   */
  footer?: Child | ((api: DialogCloseApi) => Child)
  children: Child | ((api: DialogCloseApi) => Child)
  /**
   * Optional label used when `title` is not a string that can be read out.
   * Overrides the auto-generated aria-labelledby target.
   */
  ariaLabel?: string
}

type TeardownRef = {
  done: boolean
  fn?: () => void
}

// hono/jsx does not run a component's useEffect cleanup when the component is
// unmounted via a conditional render (`{cond && <Dialog>}`). That would strand
// the modal stack counter and the body scroll lock — Undo/Redo would stay
// suppressed after the picker closed and the page could never scroll again.
// Every close path (Escape, backdrop, footer button) is routed through
// `handleClose`, which flushes the teardown before invoking the parent's
// `onClose`. The useEffect cleanup remains as a defence for the always-mount
// pattern (parents that flip `open` without unmounting), guarded by
// `teardownRef.current.done` so we never fire it twice.
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  panelClass,
  hint,
  footer,
  children,
  ariaLabel,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const teardownRef = useRef<TeardownRef>({ done: true })
  const autoId = useId()
  const titleId = title ? `${autoId}-title` : undefined
  const descId = description ? `${autoId}-desc` : undefined
  const stack = useModalStack()

  useEffect(() => {
    if (!open) {
      // If `open` flipped from true → false while still mounted, run the
      // pending teardown from the previous open state.
      if (!teardownRef.current?.done) {
        teardownRef.current?.fn?.()
        teardownRef.current = { done: true }
      }
      return
    }

    // Only install once per open cycle. If the effect re-runs for reasons
    // other than an open→open transition (there shouldn't be any, given the
    // single dep) the `done === false` guard prevents a double-push.
    if (teardownRef.current && !teardownRef.current.done) return

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prevOverflow = document.body.style.overflow

    stack.push()
    document.body.style.overflow = 'hidden'

    let uninertBackground: (() => void) | null = null
    queueMicrotask(() => {
      const panel = panelRef.current
      if (!panel) return
      const first = panel.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
      uninertBackground = inertSiblingsUpTo(panel, document.body)
    })

    teardownRef.current = {
      done: false,
      fn: () => {
        document.body.style.overflow = prevOverflow
        stack.pop()
        uninertBackground?.()
        previousFocus?.focus?.()
      },
    }

    return () => {
      if (!teardownRef.current?.done) {
        teardownRef.current?.fn?.()
        teardownRef.current = { done: true }
      }
    }
  }, [open])

  if (!open) return null

  const runTeardown = () => {
    if (teardownRef.current && !teardownRef.current.done) {
      teardownRef.current.fn?.()
      teardownRef.current = { done: true }
    }
  }

  // Primary close path. Runs the modal-stack / scroll-lock / focus-restore
  // teardown synchronously so the parent is free to unmount us immediately.
  const flushTeardownAndClose = () => {
    runTeardown()
    onClose()
  }

  const handleBackdropClick = () => {
    if (closeOnBackdrop) flushTeardownAndClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    if (closeOnEscape && e.key === 'Escape') {
      e.preventDefault()
      flushTeardownAndClose()
      return
    }
    if (e.key === 'Tab') {
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <DialogCloseContext.Provider value={{ close: flushTeardownAndClose, runTeardown }}>
      <div
        class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] bg-[color:var(--color-backdrop)]"
        onClick={handleBackdropClick}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={titleId}
          aria-describedby={descId}
          onClick={(e: Event) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          class={[
            'bg-surface-dialog border border-border rounded-xl shadow-popover',
            'max-h-[85vh] overflow-auto flex flex-col',
            SIZE[size],
            panelClass || '',
          ].join(' ')}
        >
          {(title || hint) && (
            <header class="px-5 pt-4 pb-2 flex items-start justify-between gap-3 border-b border-border-subtle">
              <div class="flex flex-col gap-0.5 min-w-0">
                {title && (
                  <h2 id={titleId} class="text-base font-semibold text-fg m-0 leading-snug">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} class="text-xs text-fg-subtle leading-snug m-0">
                    {description}
                  </p>
                )}
              </div>
              {hint && <div class="text-[10px] text-fg-subtle mt-1 shrink-0">{hint}</div>}
            </header>
          )}
          <div class="px-5 py-4 flex flex-col gap-3 min-h-0 overflow-auto">
            {typeof children === 'function'
              ? children({ close: flushTeardownAndClose, runTeardown })
              : children}
          </div>
          {footer && (
            <footer class="px-5 py-3 border-t border-border-subtle flex justify-end gap-2">
              {typeof footer === 'function'
                ? footer({ close: flushTeardownAndClose, runTeardown })
                : footer}
            </footer>
          )}
        </div>
      </div>
    </DialogCloseContext.Provider>
  )
}
