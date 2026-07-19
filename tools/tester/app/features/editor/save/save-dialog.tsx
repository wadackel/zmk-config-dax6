import { useEffect, useState } from 'hono/jsx'
import { Button } from '../../../ui/button'
import { Dialog } from '../../../ui/dialog'
import { useToast } from '../../../ui/toast'
import { useEditor } from '../../../core/editor-state/context'
import { fetchPreview, saveKeymap } from '../../../core/editor-state/io'
import type { LintResult } from '../../../core/keymap-dt/lint'
import { parseKeymap } from '../../../core/keymap-dt/parse'
import { buildCandidateText } from '../../../core/keymap-dt/patch-container'

type Conflict = {
  currentText: string
  currentMtimeMs: number
}

export function SaveDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useEditor()
  const toast = useToast()
  const [preview, setPreview] = useState<{ diff: string; lint: LintResult } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<Conflict | null>(null)

  const candidateText = buildCandidateText(state.baselineSource, state.draft)

  useEffect(() => {
    let cancelled = false
    setPreview(null)
    setPreviewError(null)
    fetchPreview(candidateText)
      .then((r) => {
        if (cancelled) return
        setPreview({ diff: r.diff, lint: r.lint })
      })
      .catch((err) => {
        if (cancelled) return
        setPreviewError(String(err))
      })
    return () => {
      cancelled = true
    }
  }, [candidateText])

  const doSave = async (runTeardown: () => void) => {
    setSaving(true)
    try {
      const res = await saveKeymap(candidateText, state.baselineMtimeMs)
      if (res.ok) {
        const parsed = parseKeymap(candidateText)
        // Run Dialog teardown BEFORE the dispatch that unmounts us — otherwise
        // ModalStack / scroll lock leak (hono/jsx does not fire useEffect
        // cleanup on conditional unmount).
        runTeardown()
        dispatch({
          type: 'SAVE_COMMIT',
          source: candidateText,
          mtimeMs: res.mtimeMs,
          draft: {
            layers: parsed.layers,
            combos: parsed.combos,
            macros: parsed.macros,
            behaviors: parsed.behaviors,
            mouseGestures: parsed.mouseGestures,
            rootBehaviors: parsed.rootBehaviors,
          },
        })
        toast.push({ tone: 'success', message: 'Keymap saved.' })
        onClose()
      } else {
        setConflict({ currentText: res.currentText, currentMtimeMs: res.currentMtimeMs })
      }
    } catch (err) {
      toast.push({
        tone: 'danger',
        message: 'Save failed',
        detail: (err as Error).message,
        durationMs: 8000,
      })
    } finally {
      setSaving(false)
    }
  }

  const doReloadFromConflict = (runTeardown: () => void) => {
    if (!conflict) return
    try {
      const parsed = parseKeymap(conflict.currentText)
      runTeardown()
      dispatch({
        type: 'LOAD',
        source: conflict.currentText,
        mtimeMs: conflict.currentMtimeMs,
        draft: {
          layers: parsed.layers,
          combos: parsed.combos,
          macros: parsed.macros,
          behaviors: parsed.behaviors,
          mouseGestures: parsed.mouseGestures,
          rootBehaviors: parsed.rootBehaviors,
        },
      })
      toast.push({
        tone: 'warning',
        message: 'Reloaded from disk.',
        detail: 'Local edits were discarded to match the latest file.',
      })
      onClose()
    } catch (err) {
      toast.push({
        tone: 'danger',
        message: 'Reload failed',
        detail: (err as Error).message,
        durationMs: 8000,
      })
    }
  }

  const canSave = preview?.lint.ok === true && !saving && !conflict

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title="Save keymap"
      description="Review the diff, then confirm to atomically write the file."
      footer={({ close, runTeardown }) => (
        <>
          <Button variant="subtle" onClick={close}>
            Cancel
          </Button>
          {conflict ? (
            <Button variant="primary" onClick={() => doReloadFromConflict(runTeardown)}>
              Reload from disk
            </Button>
          ) : (
            <Button variant="primary" disabled={!canSave} onClick={() => doSave(runTeardown)}>
              {saving ? 'Saving…' : 'Confirm save'}
            </Button>
          )}
        </>
      )}
    >
      {previewError && (
        <div class="text-sm text-danger border border-danger/40 bg-danger-soft rounded-md px-3 py-2">
          Preview error: {previewError}
        </div>
      )}

      {preview && (
        <>
          <section class="flex flex-col gap-1.5">
            <div class="text-xs uppercase tracking-wide text-fg-subtle">Lint</div>
            {preview.lint.errors.length === 0 ? (
              <div class="text-sm text-success">No errors.</div>
            ) : (
              <ul class="text-sm text-danger list-disc pl-5">
                {preview.lint.errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            )}
            {preview.lint.warnings.length > 0 && (
              <ul class="text-xs text-warning list-disc pl-5">
                {preview.lint.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            )}
          </section>

          <section class="flex flex-col gap-1.5">
            <div class="text-xs uppercase tracking-wide text-fg-subtle">Diff preview</div>
            <pre class="bg-surface-0 border border-border-subtle rounded-md p-3 text-xs font-mono overflow-auto max-h-[46vh] whitespace-pre m-0">
              {preview.diff || '(no textual changes)'}
            </pre>
          </section>
        </>
      )}

      {conflict && (
        <div
          class="border border-warning/40 bg-warning-soft rounded-md px-3 py-2 text-sm"
          role="alert"
        >
          <div class="font-medium">Remote file changed</div>
          <p class="text-xs text-fg-muted mt-0.5">
            The keymap on disk was modified since you started editing. Click{' '}
            <span class="text-warning font-medium">Reload from disk</span> to discard local edits and
            fetch the latest, or Cancel to keep editing (you can copy your work aside first).
          </p>
        </div>
      )}
    </Dialog>
  )
}

