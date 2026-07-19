import { useState } from 'hono/jsx'
import type { ModifierWrap } from '../../../../core/picker'

const LEFT_MODS: { wrap: ModifierWrap; label: string }[] = [
  { wrap: 'LC', label: 'Ctrl' },
  { wrap: 'LS', label: 'Shift' },
  { wrap: 'LA', label: 'Alt' },
  { wrap: 'LG', label: 'GUI' },
]

const RIGHT_MODS: { wrap: ModifierWrap; label: string }[] = [
  { wrap: 'RC', label: 'R-Ctrl' },
  { wrap: 'RS', label: 'R-Shift' },
  { wrap: 'RA', label: 'R-Alt' },
  { wrap: 'RG', label: 'R-GUI' },
]

type Props = {
  active: Set<ModifierWrap>
  onChange: (next: Set<ModifierWrap>) => void
}

export function ModifierToggles({ active, onChange }: Props) {
  const [showRight, setShowRight] = useState(
    RIGHT_MODS.some((m) => active.has(m.wrap)),
  )

  const toggle = (wrap: ModifierWrap) => {
    const next = new Set(active)
    if (next.has(wrap)) next.delete(wrap)
    else next.add(wrap)
    onChange(next)
  }

  const visibleMods = showRight ? [...LEFT_MODS, ...RIGHT_MODS] : LEFT_MODS

  return (
    <div class="flex items-center gap-1">
      {visibleMods.map((m) => (
        <ModButton
          key={m.wrap}
          wrap={m.wrap}
          label={m.label}
          active={active.has(m.wrap)}
          onToggle={() => toggle(m.wrap)}
        />
      ))}
      <button
        type="button"
        onClick={() => setShowRight((v) => !v)}
        class="px-[6px] py-[7px] font-mono font-medium text-[10px] leading-none text-fg-subtler hover:text-fg-muted transition-colors"
        title={showRight ? 'Hide right-side modifiers' : 'Show right-side modifiers'}
      >
        {showRight ? '−R' : '+R'}
      </button>
    </div>
  )
}

function ModButton({
  wrap,
  label,
  active,
  onToggle,
}: {
  wrap: ModifierWrap
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active ? 'true' : 'false'}
      data-modwrap={wrap}
      class={`px-[8px] py-[7px] rounded-[5px] font-mono font-semibold text-[10.5px] leading-none border transition-colors ${
        active
          ? 'bg-accent text-accent-fg border-[1.5px] border-accent'
          : 'bg-white text-fg-muted border-[rgba(22,24,29,.16)] hover:border-[rgba(22,24,29,.28)]'
      }`}
      onClick={onToggle}
    >
      {label}
    </button>
  )
}
