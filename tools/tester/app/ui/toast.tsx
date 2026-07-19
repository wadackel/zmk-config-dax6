import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'hono/jsx'
import type { Child } from 'hono/jsx'

export type ToastTone = 'success' | 'warning' | 'danger' | 'info'

export type Toast = {
  id: number
  tone: ToastTone
  message: string
  /** Optional description under the main message. */
  detail?: string
  /** Milliseconds to auto-dismiss. `0` = never (manual close only). */
  durationMs?: number
}

type ToastContextValue = {
  push: (t: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
}

const Ctx = createContext<ToastContextValue>({
  push: () => 0,
  dismiss: () => {},
})

/** Provider that renders an aria-live region with active toasts. */
export function ToastProvider({ children }: { children: Child }) {
  const [items, setItems] = useState<Toast[]>([])
  const nextIdRef = useRef<{ v: number }>({ v: 1 })
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    const map = timersRef.current
    if (map) {
      const t = map.get(id)
      if (t) {
        clearTimeout(t)
        map.delete(id)
      }
    }
    setItems((cur) => cur.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const counter = nextIdRef.current ?? { v: 1 }
      const id = counter.v++
      nextIdRef.current = counter
      const duration = t.durationMs ?? 4500
      setItems((cur) => [...cur, { ...t, id }])
      if (duration > 0 && timersRef.current) {
        timersRef.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    return () => {
      const map = timersRef.current
      if (!map) return
      for (const t of map.values()) clearTimeout(t)
      map.clear()
    }
  }, [])

  return (
    <Ctx.Provider value={{ push, dismiss }}>
      {children}
      <div
        class="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notifications"
        // Dialog's `inertSiblingsUpTo` walks the tree marking non-ancestor
        // siblings inert; without this marker the toast container becomes
        // inert whenever a modal is open, and a `toast.push({tone:'danger'})`
        // fired during Save failure would never reach the screen reader.
        data-live-region="true"
      >
        {items.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'border-success/50 bg-success-soft text-fg',
  warning: 'border-warning/60 bg-warning-soft text-fg',
  danger: 'border-danger/60 bg-danger-soft text-fg',
  info: 'border-accent/60 bg-accent-soft text-fg',
}

const TONE_DOT: Record<ToastTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-accent',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role={toast.tone === 'danger' || toast.tone === 'warning' ? 'alert' : 'status'}
      aria-live={toast.tone === 'danger' || toast.tone === 'warning' ? 'assertive' : 'polite'}
      class={[
        'pointer-events-auto min-w-[220px] max-w-[360px] border rounded-md shadow-panel px-3 py-2 flex gap-2 items-start',
        TONE_CLASS[toast.tone],
      ].join(' ')}
    >
      <span
        class={['inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', TONE_DOT[toast.tone]].join(' ')}
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm leading-snug">{toast.message}</div>
        {toast.detail && <div class="text-xs text-fg-muted mt-0.5 leading-snug">{toast.detail}</div>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        class="text-fg-subtle hover:text-fg text-xs leading-none px-1"
      >
        ×
      </button>
    </div>
  )
}
