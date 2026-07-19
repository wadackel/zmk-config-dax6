import type { BoardProfile } from './types'
import { PROFILE as DAX6_PROFILE } from './dax6'

let active: BoardProfile = DAX6_PROFILE

export function getBoard(): BoardProfile {
  return active
}

export function setBoardForTest(profile: BoardProfile): void {
  active = profile
}

export function resetBoardForTest(): void {
  active = DAX6_PROFILE
}
