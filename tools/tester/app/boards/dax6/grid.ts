import type { BoardGrid } from '../types'

// Column occupancy per row; matches dax6.dtsi's default_transform. Serializer
// uses these to render the bindings array as a 4-row column-aligned text grid.
const ROW_LEFT_COLS: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5],
  [0, 1, 2, 3, 4, 5],
  [0, 1, 2, 3, 4, 5, 6],
  [3, 4, 5, 6],
]
const ROW_RIGHT_COLS_ABS: readonly (readonly number[])[] = [
  [8, 9, 10, 11, 12, 13],
  [8, 9, 10, 11, 12, 13],
  [7, 8, 9, 10, 11, 12, 13],
  [7, 8],
]

export const grid: BoardGrid = {
  rowCount: 4,
  leftColCount: 7,
  rightColCount: 7,
  rowLeftCols: ROW_LEFT_COLS,
  rowRightColsAbs: ROW_RIGHT_COLS_ABS,
  leftHalfUnits: 6.5,
  rightXOffset: 8.5,
  splitBoundary: 15,
  testerGridInterleaveCols: 16,
}
