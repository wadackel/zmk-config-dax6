// Client-side IO helpers for the editor: GET/PUT against /api/keymap and POST
// against /api/keymap-preview. The editor keeps the latest mtimeMs token so it
// can send `If-Match` and refresh on 409.
//
// Each response goes through a runtime validator: server-side bugs, proxies
// rewriting the body, and future schema changes all surface as thrown errors
// rather than silently propagating `undefined` through the editor's state.

import type { LintResult } from '../keymap-dt/lint'

export type GetKeymapResponse = {
  ok: true
  text: string
  mtimeMs: number
}

export type PreviewResponse = {
  ok: true
  diff: string
  lint: LintResult
}

export type PutSuccessResponse = { ok: true; mtimeMs: number }
export type PutConflictResponse = {
  ok: false
  error: 'mtime mismatch'
  currentText: string
  currentMtimeMs: number
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function assertGetKeymap(body: unknown): asserts body is GetKeymapResponse {
  if (!isObject(body)) throw new Error('GET /api/keymap: response is not an object')
  if (body.ok !== true) throw new Error('GET /api/keymap: response ok flag missing')
  if (typeof body.text !== 'string') throw new Error('GET /api/keymap: text not a string')
  if (typeof body.mtimeMs !== 'number') throw new Error('GET /api/keymap: mtimeMs not a number')
}

function assertPreview(body: unknown): asserts body is PreviewResponse {
  if (!isObject(body)) throw new Error('POST /api/keymap-preview: response is not an object')
  if (body.ok !== true) throw new Error('POST /api/keymap-preview: ok flag missing')
  if (typeof body.diff !== 'string') throw new Error('POST /api/keymap-preview: diff not a string')
  if (!isObject(body.lint)) throw new Error('POST /api/keymap-preview: lint not an object')
}

function assertPutSuccess(body: unknown): asserts body is PutSuccessResponse {
  if (!isObject(body)) throw new Error('PUT /api/keymap: response is not an object')
  if (body.ok !== true) throw new Error('PUT /api/keymap: ok flag missing')
  if (typeof body.mtimeMs !== 'number') throw new Error('PUT /api/keymap: mtimeMs not a number')
}

function assertPutConflict(body: unknown): asserts body is PutConflictResponse {
  if (!isObject(body)) throw new Error('PUT /api/keymap 409: response is not an object')
  if (body.ok !== false) throw new Error('PUT /api/keymap 409: ok flag should be false')
  if (typeof body.currentText !== 'string') throw new Error('PUT /api/keymap 409: currentText missing')
  if (typeof body.currentMtimeMs !== 'number') throw new Error('PUT /api/keymap 409: currentMtimeMs missing')
}

export async function fetchKeymap(signal?: AbortSignal): Promise<GetKeymapResponse> {
  const res = await fetch('/api/keymap', { signal })
  if (!res.ok) {
    throw new Error(`GET /api/keymap failed: ${res.status}`)
  }
  const body: unknown = await res.json()
  assertGetKeymap(body)
  return body
}

export async function fetchPreview(text: string, signal?: AbortSignal): Promise<PreviewResponse> {
  const res = await fetch('/api/keymap-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  })
  if (!res.ok) throw new Error(`POST /api/keymap-preview failed: ${res.status}`)
  const body: unknown = await res.json()
  assertPreview(body)
  return body
}

export async function saveKeymap(
  text: string,
  mtimeMs: number,
  signal?: AbortSignal,
): Promise<PutSuccessResponse | PutConflictResponse> {
  const res = await fetch('/api/keymap', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': String(mtimeMs),
    },
    body: JSON.stringify({ text }),
    signal,
  })
  if (res.status === 409) {
    const body: unknown = await res.json()
    assertPutConflict(body)
    return body
  }
  if (!res.ok) throw new Error(`PUT /api/keymap failed: ${res.status}`)
  const body: unknown = await res.json()
  assertPutSuccess(body)
  return body
}
