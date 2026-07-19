// LocalStorage-backed list of recently used keycode tokens. The binding-picker
// shows these at the top of the combobox when the query is empty, so the user's
// last few edits are 1 click away on next reload.

import { getBoard } from '../../boards/active'

const MAX_RECENT = 12

function storageKey(): string {
  return getBoard().storage.recentKeycodesKey
}

function getStorage(): Storage | null {
  // Browser: window.localStorage. Node tests under jsdom set this up too.
  // Other Node contexts (codegen, SSG) have no localStorage; skip silently.
  if (typeof globalThis === 'undefined') return null
  const ls = (globalThis as { localStorage?: Storage }).localStorage
  return ls ?? null
}

export function loadRecentKeycodes(): string[] {
  const storage = getStorage()
  if (!storage) return []
  const raw = storage.getItem(storageKey())
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

/**
 * Prepends `token` to the recent list, removing earlier duplicates and
 * trimming to MAX_RECENT entries. Returns the new list (also persisted).
 */
export function pushRecentKeycode(token: string): string[] {
  const storage = getStorage()
  const trimmed = token.trim()
  if (!trimmed) return loadRecentKeycodes()
  const current = loadRecentKeycodes().filter((t) => t !== trimmed)
  const next = [trimmed, ...current].slice(0, MAX_RECENT)
  if (storage) {
    try {
      storage.setItem(storageKey(), JSON.stringify(next))
    } catch {
      // Quota / disabled storage — fall through. Best-effort persistence.
    }
  }
  return next
}

/** Test-only helper to wipe storage between cases. */
export function _resetRecentKeycodesForTests(): void {
  const storage = getStorage()
  storage?.removeItem(storageKey())
}

export const RECENT_KEYCODES_LIMIT = MAX_RECENT
