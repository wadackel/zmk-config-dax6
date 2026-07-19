import { useEffect, useRef, useState } from 'hono/jsx'
import { Button } from '../../../../ui/button'
import {
  applyModifiersOrdered,
  getBehavior,
  KEYCODES,
  pushRecentKeycode,
  unwrapAllModifiers,
} from '../../../../core/picker'
import { useEditor } from '../../../../core/editor-state/context'
import { getBoard } from '../../../../boards/active'
import type { BindingChain } from '../../../../core/keymap-dt/types'
import { ArgumentControl } from './argument-control'
import { BehaviorCombobox } from './behavior-combobox'
import { BtSpecialForm } from './bt-special-form'
import { ModifierToggles } from './modifier-toggles'
import { MICRO_LABEL } from '../../../../ui/micro-label'

const KEYCODE_TOKEN_SET = new Set(KEYCODES.map((k) => k.token))

// Floats above the associated form control; other MICRO_LABEL call sites
// (tester, export panel) render inline so positioning stays local here.
const FLOATING_LABEL = `absolute bottom-full left-0 mb-[6px] whitespace-nowrap ${MICRO_LABEL}`

const CHEVRON =
  'font-mono font-medium text-[13px] leading-none text-fg-subtler shrink-0'

export type BindingDockProps = {
  keyIdx?: number
  targetLabel?: string
  targetSubtitle?: string
  initial: BindingChain
  onCancel: () => void
  onCommit: (chain: BindingChain) => void
}

/**
 * Bottom-dock binding editor shared by every tab that needs to
 * configure a `&behaviour arg0 arg1…` chain (Layers / Combos / Sensors
 * / Mouse Gestures / Macros nested). The `<div class="contents">` root
 * lets the caller's `<DockShell>` claim the identity / center / actions
 * slots directly, so this file never carries an outer aside chrome —
 * every rendering is a horizontal dock row.
 */
export function BindingDock({
  keyIdx = -1,
  targetLabel,
  targetSubtitle,
  initial,
  onCancel,
  onCommit,
}: BindingDockProps) {
  const { state } = useEditor()

  const isEmpty = initial.tokens.length === 0
  const initialBehaviorToken = isEmpty ? '&kp' : initial.tokens[0]!

  const [behaviorToken, setBehaviorToken] = useState(initialBehaviorToken)
  const [args, setArgs] = useState<string[]>(isEmpty ? [] : initial.tokens.slice(1))
  const [activeArgIdx, setActiveArgIdx] = useState(0)

  const argsRef = useRef<string[]>(args)
  const behaviorRef = useRef<string>(behaviorToken)
  argsRef.current = args
  behaviorRef.current = behaviorToken

  const behavior = getBehavior(behaviorToken)
  const expectedArity = behavior?.arity?.[0] ?? 0
  const argTypes = behavior?.argTypes ?? []
  const argLabels = behavior?.argLabels
  const normalizedArgs = Array.from({ length: expectedArity }, (_, i) => args[i] ?? '')

  useEffect(() => {
    const first = argTypes.findIndex((t) => t === 'keycode')
    setActiveArgIdx(first === -1 ? 0 : first)
  }, [behaviorToken])

  // Selection reset is owned by the callers via a `key` prop keyed on
  // the active target (e.g. Layers uses `key={selectedKeyIdx}`, Sensors
  // uses `key={editing.encoderIdx}`), so this component only reads
  // `initial` at mount. That contract also solves the case where an
  // external mutation (Undo/Redo, Sensors' Swap CCW/CW, bulk paste)
  // rewrites the current target while the dock is open — remount reads
  // the fresh `initial`; a props-to-state effect keyed on `initial`
  // would instead fight the local edits the user is composing.

  const previewTokens =
    behaviorToken === '&bt'
      ? ['&bt', ...(args ?? [])].filter(Boolean)
      : [behaviorToken, ...normalizedArgs].filter(Boolean)
  const previewText = previewTokens.join(' ')

  const commit = (overrideValue?: string) => {
    if (typeof overrideValue !== 'string') overrideValue = undefined
    const currentBehavior = behaviorRef.current ?? behaviorToken
    const currentBehaviorEntry = getBehavior(currentBehavior)
    const currentArity = currentBehaviorEntry?.arity?.[0] ?? 0
    const currentArgTypes = currentBehaviorEntry?.argTypes ?? []
    let effectiveArgs = argsRef.current ?? args
    if (overrideValue !== undefined && activeArgIdx >= 0) {
      effectiveArgs = [...effectiveArgs]
      while (effectiveArgs.length <= activeArgIdx) effectiveArgs.push('')
      effectiveArgs[activeArgIdx] = overrideValue
    }
    const effectiveNormalized = Array.from(
      { length: currentArity },
      (_, i) => effectiveArgs[i] ?? '',
    )
    for (let i = 0; i < effectiveNormalized.length; i++) {
      if (currentArgTypes[i] === 'keycode' && effectiveNormalized[i]) {
        pushRecentKeycode(effectiveNormalized[i])
      }
    }
    const effectiveTokens =
      currentBehavior === '&bt'
        ? ['&bt', ...effectiveArgs].filter(Boolean)
        : [currentBehavior, ...effectiveNormalized].filter(Boolean)
    onCommit({ tokens: effectiveTokens })
  }

  const updateArg = (i: number, v: string) => {
    const next = [...(argsRef.current ?? args)]
    while (next.length <= i) next.push('')
    next[i] = v
    argsRef.current = next
    setArgs(next)
  }

  const advanceAfter = (i: number) => {
    for (let j = i + 1; j < argTypes.length; j++) {
      if (argTypes[j] === 'keycode') {
        setActiveArgIdx(j)
        return
      }
    }
  }

  const coord = keyIdx >= 0 ? getBoard().matrix.physicalToMatrix(keyIdx) : null
  const displayChar =
    behaviorToken === '&kp' && normalizedArgs[0]
      ? normalizedArgs[0].replace(/^[LR][CSGA]\((.+)\)$/, '$1')
      : behaviorToken === '&trans'
        ? '·'
        : behaviorToken.replace(/^&/, '')

  // Scale identity-chip font-size down for longer custom-behaviour tokens
  // (e.g. `&enc_scroll` → `enc_scroll`, 10 chars) so they read cleanly
  // inside the 58×58 chip instead of overflowing at the default 20px.
  const displayCharClass =
    displayChar.length <= 3
      ? 'text-[20px]'
      : displayChar.length <= 5
        ? 'text-[15px]'
        : displayChar.length <= 7
          ? 'text-[11px]'
          : 'text-[9px]'

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      commit()
    }
  }

  const onBehaviorChange = (next: string) => {
    setBehaviorToken(next)
    behaviorRef.current = next
    const nextBehavior = getBehavior(next)
    const nextArity = nextBehavior?.arity?.[0] ?? 0
    const nextArgTypes = nextBehavior?.argTypes ?? []
    const prevArgTypes = behavior?.argTypes ?? []
    const sameShape =
      nextArgTypes.length === prevArgTypes.length &&
      nextArgTypes.every((t, i) => t === prevArgTypes[i])
    const currentArgs = argsRef.current ?? args
    const newArgs = sameShape
      ? Array.from({ length: nextArity }, (_, i) => currentArgs[i] ?? '')
      : Array.from({ length: nextArity }, () => '')
    argsRef.current = newArgs
    setArgs(newArgs)
  }

  const primaryTitle = coord ? 'Selected key' : (targetLabel ?? 'Selected')
  const primarySubtitle = coord
    ? `pos ${keyIdx} · row ${coord.row} col ${coord.col}`
    : (targetSubtitle ?? '')

  return (
    <div class="contents" onKeyDown={handleKeyDown}>
      <div class="flex-none flex items-center gap-[13px] pr-[22px] border-r border-[rgba(22,24,29,.08)]">
        <span
          class="w-[58px] h-[58px] shrink-0 rounded-[7px] border-[1.5px] border-accent bg-[rgba(79,91,107,.07)] shadow-[0_0_0_3px_rgba(79,91,107,.1)] flex items-center justify-center overflow-hidden box-border px-1"
          aria-label={behaviorToken === '&trans' ? 'trans (transparent)' : undefined}
          title={behaviorToken === '&trans' ? 'trans (transparent)' : behaviorToken}
        >
          <span
            class={`font-mono font-semibold text-fg leading-[1.1] text-center break-words ${displayCharClass}`}
          >
            {displayChar}
          </span>
        </span>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-[12.5px] font-semibold leading-none text-fg">{primaryTitle}</span>
            <button
              type="button"
              aria-label="Deselect"
              title="Deselect"
              onClick={onCancel}
              class="text-[12px] font-semibold leading-none text-fg-subtler hover:text-fg-muted cursor-pointer"
            >
              ✕
            </button>
          </div>
          <span class="text-[10.5px] font-mono leading-none text-fg-muted whitespace-nowrap">
            {primarySubtitle}
          </span>
        </div>
      </div>

      <div class="flex-1 min-w-0 flex flex-col justify-center px-[22px]">
        <div class="flex items-center gap-2 flex-nowrap min-w-0">
          <div class="relative flex-1 min-w-[118px] max-w-[210px]">
            <BehaviorCombobox
              value={behaviorToken}
              onChange={onBehaviorChange}
              popoverPlacement="above"
            />
          </div>

          {behaviorToken === '&bt' ? (
            <>
              <span class={CHEVRON} aria-hidden="true">›</span>
              <div class="flex-1 min-w-[180px]">
                <BtSpecialForm
                  tokens={['&bt', ...args]}
                  onChange={(t) => {
                    const nextArgs = t.slice(1)
                    argsRef.current = nextArgs
                    setArgs(nextArgs)
                  }}
                />
              </div>
            </>
          ) : (
            expectedArity > 0 &&
            normalizedArgs.map((value, i) => {
              const argType = argTypes[i]
              const isActive = i === activeArgIdx
              const label = argLabels?.[i] ?? argType ?? 'arg'
              const pinModifiers = behaviorToken === '&mt' && i === 0 && argType === 'keycode'
              // Split modifier chips out of the KeycodeCombobox so they sit
              // as a sibling MODIFIERS slot on the same baseline as the
              // KEYCODE input. Otherwise the internal ModifierToggles
              // stacks above the input and breaks the design's single-row
              // rhythm (labels on top, controls aligned across all cells).
              const showModifierSlot = argType === 'keycode' && !pinModifiers
              const { inner: keycodeBase, wraps: keycodeMods } = showModifierSlot
                ? unwrapAllModifiers(value || '')
                : { inner: value, wraps: new Set<never>() as Set<never> }
              const slotFlex =
                argType === 'keycode'
                  ? 'flex-1 basis-0 min-w-[104px] max-w-[180px]'
                  : 'flex-none min-w-[128px] max-w-[170px]'
              return (
                <>
                  <span class={CHEVRON} aria-hidden="true" key={`ch-${i}`}>›</span>
                  <div class={slotFlex} key={`${behaviorToken}-${i}`}>
                    <ArgumentControl
                      argType={argType}
                      value={value}
                      onChange={(v) => {
                        updateArg(i, v)
                        if (
                          argType === 'keycode' &&
                          v &&
                          KEYCODE_TOKEN_SET.has(v.replace(/^[LR][CSGA]\((.+)\)$/, '$1'))
                        ) {
                          advanceAfter(i)
                        }
                      }}
                      onCommit={commit}
                      pinModifiers={pinModifiers}
                      layers={state.draft.layers}
                      isActive={isActive}
                      onFocus={() => setActiveArgIdx(i)}
                      label={label}
                      autoFocus={i === activeArgIdx}
                      popoverPlacement="above"
                      compact
                      hideModifiers={showModifierSlot}
                    />
                  </div>
                  {showModifierSlot && (
                    <>
                      <span class={CHEVRON} aria-hidden="true" key={`ch-mod-${i}`}>+</span>
                      <div class="relative flex-none" key={`mod-${i}`}>
                        <span class={FLOATING_LABEL}>MODIFIERS</span>
                        <ModifierToggles
                          active={keycodeMods}
                          onChange={(nextWraps) => {
                            const composed = applyModifiersOrdered(
                              keycodeBase || '',
                              nextWraps,
                            )
                            updateArg(i, composed)
                          }}
                        />
                      </div>
                    </>
                  )}
                </>
              )
            })
          )}
        </div>
      </div>

      <div class="flex-none flex items-center gap-[14px] pl-[22px] border-l border-[rgba(22,24,29,.08)]">
        <div class="relative hidden md:block">
          <span class={FLOATING_LABEL}>PREVIEW</span>
          <span
            class="inline-block font-mono font-semibold text-[13.5px] leading-none text-fg px-[11px] py-[6px] rounded-[5px] bg-[rgba(22,24,29,.05)] whitespace-nowrap"
            title="Preview of the chain that will be committed"
          >
            {previewText || '—'}
          </span>
        </div>
        <Button size="md" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="md"
          variant="primary"
          class="px-[22px] py-[10px]"
          onMouseDown={(e: MouseEvent) => {
            e.preventDefault()
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            commit()
          }}
        >
          Commit
        </Button>
      </div>
    </div>
  )
}
