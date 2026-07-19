import type { BoardProfile } from '../types'
import { branding } from './branding'
import { customs } from './behaviors'
import { customKeycodes } from './zmk-keycodes'
import { grid } from './grid'
import { keymapSource } from './keymap-source'
import { layerTapBehaviors } from './layer-tap-behaviors'
import { matrix } from './matrix'
import { sensor } from './sensor-defaults'
import { storage } from './storage-keys'

export const PROFILE: BoardProfile = {
  id: 'dax6',
  branding,
  storage,
  matrix,
  grid,
  sensor,
  behaviors: {
    customs,
    layerTapBehaviors,
    customKeycodes,
  },
  keymapSource,
}
