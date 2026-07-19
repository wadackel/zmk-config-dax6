import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _resetBackupForTests, atomicWriteFile } from './atomic-write'

let workDir: string
let targetPath: string

beforeEach(async () => {
  workDir = await mkdtemp(path.join(os.tmpdir(), 'keymap-aw-'))
  targetPath = path.join(workDir, 'sample.txt')
  await writeFile(targetPath, 'ORIGINAL')
  _resetBackupForTests()
})

afterEach(() => {
  // Vitest cleans up tmp dirs at end of suite; per-test cleanup is unnecessary.
})

describe('atomicWriteFile', () => {
  it('writes the file when mtime matches', async () => {
    const before = await stat(targetPath)
    const res = await atomicWriteFile(targetPath, 'NEW', before.mtimeMs)
    expect(res.ok).toBe(true)
    expect(await readFile(targetPath, 'utf8')).toBe('NEW')
  })

  it('rejects the write when the mtime token does not match', async () => {
    const res = await atomicWriteFile(targetPath, 'NEW', 0)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toBe('mtime-mismatch')
      // No content change.
      expect(await readFile(targetPath, 'utf8')).toBe('ORIGINAL')
    }
  })

  it('creates exactly one backup per server process lifetime', async () => {
    const s1 = await stat(targetPath)
    const r1 = await atomicWriteFile(targetPath, 'NEW1', s1.mtimeMs)
    expect(r1.ok).toBe(true)

    const s2 = await stat(targetPath)
    const r2 = await atomicWriteFile(targetPath, 'NEW2', s2.mtimeMs)
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.backupPath).toBeNull()
    }

    const files = await readdir(workDir)
    const baks = files.filter((f) => f.endsWith('.bak'))
    expect(baks.length).toBe(1)
    // Backup must contain the pre-edit content.
    const bakContent = await readFile(path.join(workDir, baks[0]), 'utf8')
    expect(bakContent).toBe('ORIGINAL')
  })

  it('overwrites a stale .tmp from a prior crashed PUT', async () => {
    await writeFile(targetPath + '.tmp', 'STALE')
    const before = await stat(targetPath)
    const res = await atomicWriteFile(targetPath, 'NEW', before.mtimeMs)
    expect(res.ok).toBe(true)
    expect(await readFile(targetPath, 'utf8')).toBe('NEW')
    // Stale tmp must be gone.
    await expect(stat(targetPath + '.tmp')).rejects.toThrow()
  })

  it('reports not-found when the target file does not exist', async () => {
    const res = await atomicWriteFile(path.join(workDir, 'missing'), 'X', 0)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toBe('not-found')
    }
  })
})
