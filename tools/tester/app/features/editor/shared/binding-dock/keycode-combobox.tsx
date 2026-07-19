import { useCallback, useEffect, useMemo, useRef, useState } from 'hono/jsx'
import { DockField } from '../../../../features/editor/shell/dock-field'
import {
  applyModifiersOrdered,
  COMMON_KEYCODES,
  KEYCODES,
  loadRecentKeycodes,
  MODIFIER_KEYCODE_TOKENS,
  searchKeycodesRanked,
  unwrapAllModifiers,
  type KeycodeEntry,
  type ModifierWrap,
} from '../../../../core/picker'
import { ModifierToggles } from './modifier-toggles'

type Props = {
  value: string
  onChange: (next: string) => void
  /**
   * Cmd/Ctrl+Enter shortcut from inside the combobox bubbles up here.
   * The optional `overrideValue` carries the user's pending selection
   * (typed query / highlighted listbox item composed with the current
   * modifier wraps) so the parent does not depend on async state
   * propagation for the keycode arg.
   */
  onCommit?: (overrideValue?: string) => void
  /**
   * When true, replace the regular Common pinned set with the pure modifier
   * keycodes and hide the modifier wrapper toggle (`&mt` hold slot semantics).
   */
  pinModifiers?: boolean
  autoFocus?: boolean
  /** Optional placeholder for the underlying text input. */
  placeholder?: string
  /**
   * Where the listbox pops relative to the input. `below` is the
   * default (right-side inspector). `above` flips the listbox so it
   * opens upward — used by the bottom dock where downward-opening
   * listboxes would fall off the viewport.
   */
  popoverPlacement?: 'below' | 'above'
  /** Accessible name for the combobox input. */
  ariaLabel?: string
  /**
   * When true, the internal `<ModifierToggles>` is not rendered here.
   * The bottom dock uses this so the parent can render the modifier
   * chips as a peer slot to the right of the KEYCODE input — that way
   * both controls share one baseline and the row does not stack into
   * two visual lines.
   *
   * The modifier state stays derivable from `value` (via
   * `unwrapAllModifiers`), so the parent can drop in its own
   * `<ModifierToggles>` whose `active` comes from the unwrapped set and
   * whose `onChange` re-composes the token with `applyModifiersOrdered`
   * and re-emits via `onChange`.
   */
  hideModifiers?: boolean
  /**
   * When true, wrap the input+popover in the bottom-dock `<DockField>`
   * chrome (uppercase label + white pill + slate ring when open). Left
   * off, the component renders as a plain input styled for the right-
   * side inspector.
   */
  dockField?: boolean
  /** Micro-label shown above the DockField chrome. Ignored when `dockField` is false. */
  fieldLabel?: string
}

type Item = {
  entry: KeycodeEntry | { token: string; label: string }
  section: 'recent' | 'common' | 'all' | 'match'
}

const KEYCODE_INDEX: Map<string, KeycodeEntry> = (() => {
  const m = new Map<string, KeycodeEntry>()
  for (const k of KEYCODES) m.set(k.token, k)
  return m
})()

function tokenToItem(token: string, section: Item['section']): Item {
  const entry = KEYCODE_INDEX.get(token)
  return {
    entry: entry ?? { token, label: token },
    section,
  }
}

export function KeycodeCombobox({
  value,
  onChange,
  onCommit,
  pinModifiers,
  autoFocus,
  placeholder,
  popoverPlacement = 'below',
  ariaLabel = 'Keycode',
  hideModifiers,
  dockField = false,
  fieldLabel = 'KEYCODE',
}: Props) {
  // Decompose the raw token into base keycode + modifier set so editing
  // existing `LC(A)` style values shows the right toggle state.
  const { inner: initialInner, wraps: initialWraps } = useMemo(
    () => unwrapAllModifiers(value || ''),
    [value],
  )

  const [query, setQuery] = useState(initialInner)
  const [baseToken, setBaseToken] = useState(initialInner)
  const [modWraps, setModWraps] = useState<Set<ModifierWrap>>(initialWraps)
  const [activeIdx, setActiveIdx] = useState(0)
  const [open, setOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const skipBlurCloseRef = useRef(false)

  // When the parent updates `value`, sync the local state down. We distinguish
  // two cases:
  //   - `inner !== baseToken`: the parent (or an external action) replaced
  //     the keycode wholesale → reset everything, including the query input.
  //   - `inner === baseToken`: the value change was caused by THIS component
  //     (typically a modifier-toggle click that rebuilt the wrapped form) →
  //     only re-sync the wraps Set. Resetting the query here would clobber
  //     any in-progress typing in the keycode input — the bug surfaced when
  //     a user typed e.g. "tab" without committing, then toggled GUI: the
  //     stale baseToken was re-emitted and the query collapsed back to it.
  useEffect(() => {
    const { inner, wraps } = unwrapAllModifiers(value || '')
    setModWraps(wraps)
    if (inner !== baseToken) {
      setBaseToken(inner)
      setQuery(inner)
    }
  }, [value])

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
      setOpen(true)
    }
  }, [autoFocus])

  // Compose the canonical value out of the base keycode + active wrappers.
  const composeAndEmit = useCallback(
    (token: string, wraps: Set<ModifierWrap>) => {
      const wrapped = pinModifiers ? token : applyModifiersOrdered(token, wraps)
      onChange(wrapped)
    },
    [onChange, pinModifiers],
  )

  // Items shown in the listbox.
  const items: Item[] = useMemo(() => {
    const q = query.trim()
    if (q.length === 0) {
      const out: Item[] = []
      const seen = new Set<string>()
      // 1. Recent
      if (!pinModifiers) {
        for (const t of loadRecentKeycodes()) {
          if (seen.has(t)) continue
          seen.add(t)
          out.push(tokenToItem(t, 'recent'))
        }
      }
      // 2. Common (or modifiers when pinModifiers)
      const commonSource = pinModifiers ? MODIFIER_KEYCODE_TOKENS : COMMON_KEYCODES
      for (const t of commonSource) {
        if (seen.has(t)) continue
        seen.add(t)
        out.push(tokenToItem(t, 'common'))
      }
      // 3. All remaining
      for (const k of KEYCODES) {
        if (seen.has(k.token)) continue
        if (pinModifiers && !MODIFIER_KEYCODE_TOKENS.includes(k.token)) continue
        seen.add(k.token)
        out.push({ entry: k, section: 'all' })
      }
      return out
    }
    return searchKeycodesRanked(q).map((entry) => ({ entry, section: 'match' as const }))
  }, [query, pinModifiers])

  // Clamp activeIdx when items shrink.
  useEffect(() => {
    if (activeIdx >= items.length) setActiveIdx(0)
  }, [activeIdx, items])

  // Scroll active item into view. `scrollIntoView` is undefined under jsdom
  // (test environment); the guard avoids unhandled errors there.
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx, open])

  const commitItem = (item: Item) => {
    const token = item.entry.token
    setBaseToken(token)
    setQuery(token)
    composeAndEmit(token, modWraps)
    setOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      // Resolve the user's pending selection synchronously and pass it to the
      // parent's commit. Without this, a typed-but-uncommitted query like
      // "tab" would be discarded and the parent would commit its stale args.
      //
      // We do NOT gate on `open` for the catalogue-match branch because the
      // listbox may have closed (blur'd) while the `items` memo still holds
      // the matches for the current `query`. Restricting to `open` previously
      // caused blur+Cmd+Enter to fall into the raw-query branch and emit
      // lowercase tokens like `tab` instead of canonical `TAB`.
      const composeWith = (base: string) =>
        pinModifiers ? base : applyModifiersOrdered(base, modWraps)
      const trimmed = query.trim()
      const userTypedSomething = trimmed.length > 0 && trimmed !== baseToken
      if (userTypedSomething) {
        if (items.length > 0) {
          // Catalogue match → use the canonical token (handles case
          // normalisation like `tab` → `TAB`).
          const item = items[Math.min(activeIdx, items.length - 1)]
          const override = composeWith(item.entry.token)
          setBaseToken(item.entry.token)
          setQuery(item.entry.token)
          setOpen(false)
          onCommit?.(override)
        } else {
          // No catalogue match — accept the raw typed value (the "will save
          // as-is" hint shown in the listbox).
          const override = composeWith(trimmed)
          setBaseToken(trimmed)
          setOpen(false)
          onCommit?.(override)
        }
      } else {
        // No user typing — let the modal commit use parent state as-is.
        onCommit?.()
      }
      return
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && items.length > 0) {
        commitItem(items[Math.min(activeIdx, items.length - 1)])
      } else if (!open && items.length === 1) {
        // Closed listbox + single match (e.g. user typed full token) → accept.
        commitItem(items[0])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
      // else: let modal handle it.
    }
  }

  const handleModifierChange = (next: Set<ModifierWrap>) => {
    setModWraps(next)
    // Resolve the user's most recent intent into a base token so the modifier
    // toggle does not silently overwrite typed-but-uncommitted text with the
    // stale `baseToken`. Cases:
    //   1. listbox is OPEN with matches → commit the highlighted item.
    //   2. user typed something that differs from baseToken (listbox closed
    //      after blur, or no catalogue match) → accept the raw query as-is.
    //   3. otherwise → reuse the previously-committed baseToken.
    // We also skip the emit entirely when the resolved token is empty so the
    // wrapped form does not become malformed (e.g. `LG()`).
    const trimmed = query.trim()
    let tokenToUse = baseToken
    if (trimmed && trimmed !== baseToken) {
      if (open && items.length > 0) {
        const item = items[Math.min(activeIdx, items.length - 1)]
        tokenToUse = item.entry.token
        setQuery(tokenToUse)
      } else {
        // Listbox is closed (e.g. after blur) — search the catalogue ourselves
        // so a typed `tab` resolves to canonical `TAB` rather than emitting
        // the lowercase raw query.
        const matches = searchKeycodesRanked(trimmed)
        tokenToUse = matches.length > 0 ? matches[0].token : trimmed
        setQuery(tokenToUse)
      }
      setBaseToken(tokenToUse)
      if (open) setOpen(false)
    }
    if (tokenToUse) {
      composeAndEmit(tokenToUse, next)
    }
  }

  const popover = open ? (
    <div
      ref={listRef}
      role="listbox"
      class={
        dockField
          ? [
              'absolute left-0 right-0 max-h-[28rem] overflow-auto bg-white border border-[rgba(22,24,29,.12)] rounded-[8px] shadow-[0_12px_34px_rgba(22,24,29,.16)] p-[7px] z-30',
              popoverPlacement === 'above' ? 'bottom-full mb-[24px]' : 'top-full mt-[6px]',
            ].join(' ')
          : [
              'max-h-[28rem] overflow-auto bg-surface-1 border border-border-strong rounded-md shadow-lg',
              popoverPlacement === 'above'
                ? 'absolute left-0 right-0 bottom-full mb-1 z-30'
                : 'mt-1',
            ].join(' ')
      }
    >
      {items.length === 0 && (
        <div class={dockField ? 'px-[10px] py-[9px] text-fg-subtler font-mono text-[11px] italic text-center' : 'px-3 py-2 text-fg-subtle text-xs italic'}>
          No catalogue match. The current input "{query}" will save as-is.
        </div>
      )}
      {items.map((item, i) => {
        const isActive = i === activeIdx
        const label = item.entry.label
        const token = item.entry.token
        const showTokenSuffix = label !== token
        const isSelected = token === baseToken
        if (dockField) {
          const bgClass = isActive
            ? 'bg-[rgba(79,91,107,.12)]'
            : isSelected
              ? 'bg-[rgba(79,91,107,.05)]'
              : 'hover:bg-[rgba(79,91,107,.05)]'
          return (
            <button
              key={`${item.section}-${token}-${i}`}
              type="button"
              role="option"
              aria-selected={isActive ? 'true' : 'false'}
              data-idx={i}
              data-token={token}
              class={`flex items-center justify-between gap-[11px] w-full text-left px-[10px] py-[9px] rounded-[6px] transition-colors ${bgClass}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e: Event) => e.preventDefault()}
              onClick={() => commitItem(item)}
            >
              <span class="flex items-center gap-2 min-w-0">
                {item.section === 'recent' && (
                  <span class="font-mono font-semibold text-[8.5px] uppercase tracking-[.06em] leading-none text-fg-subtler shrink-0">
                    recent
                  </span>
                )}
                {item.section === 'common' && (
                  <span class="font-mono font-semibold text-[8.5px] uppercase tracking-[.06em] leading-none text-fg-subtler shrink-0">
                    common
                  </span>
                )}
                <span class="font-mono font-semibold text-[13px] leading-none text-fg truncate">
                  {label}
                </span>
              </span>
              {showTokenSuffix && (
                <span class="font-sans font-medium text-[11px] leading-none text-fg-muted shrink-0">
                  {token}
                </span>
              )}
            </button>
          )
        }
        return (
          <button
            key={`${item.section}-${token}-${i}`}
            type="button"
            role="option"
            aria-selected={isActive ? 'true' : 'false'}
            data-idx={i}
            data-token={token}
            class={`flex items-center justify-between w-full text-left px-3 py-1 text-sm font-mono ${
              isActive ? 'bg-accent text-accent-fg' : 'text-fg hover:bg-surface-3'
            }`}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseDown={(e: Event) => e.preventDefault()}
            onClick={() => commitItem(item)}
          >
            <span class="flex items-center gap-2">
              {item.section === 'recent' && (
                <span class="text-[9px] text-emerald-400 uppercase">recent</span>
              )}
              {item.section === 'common' && (
                <span class="text-[9px] text-fg-subtle uppercase">common</span>
              )}
              <span>{label}</span>
            </span>
            {showTokenSuffix && <span class="text-fg-subtle text-xs">{token}</span>}
          </button>
        )
      })}
    </div>
  ) : null

  const trigger = (
    <input
      ref={inputRef}
      type="text"
      class={
        dockField
          ? 'flex-1 min-w-0 border-none outline-none bg-transparent font-mono font-semibold text-[13px] leading-none text-fg'
          : 'w-full bg-surface-3 border border-border-strong rounded-md px-2 py-1 text-fg font-mono'
      }
      value={query}
      placeholder={placeholder ?? 'type to search (e.g. lang, scroll, A)'}
      aria-label={ariaLabel}
      onFocus={() => setOpen(true)}
      onInput={(e: Event) => {
        const v = (e.target as HTMLInputElement).value
        setQuery(v)
        setOpen(true)
        setActiveIdx(0)
      }}
      onBlur={() => {
        const trimmed = query.trim()
        if (trimmed && trimmed !== baseToken) {
          const matches = searchKeycodesRanked(trimmed)
          const resolved = matches.length > 0 ? matches[0].token : trimmed
          setBaseToken(resolved)
          setQuery(resolved)
          composeAndEmit(resolved, modWraps)
        }
        setTimeout(() => {
          if (skipBlurCloseRef.current) {
            skipBlurCloseRef.current = false
            return
          }
          setOpen(false)
        }, 120)
      }}
      onKeyDown={handleKeyDown}
    />
  )

  if (dockField) {
    return (
      <DockField label={fieldLabel} active={open} overlay={popover}>
        {trigger}
        <span
          class="text-[10px] leading-none text-fg-subtler cursor-pointer"
          aria-hidden="true"
          onMouseDown={(e: Event) => {
            e.preventDefault()
            skipBlurCloseRef.current = true
            setOpen((cur) => !cur)
            inputRef.current?.focus()
          }}
        >
          ▾
        </span>
      </DockField>
    )
  }

  return (
    <div class="relative">
      {!pinModifiers && !hideModifiers && (
        <ModifierToggles active={modWraps} onChange={handleModifierChange} />
      )}
      {trigger}
      {popover}
      {!pinModifiers && !hideModifiers && modWraps.size > 0 && (
        <div class="mt-1 text-[10px] text-fg-subtle">
          Will save as: <span class="text-fg-muted">{applyModifiersOrdered(baseToken, modWraps)}</span>
        </div>
      )}
    </div>
  )
}
