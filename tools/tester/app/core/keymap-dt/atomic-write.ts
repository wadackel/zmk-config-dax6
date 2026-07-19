// Atomic write helper used by the editor's PUT endpoint.
//
// Guarantees:
// - Concurrent edits caught: caller passes the expected mtimeMs; if the current
//   file mtime differs, the write is rejected (409 in the API layer).
// - Atomic on the filesystem level: write to `<target>.tmp` then `rename`.
//   Stale `.tmp` from a previous crashed PUT is removed before the new write.
// - One backup per server-process lifetime: the first successful PUT in the
//   process produces `<target>.<UTC-ISO8601-colons-replaced>.bak` (a copy of
//   the pre-edit content).

import { copyFile, rm, stat, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'

export type AtomicWriteResult =
  | { ok: true; mtimeMs: number; backupPath: string | null }
  | { ok: false; reason: 'mtime-mismatch'; currentMtimeMs: number }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'io-error'; error: string }

const backupDone = new Set<string>()
/** Test hook for resetting the per-process backup state. */
export function _resetBackupForTests(): void {
  backupDone.clear()
}

export async function atomicWriteFile(
  targetPath: string,
  content: string,
  expectedMtimeMs: number,
): Promise<AtomicWriteResult> {
  let currentMtimeMs: number
  try {
    const s = await stat(targetPath)
    currentMtimeMs = s.mtimeMs
  } catch {
    return { ok: false, reason: 'not-found' }
  }
  if (currentMtimeMs !== expectedMtimeMs) {
    return { ok: false, reason: 'mtime-mismatch', currentMtimeMs }
  }

  let backupPath: string | null = null
  if (!backupDone.has(targetPath)) {
    backupPath = backupPathFor(targetPath)
    try {
      await copyFile(targetPath, backupPath)
      backupDone.add(targetPath)
    } catch (err) {
      return { ok: false, reason: 'io-error', error: (err as Error).message }
    }
  }

  const tmpPath = `${targetPath}.tmp`
  try {
    await rm(tmpPath, { force: true })
    await writeFile(tmpPath, content)
    await rename(tmpPath, targetPath)
  } catch (err) {
    return { ok: false, reason: 'io-error', error: (err as Error).message }
  }

  const finalStat = await stat(targetPath)
  return { ok: true, mtimeMs: finalStat.mtimeMs, backupPath }
}

function backupPathFor(targetPath: string): string {
  const dir = path.dirname(targetPath)
  const base = path.basename(targetPath)
  const iso = new Date().toISOString().replace(/:/g, '-')
  return path.join(dir, `${base}.${iso}.bak`)
}
