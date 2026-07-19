// Shared keyboard layout component used by the editor's tabs to position the
// physical keys on a split layout matching the tester's visual structure.
//
// Tester keeps its existing inline layout (KeyCap with chatter badges and
// encoder widgets) to avoid disturbing the test flow; the editor uses this
// generic grid to render its own cell content. UNIT / KEY_SIZE / KEY_OFFSET
// are visual constants shared with the tester; row/column extents come from
// the active board profile so a swapped board renders its own geometry.

import type { JSX } from 'hono/jsx/jsx-runtime'
import { getBoard } from '../../../../boards/active'
import type { KeyDef } from '../../../../core/layout'

export const UNIT = 64
export const KEY_SIZE = 56
export const KEY_OFFSET = 4

export type CellRenderer = (key: KeyDef, position: { left: number; top: number; size: number }) => JSX.Element | null

type Props = {
  keys: KeyDef[]
  renderCell: CellRenderer
}

export function KeyboardGrid({ keys, renderCell }: Props) {
  const grid = getBoard().grid
  const leftKeys = keys.filter((k) => k.side === 'left')
  const rightKeys = keys.filter((k) => k.side === 'right')

  const leftContainerW = (grid.leftHalfUnits + 1) * UNIT
  const rightContainerW = (grid.splitBoundary - grid.rightXOffset + 1) * UNIT
  const containerH = grid.rowCount * UNIT

  return (
    <div class="flex flex-row gap-8 justify-center" data-keyboard-grid>
      <div
        class="relative"
        style={{ width: `${leftContainerW}px`, height: `${containerH}px` }}
      >
        {leftKeys.map((k) => {
          const left = k.x * UNIT + KEY_OFFSET
          const top = k.y * UNIT + KEY_OFFSET
          return (
            <div key={k.index} data-key={k.index} style={{ position: 'absolute', left: `${left}px`, top: `${top}px` }}>
              {renderCell(k, { left, top, size: KEY_SIZE })}
            </div>
          )
        })}
      </div>
      <div
        class="relative"
        style={{ width: `${rightContainerW}px`, height: `${containerH}px` }}
      >
        {rightKeys.map((k) => {
          const adjustedX = k.x - grid.rightXOffset
          const left = adjustedX * UNIT + KEY_OFFSET
          const top = k.y * UNIT + KEY_OFFSET
          return (
            <div key={k.index} data-key={k.index} style={{ position: 'absolute', left: `${left}px`, top: `${top}px` }}>
              {renderCell(k, { left, top, size: KEY_SIZE })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
