import { useState } from 'hono/jsx'
import { CommittingTextInput } from '../../../../ui/field'
import { useEditor } from '../../../../core/editor-state/context'
import {
  getBehaviorSchema,
  getRootBehaviorSchema,
  type PropSchema,
} from '../../../../core/behavior-prop-schema'
import type {
  BehaviorEntry,
  RootBehaviorConfig,
} from '../../../../core/keymap-dt/types'
import { BehaviorList, type BehaviorSelection } from './behavior-list'
import { PropGrid, type PropRow } from './prop-grid'
import { BehaviorAddPropDock } from './behavior-add-prop-inspector'
import { DockShell } from '../../shell/dock-shell'

/**
 * Behaviors tab redesign. Two-column shell + bottom dock:
 *   - Left: BehaviorList (GLOBAL &mt/&lt + CUSTOM)
 *   - Center: header + schema-driven PropGrid
 *   - Bottom dock: BehaviorAddPropDock — search + suggested + custom raw
 *
 * `getBehaviorSchema(compatible)` / `getRootBehaviorSchema(kind)` yield the
 * schema rows; unused rows surface as suggestions in the Add pane.
 */
export function BehaviorsTab() {
  const { state, dispatch } = useEditor()
  const behaviors = state.draft.behaviors
  const rootBehaviors = state.draft.rootBehaviors
  const [selection, setSelection] = useState<BehaviorSelection>(
    rootBehaviors.length > 0
      ? { kind: 'root', idx: 0 }
      : { kind: 'custom', idx: 0 },
  )

  const selectedRoot =
    selection.kind === 'root' ? rootBehaviors[selection.idx] : null
  const selectedCustom =
    selection.kind === 'custom' ? behaviors[selection.idx] : null

  const schema: readonly PropSchema[] = selectedRoot
    ? getRootBehaviorSchema(selectedRoot.kind)
    : selectedCustom
      ? getBehaviorSchema(selectedCustom.compatible)
      : []

  const currentProps = selectedRoot?.props ?? selectedCustom?.props ?? []
  const known = new Set(schema.map((s) => s.name))
  const rows: PropRow[] = schema.map((s) => ({
    schema: s,
    rawValue: currentProps.find((p) => p.name === s.name)?.value,
  }))
  const suggestions = schema.filter(
    (s) => !currentProps.some((p) => p.name === s.name),
  )

  const updateProp = (name: string, rawValue: string | undefined) => {
    if (selection.kind === 'root' && selectedRoot) {
      const existing = selectedRoot.props.findIndex((p) => p.name === name)
      let nextProps: RootBehaviorConfig['props']
      if (rawValue === undefined) {
        nextProps =
          existing >= 0
            ? selectedRoot.props.filter((_, i) => i !== existing)
            : selectedRoot.props
      } else if (existing >= 0) {
        nextProps = selectedRoot.props.map((p, i) =>
          i === existing ? { ...p, value: rawValue } : p,
        )
      } else {
        nextProps = [...selectedRoot.props, { name, value: rawValue }]
      }
      dispatch({
        type: 'UPDATE_ROOT_BEHAVIOR',
        index: selection.idx,
        cfg: { ...selectedRoot, props: nextProps },
      })
    } else if (selection.kind === 'custom' && selectedCustom) {
      const existing = selectedCustom.props.findIndex((p) => p.name === name)
      let nextProps: BehaviorEntry['props']
      if (rawValue === undefined) {
        nextProps =
          existing >= 0
            ? selectedCustom.props.filter((_, i) => i !== existing)
            : selectedCustom.props
      } else if (existing >= 0) {
        nextProps = selectedCustom.props.map((p, i) =>
          i === existing ? { ...p, value: rawValue } : p,
        )
      } else {
        nextProps = [...selectedCustom.props, { name, value: rawValue }]
      }
      dispatch({
        type: 'UPDATE_BEHAVIOR',
        index: selection.idx,
        behavior: { ...selectedCustom, props: nextProps },
      })
    }
  }

  const renameCustom = (name: string) => {
    if (selection.kind !== 'custom' || !selectedCustom) return
    dispatch({
      type: 'UPDATE_BEHAVIOR',
      index: selection.idx,
      behavior: { ...selectedCustom, name },
    })
  }

  const headerTitle = selectedRoot
    ? `&${selectedRoot.kind}`
    : selectedCustom
      ? `&${selectedCustom.name}`
      : '—'
  const headerSubtitle = selectedRoot
    ? selectedRoot.kind === 'mt'
      ? 'mod-tap · global behaviour'
      : 'layer-tap · global behaviour'
    : selectedCustom
      ? 'custom behaviour'
      : ''
  const headerBadge = selectedRoot
    ? `compatible = "zmk,behavior-hold-tap"`
    : selectedCustom
      ? `compatible = ${selectedCustom.compatible}`
      : ''

  return (
    <div class="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-0">
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <BehaviorList
          root={rootBehaviors}
          custom={behaviors}
          active={selection}
          onSelect={setSelection}
        />

        <div class="flex-1 bg-surface-3 flex flex-col min-w-0 overflow-auto p-8 gap-5">
        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1 flex items-baseline gap-3">
            <span class="text-[22px] font-mono font-bold leading-tight tracking-tight truncate">
              {headerTitle}
            </span>
            <span class="text-[12px] text-fg-subtle truncate">{headerSubtitle}</span>
          </div>
          <span class="flex-none text-[11px] font-mono text-fg-subtle bg-surface-4 rounded-md px-2 py-1 truncate max-w-[280px]">
            {headerBadge}
          </span>
        </div>

        {selectedCustom && (
          <div class="flex items-center gap-3">
            <span class="text-[12px] font-semibold text-fg-muted">name</span>
            <CommittingTextInput
              class="font-mono"
              value={selectedCustom.name}
              onCommit={renameCustom}
            />
          </div>
        )}

        {rows.length > 0 ? (
          <PropGrid rows={rows} onChange={updateProp} />
        ) : (
          <div class="p-5 rounded-xl bg-surface-0 border border-border text-[12px] text-fg-subtle">
            Schema undefined — edit via the raw editor.
          </div>
        )}

        {selectedCustom && (
          <UnknownRawProps
            props={selectedCustom.props.filter((p) => !known.has(p.name))}
            onChange={(nextUnknown) =>
              dispatch({
                type: 'UPDATE_BEHAVIOR',
                index: selection.idx,
                behavior: {
                  ...selectedCustom,
                  props: [
                    ...selectedCustom.props.filter((p) => known.has(p.name)),
                    ...nextUnknown,
                  ],
                },
              })
            }
          />
        )}

          <div class="flex items-center gap-2 text-[11.5px] text-fg-subtle">
            <span class="text-success font-mono">✓</span>
            Fields generated from behavior-prop-schema.ts. Unknown properties can be edited as raw.
          </div>
        </div>
      </div>

      <DockShell ariaLabel="Add behaviour property">
        <BehaviorAddPropDock
          suggestions={[...suggestions]}
          onAddKnown={(s) => {
            // Seed the new prop with a schema-appropriate initial value so
            // adding a row does not immediately serialize an empty DT value.
            const kind = s.kind
            if (kind.type === 'bool') {
              updateProp(s.name, '')
            } else if (kind.type === 'int' || kind.type === 'int-ms') {
              updateProp(s.name, `<${kind.min ?? 0}>`)
            } else if (kind.type === 'enum') {
              const first = kind.options[0]
              updateProp(s.name, first ? `"${first}"` : '')
            } else {
              updateProp(s.name, '')
            }
          }}
          onAddCustom={(name, value) => updateProp(name, value)}
        />
      </DockShell>
    </div>
  )
}

function UnknownRawProps({
  props,
  onChange,
}: {
  props: { name: string; value: string }[]
  onChange: (next: { name: string; value: string }[]) => void
}) {
  if (props.length === 0) return null
  return (
    <details class="text-sm">
      <summary class="cursor-pointer text-xs text-fg-muted hover:text-fg select-none font-mono uppercase tracking-wider">
        Raw properties ({props.length})
      </summary>
      <div class="mt-2 flex flex-col gap-1.5">
        {props.map((p, pi) => (
          <div key={pi} class="flex gap-2">
            <CommittingTextInput
              class="flex-1 font-mono"
              aria-label="Property name"
              value={p.name}
              onCommit={(name) =>
                onChange(props.map((q, i) => (i === pi ? { ...q, name } : q)))
              }
            />
            <CommittingTextInput
              class="flex-1 font-mono"
              aria-label="Property value"
              value={p.value}
              onCommit={(value) =>
                onChange(props.map((q, i) => (i === pi ? { ...q, value } : q)))
              }
            />
          </div>
        ))}
      </div>
    </details>
  )
}
