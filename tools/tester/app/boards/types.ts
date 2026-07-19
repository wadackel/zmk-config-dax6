import type { BehaviorEntry } from '../core/picker/behaviors'

export type MatrixCoord = { row: number; col: number }

export interface BoardBranding {
  title: string
  shortLabel: string
  subtitle: (layerCount: number) => string
  encoderLabel: string
  gestureLabel: string
  testerHeaderLabel: (keyCount: number) => string
  pngFileName: string
  reloadGuardSymbolKey: string
}

export interface BoardStorage {
  recentKeycodesKey: string
}

export interface BoardMatrix {
  transform: readonly (readonly number[])[]
  keyCount: number
  encoderCount: number
  physicalToMatrix: (idx: number) => MatrixCoord
  matrixToPhysical: (row: number, col: number) => number | null
  checkIntegrity: (physicalLayoutLength: number) => boolean
}

export interface BoardGrid {
  rowCount: number
  leftColCount: number
  rightColCount: number
  rowLeftCols: readonly (readonly number[])[]
  rowRightColsAbs: readonly (readonly number[])[]
  leftHalfUnits: number
  rightXOffset: number
  splitBoundary: number
  testerGridInterleaveCols: number
}

export interface BoardSensor {
  shieldSteps: number
  shieldTriggersPerRotation: number
}

export interface BoardBehaviors {
  customs: readonly BehaviorEntry[]
  layerTapBehaviors: ReadonlySet<string>
  customKeycodes: Record<string, ZmkCustomKeycode>
}

export interface ZmkCustomKeycode {
  label: string
  eventCode?: string
  eventKey?: string
  mouseButton?: number
  testability: 'keyboard' | 'mouse' | 'untestable'
}

export interface BoardKeymapSource {
  keymapRelative: string
  jsonRelative: string
  envVarName: string
  defaultLayerName: string
}

export interface BoardProfile {
  id: string
  branding: BoardBranding
  storage: BoardStorage
  matrix: BoardMatrix
  grid: BoardGrid
  sensor: BoardSensor
  behaviors: BoardBehaviors
  keymapSource: BoardKeymapSource
}
