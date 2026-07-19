import { useEffect, useMemo, useRef, useState } from 'hono/jsx'
import { DockField } from '../../../../features/editor/shell/dock-field'
import { BEHAVIORS, getBehavior, type BehaviorEntry, type BehaviorGroup } from '../../../../core/picker'

type Props = {
  value: string
  onChange: (next: string) => void
  /**
   * Where the listbox pops relative to the input. `below` is the
   * default (right-side inspector). `above` flips the listbox so it
   * opens upward — used by the bottom dock where downward-opening
   * listboxes would fall off the viewport.
   */
  popoverPlacement?: 'below' | 'above'
  /** Accessible name for the combobox input. */
  ariaLabel?: string
}

const GROUP_LABEL: Record<BehaviorGroup, string> = {
  basic: 'Basic',
  'mod-tap': 'Mod-tap',
  layer: 'Layer',
  mouse: 'Mouse',
  system: 'System',
  bluetooth: 'Bluetooth',
  macro: 'Macro',
  custom: 'Custom',
}

const GROUP_ORDER: BehaviorGroup[] = [
  'basic',
  'mod-tap',
  'layer',
  'mouse',
  'system',
  'bluetooth',
  'macro',
  'custom',
]

type Row =
  | { kind: 'header'; group: BehaviorGroup }
  | { kind: 'item'; entry: BehaviorEntry }

function filterBehaviors(query: string): BehaviorEntry[] {
  const q = query.toLowerCase().trim()
  if (!q) return BEHAVIORS
  return BEHAVIORS.filter((b) => {
    if (b.token.toLowerCase().includes(q)) return true
    if (b.label.toLowerCase().includes(q)) return true
    if (b.description?.toLowerCase().includes(q)) return true
    return false
  })
}

function buildRows(query: string): Row[] {
  const items = filterBehaviors(query)
  const byGroup: Record<BehaviorGroup, BehaviorEntry[]> = {} as Record<BehaviorGroup, BehaviorEntry[]>
  for (const g of GROUP_ORDER) byGroup[g] = []
  for (const b of items) byGroup[b.group].push(b)
  const rows: Row[] = []
  for (const g of GROUP_ORDER) {
    if (byGroup[g].length === 0) continue
    rows.push({ kind: 'header', group: g })
    for (const e of byGroup[g]) rows.push({ kind: 'item', entry: e })
  }
  return rows
}

export function BehaviorCombobox({
  value,
  onChange,
  popoverPlacement = 'below',
  ariaLabel = 'Behaviour',
}: Props) {
  const current = getBehavior(value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const skipBlurCloseRef = useRef(false)

  const rows = useMemo(() => buildRows(query), [query])
  const selectableIndexes = useMemo(() => {
    const out: number[] = []
    rows.forEach((r, i) => {
      if (r.kind === 'item') out.push(i)
    })
    return out
  }, [rows])

  useEffect(() => {
    if (selectableIndexes.length === 0) return
    if (!selectableIndexes.includes(activeIdx)) {
      setActiveIdx(selectableIndexes[0])
    }
  }, [selectableIndexes, activeIdx])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${activeIdx}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx, open])

  const commitRow = (rowIdx: number) => {
    const row = rows[rowIdx]
    if (!row || row.kind !== 'item') return
    onChange(row.entry.token)
    setQuery('')
    setOpen(false)
  }

  const moveActive = (dir: 1 | -1) => {
    const idx = selectableIndexes.indexOf(activeIdx)
    if (idx === -1) {
      setActiveIdx(selectableIndexes[0] ?? 0)
      return
    }
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= selectableIndexes.length) return
    setActiveIdx(selectableIndexes[nextIdx])
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl+Enter is the modal-level commit shortcut — never intercept it
    // here. Without this gate, Enter's preventDefault below sets
    // defaultPrevented and BindingPicker's window listener bails out, leaving
    // the modal stuck open while the highlighted row gets re-selected.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') return
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commitRow(activeIdx)
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }
  }

  const popover = open ? (
    <div
      ref={listRef}
      role="listbox"
      class={[
        'max-h-[24rem] overflow-auto bg-white border border-[rgba(22,24,29,.12)] rounded-[8px] shadow-[0_12px_34px_rgba(22,24,29,.16)] p-[7px] z-30 absolute left-0 right-0',
        popoverPlacement === 'above' ? 'bottom-full mb-[24px]' : 'top-full mt-[6px]',
      ].join(' ')}
    >
      {rows.length === 0 && (
        <div class="px-[10px] py-[9px] text-fg-subtler font-mono text-[11px] italic text-center">
          No matching behaviour
        </div>
      )}
      {rows.map((row, i) => {
        if (row.kind === 'header') {
          return (
            <div
              key={`h-${row.group}`}
              data-row={i}
              class="px-[10px] pt-[8px] pb-[4px] font-mono font-semibold text-[8.5px] uppercase tracking-[.06em] leading-none text-fg-subtler"
            >
              {GROUP_LABEL[row.group]}
            </div>
          )
        }
        const isActive = i === activeIdx
        const isSelected = row.entry.token === value
        const bgClass = isActive
          ? 'bg-[rgba(79,91,107,.12)]'
          : isSelected
            ? 'bg-[rgba(79,91,107,.05)]'
            : 'hover:bg-[rgba(79,91,107,.05)]'
        return (
          <button
            key={`i-${row.entry.token}`}
            type="button"
            role="option"
            aria-selected={isActive ? 'true' : 'false'}
            data-row={i}
            data-token={row.entry.token}
            class={`flex flex-col items-start gap-[2px] w-full text-left px-[10px] py-[9px] rounded-[6px] transition-colors ${bgClass}`}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseDown={(e: Event) => e.preventDefault()}
            onClick={() => commitRow(i)}
          >
            <span class="font-mono font-semibold text-[13px] leading-none text-fg w-full truncate">
              {row.entry.token}
            </span>
            <span class="font-sans font-medium text-[12px] leading-none text-fg-muted w-full truncate">
              {row.entry.label}
            </span>
          </button>
        )
      })}
    </div>
  ) : null

  return (
    <DockField label="BEHAVIOUR" active={open} overlay={popover}>
      <input
        ref={inputRef}
        type="text"
        class="flex-1 min-w-0 border-none outline-none bg-transparent font-mono font-semibold text-[13px] leading-none text-fg"
        value={open ? query : value}
        placeholder="search"
        aria-label={ariaLabel}
        onFocus={(e: Event) => {
          ;(e.target as HTMLInputElement).select()
          setQuery('')
          setOpen(true)
        }}
        onInput={(e: Event) => {
          setQuery((e.target as HTMLInputElement).value)
          setOpen(true)
        }}
        onBlur={() => {
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
      {current && !open && (
        <span
          class="font-sans font-medium text-[10px] leading-none text-fg-subtle whitespace-nowrap cursor-pointer"
          onMouseDown={(e: Event) => {
            e.preventDefault()
            skipBlurCloseRef.current = true
            setQuery('')
            setOpen((cur) => !cur)
            inputRef.current?.focus()
          }}
        >
          {current.label}
        </span>
      )}
      <span
        class="text-[10px] leading-none text-fg-subtler cursor-pointer"
        aria-hidden="true"
        onMouseDown={(e: Event) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        ▾
      </span>
    </DockField>
  )
}
