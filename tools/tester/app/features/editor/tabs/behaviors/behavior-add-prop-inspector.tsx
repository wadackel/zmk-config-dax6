import { useState } from 'hono/jsx'
import { Button } from '../../../../ui/button'
import { CommittingTextInput, TextInput } from '../../../../ui/field'
import type { PropSchema } from '../../../../core/behavior-prop-schema'

export type BehaviorAddPropDockProps = {
  suggestions: PropSchema[]
  onAddKnown: (schema: PropSchema) => void
  onAddCustom: (name: string, value: string) => void
}

const KIND_BADGE_LABEL: Record<string, string> = {
  int: 'int',
  'int-ms': 'int-ms',
  enum: 'enum',
  bool: 'bool',
  raw: 'raw',
}

/**
 * Bottom-dock "Add property" editor. Layout:
 *   - Identity (left): label + subtitle explaining schema vs raw.
 *   - Center: search input, SUGGESTED chip row, and a "+ Custom (raw)"
 *     `<details>` for hand-written prop entry.
 *   - Actions (right): Add button used only for the custom raw form —
 *     schema-known chips add themselves on click.
 */
export function BehaviorAddPropDock({
  suggestions,
  onAddKnown,
  onAddCustom,
}: BehaviorAddPropDockProps) {
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [customValue, setCustomValue] = useState('')

  const filtered = query.trim()
    ? suggestions.filter((s) =>
        s.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : suggestions

  const submitCustom = () => {
    const name = customName.trim()
    if (!name) return
    onAddCustom(name, customValue)
    setCustomName('')
    setCustomValue('')
  }

  return (
    <div class="contents">
      <div class="flex-none flex flex-col gap-1 pr-5 border-r border-border-subtle">
        <span class="text-[13px] font-bold text-fg leading-none">Add property</span>
        <span class="font-mono text-[10.5px] text-fg-subtle whitespace-nowrap">
          schema-typed or raw
        </span>
      </div>

      <div class="flex-1 min-w-0 flex items-center flex-wrap gap-3 px-5">
        <TextInput
          aria-label="Search property name"
          placeholder="Search property name…"
          value={query}
          onInput={(e: Event) => setQuery((e.target as HTMLInputElement).value)}
          class="!py-2 !text-[12.5px] min-w-[160px] max-w-[240px] flex-1"
        />
        <span class="font-mono text-[10px] uppercase tracking-[.04em] text-fg-subtle">
          SUGGESTED
        </span>
        {filtered.length === 0 ? (
          <span class="text-[11.5px] text-fg-subtle italic">No matches</span>
        ) : (
          filtered.slice(0, 6).map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => onAddKnown(s)}
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-input bg-surface-0 hover:bg-surface-2 transition-colors"
            >
              <span class="font-mono font-semibold text-[12px] text-fg">{s.name}</span>
              <span class="font-mono text-[9.5px] text-fg-subtle bg-surface-4 rounded-sm px-1.5 py-0.5">
                {KIND_BADGE_LABEL[s.kind.type]}
              </span>
            </button>
          ))
        )}
        <details class="ml-1">
          <summary class="cursor-pointer inline-flex items-center px-2.5 py-1.5 border border-dashed border-border-strong rounded-input font-mono text-[11.5px] text-fg-subtle hover:text-fg select-none">
            + Custom (raw)
          </summary>
          <div class="mt-2 flex items-center gap-2">
            <CommittingTextInput
              placeholder="name"
              value={customName}
              onCommit={setCustomName}
              class="!py-1.5 !text-[12px] font-mono max-w-[140px]"
            />
            <CommittingTextInput
              placeholder="value (e.g. <5>)"
              value={customValue}
              onCommit={setCustomValue}
              class="!py-1.5 !text-[12px] font-mono max-w-[160px]"
            />
          </div>
        </details>
      </div>

      <div class="flex-none flex items-center pl-3">
        <Button
          size="sm"
          variant="primary"
          disabled={!customName.trim()}
          onClick={submitCustom}
          title="Add the custom (raw) property"
        >
          Add
        </Button>
      </div>
    </div>
  )
}
