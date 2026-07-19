import type {
  MouseGestureBlock,
  MouseGesturePattern,
  MouseGesturePatternEntry,
} from '../../../../core/keymap-dt/types'

const DIRECTION_ORDER: MouseGesturePattern[] = ['UP', 'LEFT', 'RIGHT', 'DOWN']

const DIRECTION_META: Record<
  MouseGesturePattern,
  { icon: string; symbol: string; label: string; grid: string; defaultName: string }
> = {
  UP: {
    icon: '▲',
    symbol: '▲',
    label: 'UP',
    grid: 'col-start-2 row-start-1',
    defaultName: 'mg_up',
  },
  DOWN: {
    icon: '▼',
    symbol: '▼',
    label: 'DOWN',
    grid: 'col-start-2 row-start-3',
    defaultName: 'mg_down',
  },
  LEFT: {
    icon: '◀',
    symbol: '◀',
    label: 'LEFT',
    grid: 'col-start-1 row-start-2',
    defaultName: 'mg_left',
  },
  RIGHT: {
    icon: '▶',
    symbol: '▶',
    label: 'RIGHT',
    grid: 'col-start-3 row-start-2',
    defaultName: 'mg_right',
  },
}

export function getDirectionMeta(pattern: MouseGesturePattern) {
  return DIRECTION_META[pattern]
}

export type DirectionPadProps = {
  block: MouseGestureBlock
  selected: MouseGesturePattern | null
  onSelect: (pattern: MouseGesturePattern) => void
  onCreate: (pattern: MouseGesturePattern) => void
}

/**
 * 3x3 direction pad that matches the redesign's Mouse Gestures stage. The
 * center cell is a decorative trackball with a rotating accent stroke + a
 * motion trail; the four direction cells render either the existing entry
 * (`&kp PG_UP`) or a "+ Set direction" placeholder that dispatches an insert.
 */
export function DirectionPad({ block, selected, onSelect, onCreate }: DirectionPadProps) {
  return (
    <div
      class="grid gap-3 items-center justify-items-center"
      style="grid-template-columns:172px 172px 172px; grid-template-rows:140px 172px 140px;"
    >
      {DIRECTION_ORDER.map((pattern) => {
        const meta = DIRECTION_META[pattern]
        const entry = block.entries.find((e) => e.pattern === pattern)
        const isSelected = selected === pattern
        if (!entry) {
          return (
            <button
              key={pattern}
              type="button"
              onClick={() => onCreate(pattern)}
              class={[
                meta.grid,
                'w-full h-full flex flex-col gap-1 items-center justify-center px-3 py-2 border border-dashed border-border-strong rounded-xl text-fg-subtle hover:text-accent hover:border-accent transition-colors',
              ].join(' ')}
            >
              <span class="text-lg leading-none">{meta.icon}</span>
              <span class="text-[10px] font-mono">+ Set {meta.label.toLowerCase()}</span>
            </button>
          )
        }
        return (
          <DirectionCard
            key={pattern}
            pattern={pattern}
            meta={meta}
            entry={entry}
            isSelected={isSelected}
            onClick={() => onSelect(pattern)}
          />
        )
      })}
      <CenterTrackball />
    </div>
  )
}

function DirectionCard({
  meta,
  entry,
  isSelected,
  onClick,
}: {
  pattern: MouseGesturePattern
  meta: (typeof DIRECTION_META)[MouseGesturePattern]
  entry: MouseGesturePatternEntry
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={[
        meta.grid,
        'w-full flex flex-col gap-[6px] items-start px-[13px] py-[11px] bg-white rounded-[7px] text-left transition-shadow box-border',
        isSelected
          ? 'border-[1.5px] border-accent shadow-[0_0_0_3px_rgba(79,91,107,.12)]'
          : 'border border-[rgba(22,24,29,.12)] shadow-[0_1px_2px_rgba(22,24,29,.05)] hover:shadow-md',
      ].join(' ')}
    >
      <span
        class={[
          'text-[10px] font-mono font-semibold uppercase tracking-[.08em] leading-none',
          isSelected ? 'text-accent' : 'text-fg-subtle',
        ].join(' ')}
      >
        {meta.symbol} {meta.label}
      </span>
      <span class="text-[13px] font-mono font-semibold leading-none text-fg break-all">
        {entry.bindings.tokens.join(' ') || '&none'}
      </span>
    </button>
  )
}

function CenterTrackball() {
  return (
    <div class="col-start-2 row-start-2 relative w-[172px] h-[172px]">
      <div
        class="absolute inset-0 rounded-full border border-border shadow-[0_6px_22px_rgb(22_24_29/0.1),inset_0_1px_0_#fff]"
        style="background: radial-gradient(circle at 50% 44%, #ffffff, #f1f1ee);"
      />
      <div class="absolute inset-[22px] rounded-full border border-border-subtle" />
      <div class="absolute inset-[44px] rounded-full border border-border-subtle" />
      <div class="absolute inset-[56px] rounded-full bg-white border border-[rgba(22,24,29,.1)] flex flex-col items-center justify-center gap-[2px] shadow-[0_1px_3px_rgba(22,24,29,.06)]">
        <span class="text-[8px] font-mono font-semibold tracking-[.12em] leading-none text-fg-subtle">
          TRACKBALL
        </span>
        <span class="text-[12px] font-semibold leading-none text-fg">Gesture</span>
      </div>
      <span
        class="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgb(79_91_107/0.5)] animate-[kbd-gesture-trail_2.4s_ease-out_infinite]"
        aria-hidden="true"
      />
      <span
        aria-hidden="true"
        class="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#c2c5cc]"
      >
        ▲
      </span>
      <span
        aria-hidden="true"
        class="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#c2c5cc]"
      >
        ▼
      </span>
      <span
        aria-hidden="true"
        class="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#c2c5cc]"
      >
        ◀
      </span>
      <span
        aria-hidden="true"
        class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#c2c5cc]"
      >
        ▶
      </span>
    </div>
  )
}
