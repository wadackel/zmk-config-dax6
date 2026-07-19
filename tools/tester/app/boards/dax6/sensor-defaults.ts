import type { BoardSensor } from '../types'

// Values hardcoded in dax6.dtsi. Centralised so sensor-hints validation and any
// future UI display read from a single differ-friendly point.
export const sensor: BoardSensor = {
  shieldSteps: 80,
  shieldTriggersPerRotation: 40,
}
