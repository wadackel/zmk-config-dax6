import type { MouseGestureBlock } from '../../../../core/keymap-dt/types'

export type GestureBlockListProps = {
  blocks: MouseGestureBlock[]
  activeIdx: number
  onSelect: (idx: number) => void
}

/**
 * Left column of the Mouse Gestures tab. Lists the root
 * `&zip_mouse_gesture` override + any named input-processor blocks. Adding
 * new blocks is intentionally omitted here — creating a block requires
 * choosing a compatible / #input-processor-cells shape that our parser
 * doesn't yet expose as UI. Named blocks come from the parsed keymap only.
 */
export function GestureBlockList({ blocks, activeIdx, onSelect }: GestureBlockListProps) {
  return (
    <aside
      aria-label="Gesture blocks"
      class="w-[210px] flex-none border-r border-border-subtle px-[14px] py-[16px] flex flex-col gap-[4px] overflow-auto"
    >
      <span class="text-[10.5px] font-mono font-semibold tracking-[.08em] leading-none uppercase text-fg-subtle px-[6px] pb-[8px]">
        GESTURE BLOCKS
      </span>
      {blocks.map((block, i) => {
        const isActive = i === activeIdx
        const label = block.kind === 'root' ? '&zip_mouse_gesture' : (block.name ?? '(unnamed)')
        const subtitle = block.kind === 'root' ? 'root · default' : 'named block'
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(i)}
            class={[
              'flex flex-col gap-[3px] px-[10px] py-[9px] rounded-[6px] cursor-pointer transition-colors text-left',
              isActive ? 'bg-[#16181d] text-white' : 'hover:bg-surface-3',
            ].join(' ')}
          >
            <span
              class={[
                'text-[12.5px] font-mono font-semibold leading-none truncate',
                isActive ? '' : 'text-fg-muted',
              ].join(' ')}
            >
              {label}
            </span>
            <span
              class={[
                'text-[10px] font-medium leading-none',
                isActive ? 'text-white/55' : 'text-fg-subtle',
              ].join(' ')}
            >
              {subtitle}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
