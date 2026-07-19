import { createRoute } from 'honox/factory'
import { readFile, stat } from 'node:fs/promises'
import { suppressReloadFor } from '../../../codegen/reload-guard'
import { atomicWriteFile } from '../../core/keymap-dt/atomic-write'
import { resolveKeymapPath } from '../../core/keymap-dt/repo-path'

export const GET = createRoute(async (c) => {
  const r = resolveKeymapPath()
  if (!r.ok) return c.json({ ok: false, error: r.reason }, 500)
  try {
    const [text, st] = await Promise.all([readFile(r.keymapPath, 'utf8'), stat(r.keymapPath)])
    return c.json({ ok: true, text, mtimeMs: st.mtimeMs })
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500)
  }
})

export const PUT = createRoute(async (c) => {
  const r = resolveKeymapPath()
  if (!r.ok) return c.json({ ok: false, error: r.reason }, 500)

  const ifMatch = c.req.header('If-Match')
  if (!ifMatch) return c.json({ ok: false, error: 'If-Match header required' }, 400)
  const expectedMtimeMs = Number(ifMatch)
  if (!Number.isFinite(expectedMtimeMs)) {
    return c.json({ ok: false, error: 'If-Match must be a numeric mtimeMs' }, 400)
  }

  let body: { text?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'invalid JSON body' }, 400)
  }
  if (typeof body.text !== 'string') {
    return c.json({ ok: false, error: '"text" must be a string' }, 400)
  }

  // fsevents/chokidar coalesce close-in-time writes; 1500ms covers the reload
  // Vite would otherwise fire in response to this PUT-driven change.
  suppressReloadFor(1500)
  const result = await atomicWriteFile(r.keymapPath, body.text, expectedMtimeMs)
  if (!result.ok) {
    if (result.reason === 'mtime-mismatch') {
      const text = await readFile(r.keymapPath, 'utf8').catch(() => '')
      return c.json(
        {
          ok: false,
          error: 'mtime mismatch',
          currentText: text,
          currentMtimeMs: result.currentMtimeMs,
        },
        409,
      )
    }
    if (result.reason === 'not-found') {
      return c.json({ ok: false, error: 'keymap file not found' }, 500)
    }
    return c.json({ ok: false, error: result.error }, 500)
  }
  return c.json({ ok: true, mtimeMs: result.mtimeMs })
})
