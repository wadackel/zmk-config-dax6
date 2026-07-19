import { Hono } from 'hono'
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _resetBackupForTests } from '../../core/keymap-dt/atomic-write'

const FIXTURE_TEXT = `// minimal valid keymap fixture
/ {
  keymap {
    compatible = "zmk,keymap";
    default_layer {
      bindings = <
${'&trans  '.repeat(44)}
      >;
      sensor-bindings = <&trans>, <&trans>;
    };
  };
};
`

let workRoot: string
let keymapPath: string

async function loadApp() {
  // Re-import after env vars are set so resolveKeymapPath picks them up.
  const [{ GET, PUT }, { POST }] = await Promise.all([
    import('./keymap'),
    import('./keymap-preview'),
  ])
  const app = new Hono()
  // HonoX's createRoute returns an array of handlers — spread to use with Hono's
  // route registration.
  app.get('/api/keymap', ...GET)
  app.put('/api/keymap', ...PUT)
  app.post('/api/keymap-preview', ...POST)
  return app
}

beforeEach(async () => {
  workRoot = await mkdtemp(path.join(os.tmpdir(), 'keymap-api-'))
  await mkdir(path.join(workRoot, 'config'), { recursive: true })
  keymapPath = path.join(workRoot, 'config', 'dax6.keymap')
  await writeFile(keymapPath, FIXTURE_TEXT)
  process.env.DAX6_REPO_ROOT = workRoot
  _resetBackupForTests()
})

afterEach(() => {
  delete process.env.DAX6_REPO_ROOT
})

describe('GET /api/keymap', () => {
  it('returns text + mtimeMs', async () => {
    const app = await loadApp()
    const res = await app.request('/api/keymap')
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; text: string; mtimeMs: number }
    expect(json.ok).toBe(true)
    expect(json.text).toBe(FIXTURE_TEXT)
    expect(typeof json.mtimeMs).toBe('number')
  })
})

describe('POST /api/keymap-preview', () => {
  it('returns diff and lint for a candidate text', async () => {
    const app = await loadApp()
    const modified = FIXTURE_TEXT.replace('&trans', '&kp A   ')
    const res = await app.request('/api/keymap-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: modified }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; diff: string; lint: { ok: boolean } }
    expect(json.ok).toBe(true)
    expect(json.diff).toContain('---')
    expect(json.diff).toContain('+++')
    expect(typeof json.lint.ok).toBe('boolean')
  })
})

describe('PUT /api/keymap', () => {
  it('writes the file when mtime matches', async () => {
    const app = await loadApp()
    const before = await stat(keymapPath)
    const res = await app.request('/api/keymap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': String(before.mtimeMs) },
      body: JSON.stringify({ text: '// NEW' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; mtimeMs: number }
    expect(json.ok).toBe(true)
    expect(await readFile(keymapPath, 'utf8')).toBe('// NEW')
    expect(json.mtimeMs).not.toBe(before.mtimeMs)
  })

  it('returns 409 on mtime mismatch with the current text in the body', async () => {
    const app = await loadApp()
    const res = await app.request('/api/keymap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '0' },
      body: JSON.stringify({ text: '// NEW' }),
    })
    expect(res.status).toBe(409)
    const json = (await res.json()) as {
      ok: boolean
      currentText: string
      currentMtimeMs: number
    }
    expect(json.ok).toBe(false)
    expect(json.currentText).toBe(FIXTURE_TEXT)
    expect(json.currentMtimeMs).toBeGreaterThan(0)
  })

  it('returns 400 when If-Match is absent', async () => {
    const app = await loadApp()
    const res = await app.request('/api/keymap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '// NEW' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 500 when the repo root cannot be located', async () => {
    delete process.env.DAX6_REPO_ROOT
    process.env.DAX6_REPO_ROOT = '/this/path/does/not/exist'
    // Simulate cwd that also lacks config/dax6.keymap.
    const origCwd = process.cwd()
    process.chdir(os.tmpdir())
    try {
      const app = await loadApp()
      const res = await app.request('/api/keymap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': '0' },
        body: JSON.stringify({ text: 'x' }),
      })
      expect(res.status).toBe(500)
      const json = (await res.json()) as { ok: boolean; error: string }
      expect(json.error).toContain('repo root not found')
    } finally {
      process.chdir(origCwd)
    }
  })
})
