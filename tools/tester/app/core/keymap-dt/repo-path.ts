// Resolves the on-disk keymap file for server-side endpoints. The concrete
// relative path and the env var name come from the active board profile so a
// swap picks up its own keymap location.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { getBoard } from '../../boards/active'

export type KeymapPathResult =
  | { ok: true; repoRoot: string; keymapPath: string }
  | { ok: false; reason: 'repo root not found' }

export function resolveKeymapPath(): KeymapPathResult {
  const { envVarName, keymapRelative } = getBoard().keymapSource
  const candidates = [
    process.env[envVarName],
    path.resolve(process.cwd(), '..', '..'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0)

  for (const root of candidates) {
    const candidatePath = path.join(root, keymapRelative)
    if (existsSync(candidatePath)) {
      return { ok: true, repoRoot: root, keymapPath: candidatePath }
    }
  }
  return { ok: false, reason: 'repo root not found' }
}
