import { createContext, useContext, useReducer } from 'hono/jsx'
import type { JSX } from 'hono/jsx/jsx-runtime'
import { initialState, reducer } from './reducer'
import type { EditorAction, EditorState } from './types'

type EditorContextValue = {
  state: EditorState
  dispatch: (action: EditorAction) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: JSX.Element }) {
  const [state, dispatch] = useReducer(reducer, initialState())
  return <EditorContext.Provider value={{ state, dispatch }}>{children}</EditorContext.Provider>
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used inside an <EditorProvider />')
  return ctx
}
