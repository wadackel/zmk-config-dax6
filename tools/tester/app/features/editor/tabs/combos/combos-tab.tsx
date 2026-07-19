import { useEffect, useRef, useState } from 'hono/jsx'
import { KeyCap } from '../../../../ui/key-cap'
import type { KeyCapState } from '../../../../ui/key-cap'
import { useEditor } from '../../../../core/editor-state/context'
import { KEYS } from '../../../../core/layout'
import { KeyboardGrid } from '../../shared/keyboard-view/keyboard-grid'
import { formatBindingForCell, mainLineSizeClass } from '../../../../core/binding-display'
import { ComboList } from './combo-list'
import { ComboDock } from './combo-inspector'
import { DockShell } from '../../shell/dock-shell'

/**
 * Combos tab redesign. Two-column shell + bottom dock:
 *   - Left: ComboList
 *   - Center: keyboard board that either shows the active combo's positions
 *     highlighted (view mode) or accepts click-toggle input (pick mode).
 *   - Bottom dock: ComboDock fields (name, binding, positions, layers)
 *     or a "click + to add" empty state when no combo is selected.
 */
export function CombosTab() {
  const { state, dispatch } = useEditor()
  const combos = state.draft.combos
  const layers = state.draft.layers
  const activeLayer = layers[state.activeLayerIdx]
  const [activeComboIdx, setActiveComboIdx] = useState<number | null>(
    combos.length > 0 ? 0 : null,
  )
  const [pickMode, setPickMode] = useState(false)

  // Focus the newly-added combo whenever the list grows. Reading
  // `combos.length` inside the button handler and passing it straight to
  // `setActiveComboIdx` would race on rapid double-click: React batches
  // both dispatches, both handlers close over the same pre-dispatch
  // length, and the second click would still select the item added by
  // the first. Tracking the length across renders sidesteps the race.
  const prevCombosLength = useRef<number>(combos.length)
  useEffect(() => {
    const prev = prevCombosLength.current ?? 0
    if (combos.length === 0) {
      setActiveComboIdx(null)
    } else if (combos.length > prev) {
      setActiveComboIdx(combos.length - 1)
    } else if (activeComboIdx === null || activeComboIdx >= combos.length) {
      setActiveComboIdx(0)
    }
    prevCombosLength.current = combos.length
  }, [combos.length, activeComboIdx])

  useEffect(() => {
    if (activeComboIdx === null) setPickMode(false)
  }, [activeComboIdx])

  useEffect(() => {
    if (!pickMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setPickMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickMode])

  const activeCombo = activeComboIdx !== null ? combos[activeComboIdx] : null
  const positionSet = new Set(activeCombo?.keyPositions ?? [])

  const togglePosition = (idx: number) => {
    if (activeComboIdx === null || !activeCombo) return
    const next = new Set(positionSet)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    dispatch({
      type: 'UPDATE_COMBO',
      index: activeComboIdx,
      combo: {
        ...activeCombo,
        keyPositions: Array.from(next).sort((a, b) => a - b),
      },
    })
  }

  return (
    <div class="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-0">
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <ComboList
          combos={combos}
          activeIdx={activeComboIdx}
          onSelect={setActiveComboIdx}
          onAdd={() => {
            // Selection follows the length delta via the effect above so
            // consecutive clicks always focus the most-recently-added combo.
            dispatch({ type: 'ADD_COMBO' })
          }}
        />

        <div class="flex-1 bg-surface-3 flex flex-col min-w-0 overflow-auto">
          {activeCombo ? (
            <>
              <div class="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
                <div class="flex items-baseline gap-3">
                  <span class="text-[14px] font-semibold text-fg">{activeCombo.name}</span>
                  <span class="text-[11px] text-fg-subtle">
                    Press highlighted keys together
                  </span>
                </div>
                <button
                  type="button"
                  aria-pressed={pickMode ? 'true' : 'false'}
                  onClick={() => setPickMode((v) => !v)}
                  class={[
                    'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[12px] transition-colors',
                    pickMode
                      ? 'bg-accent text-accent-fg border-accent shadow-[0_1px_2px_rgb(79_91_107/0.35)]'
                      : 'bg-accent-soft text-accent border-accent/50 hover:brightness-95',
                  ].join(' ')}
                >
                  <span aria-hidden="true">▢</span>
                  {pickMode ? 'Done — click to finish' : 'Pick positions on board'}
                </button>
              </div>

              <div class="flex-1 flex items-center justify-center px-8 py-6 min-w-0">
                <KeyboardGrid
                  keys={KEYS}
                  renderCell={(k) => {
                    const binding = activeLayer?.bindings[k.index]
                    const display = binding
                      ? formatBindingForCell(binding)
                      : { topLine: '', mainLine: '', faint: true }
                    const isInCombo = positionSet.has(k.index)
                    const isTrans =
                      binding &&
                      binding.tokens.length === 1 &&
                      binding.tokens[0] === '&trans'
                    const isMod =
                      binding &&
                      binding.tokens.length > 0 &&
                      binding.tokens[0].startsWith('&') &&
                      binding.tokens[0] !== '&kp' &&
                      binding.tokens[0] !== '&trans' &&
                      binding.tokens[0] !== '&none'
                    const capState: KeyCapState = isInCombo
                      ? 'combo-target'
                      : isTrans
                        ? 'trans'
                        : isMod
                          ? 'mod'
                          : 'idle'
                    const mainColor = display.faint ? 'text-fg-subtle' : 'text-fg'
                    return (
                      <KeyCap
                        state={capState}
                        asButton
                        hoverable={pickMode}
                        interactive={pickMode}
                        class="relative"
                        title={`pos ${k.index}${binding ? ' · ' + binding.tokens.join(' ') : ''}`}
                        onClick={() => {
                          if (pickMode) togglePosition(k.index)
                        }}
                      >
                        {display.topLine && (
                          <span class="absolute top-0.5 inset-x-1 text-[8px] text-fg-subtle leading-none truncate text-left">
                            {display.topLine}
                          </span>
                        )}
                        <span class={`${mainLineSizeClass(display.mainLine)} ${mainColor}`}>
                          {display.mainLine}
                        </span>
                      </KeyCap>
                    )
                  }}
                />
              </div>
            </>
          ) : (
            <div class="flex-1 flex items-center justify-center text-fg-subtle text-[13px]">
              Click + to add a combo
            </div>
          )}
        </div>
      </div>

      <DockShell ariaLabel="Combo editor">
        {activeCombo && activeComboIdx !== null ? (
          <ComboDock
            combo={activeCombo}
            layers={layers}
            pickMode={pickMode}
            onChange={(next) =>
              dispatch({ type: 'UPDATE_COMBO', index: activeComboIdx, combo: next })
            }
            onRemove={() => {
              dispatch({ type: 'REMOVE_COMBO', index: activeComboIdx })
            }}
            onEnterPickMode={() => setPickMode(true)}
            onExitPickMode={() => setPickMode(false)}
          />
        ) : (
          <div class="flex items-center gap-4 min-h-[60px] text-fg-subtle">
            <div class="w-[46px] h-[46px] flex-none border border-dashed border-border-strong rounded-input flex items-center justify-center">
              <span class="text-fg-subtler font-semibold">+</span>
            </div>
            <span class="text-[12px]">
              Click <span class="font-mono text-fg-muted">+</span> in the list to add a
              combo, or pick one to edit.
            </span>
          </div>
        )}
      </DockShell>
    </div>
  )
}
