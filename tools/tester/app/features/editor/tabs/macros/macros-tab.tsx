import { useEffect, useRef, useState } from 'hono/jsx'
import { useEditor } from '../../../../core/editor-state/context'
import type { BindingChain } from '../../../../core/keymap-dt/types'
import { ChainEditor } from './chain-editor'
import { MacroList } from './macro-list'
import { MacroStepDock } from './macro-step-inspector'
import { DockShell } from '../../shell/dock-shell'

/**
 * Macros tab redesign. Two-column shell + bottom dock:
 *   - Left: MacroList (SIMPLE / RAW badge, step count)
 *   - Center: ChainEditor (horizontal step cards + insert toolbar + raw preview)
 *   - Bottom dock: MacroStepDock (BindingDock dock variant for
 *     simple chains, raw-token text input for RAW chains)
 */
export function MacrosTab() {
  const { state, dispatch } = useEditor()
  const macros = state.draft.macros
  const [activeMacroIdx, setActiveMacroIdx] = useState<number | null>(
    macros.length > 0 ? 0 : null,
  )
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null)

  // Focus the newly-added macro when the list grows; guards against the
  // rapid double-click race described on the Combos tab.
  const prevMacrosLength = useRef<number>(macros.length)
  useEffect(() => {
    const prev = prevMacrosLength.current ?? 0
    if (macros.length === 0) {
      setActiveMacroIdx(null)
    } else if (macros.length > prev) {
      setActiveMacroIdx(macros.length - 1)
    } else if (activeMacroIdx === null || activeMacroIdx >= macros.length) {
      setActiveMacroIdx(0)
    }
    prevMacrosLength.current = macros.length
  }, [macros.length, activeMacroIdx])

  useEffect(() => {
    setSelectedStepIdx(null)
  }, [activeMacroIdx])

  const activeMacro =
    activeMacroIdx !== null ? macros[activeMacroIdx] : null

  const updateMacroChains = (updater: (list: BindingChain[]) => BindingChain[]) => {
    if (activeMacroIdx === null || !activeMacro) return
    dispatch({
      type: 'UPDATE_MACRO',
      index: activeMacroIdx,
      macro: {
        ...activeMacro,
        bindingsList: updater(activeMacro.bindingsList),
      },
    })
  }

  return (
    <div class="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-0">
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <MacroList
          macros={macros}
          activeIdx={activeMacroIdx}
          onSelect={setActiveMacroIdx}
          onAdd={() => {
            // Selection tracks the length delta via the effect above so
            // consecutive clicks always focus the newest macro.
            dispatch({ type: 'ADD_MACRO' })
          }}
        />

        <div class="flex-1 bg-surface-3 flex flex-col min-w-0 overflow-hidden">
          {activeMacro ? (
            <ChainEditor
              macro={activeMacro}
              selectedStepIdx={selectedStepIdx}
              onSelectStep={setSelectedStepIdx}
              onInsertStep={(idx, chain) => {
                updateMacroChains((list) => {
                  const next = [...list]
                  next.splice(idx, 0, chain)
                  return next
                })
                setSelectedStepIdx(idx)
              }}
              onRemoveStep={(idx) => {
                updateMacroChains((list) => list.filter((_, i) => i !== idx))
                if (selectedStepIdx === idx) setSelectedStepIdx(null)
              }}
              onRename={(name) => {
                if (activeMacroIdx === null) return
                dispatch({ type: 'RENAME_MACRO', index: activeMacroIdx, name })
              }}
            />
          ) : (
            <div class="flex-1 flex items-center justify-center text-fg-subtle text-[13px]">
              Click + to add a macro
            </div>
          )}
        </div>
      </div>

      <DockShell ariaLabel="Macro step editor">
        {activeMacro && selectedStepIdx !== null ? (
          <MacroStepDock
            macro={activeMacro}
            stepIdx={selectedStepIdx}
            onCommitStep={(chain) => {
              updateMacroChains((list) =>
                list.map((c, i) => (i === selectedStepIdx ? chain : c)),
              )
            }}
            onRemoveStep={() => {
              updateMacroChains((list) =>
                list.filter((_, i) => i !== selectedStepIdx),
              )
              setSelectedStepIdx(null)
            }}
            onCancel={() => setSelectedStepIdx(null)}
          />
        ) : (
          <div class="flex items-center gap-4 min-h-[60px] text-fg-subtle">
            <div class="w-[46px] h-[46px] flex-none border border-dashed border-border-strong rounded-input flex items-center justify-center">
              <span class="text-fg-subtler font-mono font-semibold text-[15px]">→</span>
            </div>
            <span class="text-[12px]">
              Click a step in the chain to edit, or use the toolbar to insert a new
              step.
            </span>
          </div>
        )}
      </DockShell>
    </div>
  )
}
