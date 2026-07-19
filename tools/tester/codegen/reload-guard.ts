import { branding } from '../app/boards/dax6/branding'

const KEY = Symbol.for(branding.reloadGuardSymbolKey)

type Guard = { suppressUntilMs: number }

const g = globalThis as unknown as { [key: symbol]: Guard | undefined }
if (!g[KEY]) g[KEY] = { suppressUntilMs: 0 }

export const reloadGuard = g[KEY]!

export function suppressReloadFor(ms: number): void {
  reloadGuard.suppressUntilMs = Date.now() + ms
}

export function isReloadSuppressed(): boolean {
  return Date.now() < reloadGuard.suppressUntilMs
}
