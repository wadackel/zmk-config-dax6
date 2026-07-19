import { createContext, useContext, useState, useCallback } from 'hono/jsx'
import type { Child } from 'hono/jsx'

/**
 * ModalStack tracks the number of open modal-like layers (Dialog, popover
 * menu, etc.). Consumers (Dialog primitive) increment on open and decrement
 * on close. The editor's global keyboard shortcuts (Undo/Redo) consult
 * `count > 0` to suppress themselves while any modal is active — otherwise
 * a Cmd+Z fired while a picker is open mutates the underlying draft and
 * breaks the picker's local state parity.
 */
type ModalStackContext = {
  count: number
  push: () => void
  pop: () => void
}

const Ctx = createContext<ModalStackContext>({
  count: 0,
  push: () => {},
  pop: () => {},
})

export function ModalStackProvider({ children }: { children: Child }) {
  const [count, setCount] = useState(0)
  const push = useCallback(() => setCount((c) => c + 1), [])
  const pop = useCallback(() => setCount((c) => Math.max(0, c - 1)), [])
  return <Ctx.Provider value={{ count, push, pop }}>{children}</Ctx.Provider>
}

export function useModalStack(): ModalStackContext {
  return useContext(Ctx)
}
