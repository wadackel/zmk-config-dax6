import { createPatch } from 'diff'
import { createRoute } from 'honox/factory'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getBoard } from '../../boards/active'
import { lint } from '../../core/keymap-dt/lint'
import { resolveKeymapPath } from '../../core/keymap-dt/repo-path'

export const POST = createRoute(async (c) => {
  const r = resolveKeymapPath()
  if (!r.ok) return c.json({ ok: false, error: r.reason }, 500)

  let body: { text?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'invalid JSON body' }, 400)
  }
  if (typeof body.text !== 'string') {
    return c.json({ ok: false, error: '"text" must be a string' }, 400)
  }

  const current = await readFile(r.keymapPath, 'utf8').catch(() => '')
  const diffLabel = path.basename(getBoard().keymapSource.keymapRelative)
  const diff = createPatch(diffLabel, current, body.text, '', '', { context: 3 })
  const lintResult = lint(body.text)
  return c.json({ ok: true, diff, lint: lintResult })
})
