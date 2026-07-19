import { useEffect, useId, useRef, useState } from 'hono/jsx'
import type { Child, JSX } from 'hono/jsx'

export type FieldTone = 'neutral' | 'warning' | 'danger'

export type FieldProps = {
  label?: Child
  hint?: Child
  error?: Child
  tone?: FieldTone
  htmlFor?: string
  inline?: boolean
  /**
   * When true, wraps `children` in `<div role="group" aria-labelledby>` so
   * screen readers announce a coherent set (e.g. Combos layer chips). The
   * grouping only makes sense when the field has a rendered label to point
   * at; without `label`, this collapses to a no-op wrapper.
   */
  group?: boolean
  class?: string
  children: Child
}

/**
 * Label + control + hint/error grouping. Callers wire up
 * `id` on the control themselves; Field only forwards `htmlFor` on the label
 * and renders `hint`/`error` text with matching ids so callers can set
 * aria-describedby / aria-invalid.
 */
export function Field({
  label,
  hint,
  error,
  tone = 'neutral',
  htmlFor,
  inline = false,
  group = false,
  class: className,
  children,
}: FieldProps) {
  const autoLabelId = useId()
  const labelId = htmlFor ? `${htmlFor}-label` : autoLabelId
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined
  const errorId = htmlFor ? `${htmlFor}-err` : undefined
  const message = error ?? hint
  const messageTone = error
    ? 'text-danger'
    : tone === 'warning'
      ? 'text-warning'
      : 'text-fg-subtle'
  const bodyClass = inline ? 'flex-1 min-w-0' : ''
  return (
    <div
      class={[
        inline ? 'flex items-center gap-2' : 'flex flex-col gap-1',
        className || '',
      ].join(' ')}
    >
      {label && (
        <label id={group && label ? labelId : undefined} htmlFor={htmlFor} class="text-xs font-medium text-fg-muted">
          {label}
        </label>
      )}
      {group && label ? (
        <div role="group" aria-labelledby={labelId} class={bodyClass}>
          {children}
        </div>
      ) : (
        <div class={bodyClass}>{children}</div>
      )}
      {message && (
        <p
          id={error ? errorId : hintId}
          class={['text-xs leading-snug', messageTone].join(' ')}
        >
          {message}
        </p>
      )}
    </div>
  )
}

export type TextInputProps = Omit<JSX.IntrinsicElements['input'], 'size'> & {
  invalid?: boolean
}

/**
 * Uniform text input used across tabs. Consumers still control the input
 * element (value/onInput/etc.) — this only bundles the styling.
 */
export function TextInput({ invalid, class: className, ...props }: TextInputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid ? 'true' : props['aria-invalid'] ?? undefined}
      class={[
        'bg-surface-0 border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle',
        'focus:outline-none focus-visible:border-accent focus-visible:shadow-[var(--shadow-focus-ring)]',
        invalid ? 'border-danger' : 'border-border',
        className || '',
      ].join(' ')}
    />
  )
}

export type NativeSelectProps = JSX.IntrinsicElements['select']

export function NativeSelect({ class: className, ...props }: NativeSelectProps) {
  return (
    <select
      {...props}
      class={[
        'bg-surface-0 border border-border rounded-lg px-3 py-2 text-sm text-fg',
        'focus:outline-none focus-visible:border-accent focus-visible:shadow-[var(--shadow-focus-ring)]',
        className || '',
      ].join(' ')}
    />
  )
}

export type CommittingTextInputProps = Omit<TextInputProps, 'value' | 'onInput'> & {
  /** External source of truth. When it changes while the input is not focused,
   *  the local value follows. */
  value: string
  /** Fired on blur or Enter when the local value differs from `value`. */
  onCommit: (next: string) => void
}

/**
 * Text input with commit-on-blur / Enter semantics. Undo/Redo history should
 * carry one entry per "meaningful" edit, not per keystroke — the older
 * onInput → dispatch pattern deep-copies the entire draft for every
 * character. Callers wire the reducer to `onCommit`; the local state absorbs
 * intra-edit churn. Escape reverts the pending edit; IME composition is
 * respected so Enter during 変換 doesn't fire a commit.
 */
export function CommittingTextInput({
  value: externalValue,
  onCommit,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: CommittingTextInputProps) {
  const [local, setLocal] = useState<string>(externalValue)
  const focusedRef = useRef<{ v: boolean }>({ v: false })
  const composingRef = useRef<{ v: boolean }>({ v: false })
  // Enter fires commit synchronously, then triggers blur; without this guard
  // the follow-up blur would find local !== externalValue (the parent's
  // dispatch is async and hasn't updated externalValue yet) and commit a
  // second, identical history entry — one Enter would cost two Undo steps.
  const skipNextBlurCommitRef = useRef<{ v: boolean }>({ v: false })

  // Follow the external value while unfocused so parent-driven changes
  // (Undo/Redo, Reload from disk) are reflected. If the user is currently
  // editing, keep their in-progress text intact.
  useEffect(() => {
    if (!focusedRef.current?.v) setLocal(externalValue)
  }, [externalValue])

  return (
    <TextInput
      {...rest}
      value={local}
      onFocus={(e: FocusEvent) => {
        focusedRef.current = { v: true }
        if (typeof onFocus === 'function') onFocus(e)
      }}
      onBlur={(e: FocusEvent) => {
        focusedRef.current = { v: false }
        const skip = skipNextBlurCommitRef.current?.v === true
        skipNextBlurCommitRef.current = { v: false }
        if (!skip && local !== externalValue) onCommit(local)
        if (typeof onBlur === 'function') onBlur(e)
      }}
      onInput={(e: Event) => setLocal((e.target as HTMLInputElement).value)}
      onCompositionStart={() => {
        composingRef.current = { v: true }
      }}
      onCompositionEnd={() => {
        composingRef.current = { v: false }
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (typeof onKeyDown === 'function') onKeyDown(e)
        if (e.defaultPrevented) return
        if (composingRef.current?.v) return
        if (e.key === 'Enter') {
          e.preventDefault()
          if (local !== externalValue) {
            skipNextBlurCommitRef.current = { v: true }
            onCommit(local)
          }
          ;(e.target as HTMLElement).blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setLocal(externalValue)
          // Revert should also skip the blur commit — otherwise the reverted
          // `local` matches externalValue and the blur is a no-op, but if
          // an intermediate value slipped in we'd re-commit stale text.
          skipNextBlurCommitRef.current = { v: true }
          ;(e.target as HTMLElement).blur()
        }
      }}
    />
  )
}
