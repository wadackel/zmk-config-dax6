import { getBoard } from '../boards/active'
import { parseSingleBindingChain } from './keymap-dt/parse'
import type { BehaviorEntry, BindingChain } from './keymap-dt/types'
import { getBehavior, KEYCODES } from './picker'
import type { BehaviorArgType } from './picker'

// Shield-side constants live on the active board profile so a swap picks up its
// own `steps` / `triggers-per-rotation`. `sensor-hints.ts` reads them at call
// time rather than caching, so `setBoardForTest` swaps take effect immediately.
export function shieldSteps(): number {
  return getBoard().sensor.shieldSteps
}
export function shieldTriggersPerRotation(): number {
  return getBoard().sensor.shieldTriggersPerRotation
}

// `&msc` の内部イベント周期。tap-ms がこれ未満だとスクロールが 1 イベントも
// 発火せず完全に無反応になる。
export const MSC_PERIOD_MS = 16

const RUNTIME_SENSOR_ROTATE = 'zmk,behavior-runtime-sensor-rotate'
const ROTATION_PROPS = ['cw-binding', 'ccw-binding'] as const
type RotationProp = (typeof ROTATION_PROPS)[number]

// `tap-ms` を省略した runtime-sensor-rotate ノードに devicetree binding が補う値。
const RUNTIME_SENSOR_ROTATE_TAP_MS_DEFAULT = 5

// macOS のマウススクロールは delta が小さすぎると無視されることが実測されて
// おり、120 未満で体感の劣化、60 未満で完全無視になり得る。
const SCRL_VAL_MACOS_MIN = 60
const SCRL_VAL_MACOS_RECOMMENDED = 120

export type HintLevel = 'ok' | 'warn' | 'error'
export type HintResult = { level: HintLevel; message?: string }

const OK: HintResult = { level: 'ok' }

export type RotationBinding = {
  tokens: string[]
  label: string
}

export type EncoderRotationDescription = {
  behavior: string
  cw: RotationBinding | null
  ccw: RotationBinding | null
}

export type ScrollRotateTapMs = {
  name: string
  /** Index into the behaviors list, for `UPDATE_BEHAVIOR`. */
  index: number
  /** Effective value; null when `tap-ms` is present but not a plain integer. */
  tapMs: number | null
  /** True when the node omits `tap-ms` and the binding default applies. */
  isDefault: boolean
  hint: HintResult
}

export function extractScrlVal(source: string): number | null {
  const m = source.match(/^\s*#define\s+ZMK_POINTING_DEFAULT_SCRL_VAL\s+(\d+)/m)
  if (!m) return null
  return Number(m[1])
}

// `&msc` を回す runtime-sensor-rotate だけが対象。`&kp` 系は 1 回の press/release
// で完結するので、既定の 5ms でも取りこぼさない。
export function scrollRotateTapMs(behaviors: BehaviorEntry[]): ScrollRotateTapMs[] {
  const result: ScrollRotateTapMs[] = []
  behaviors.forEach((behavior, index) => {
    if (behavior.compatible !== RUNTIME_SENSOR_ROTATE) return
    const usesMsc = ROTATION_PROPS.some((prop) =>
      rotationChain(behavior, prop)?.tokens.includes('&msc'),
    )
    if (!usesMsc) return
    const prop = behavior.props.find((p) => p.name === 'tap-ms')
    const isDefault = prop === undefined
    const tapMs = isDefault ? RUNTIME_SENSOR_ROTATE_TAP_MS_DEFAULT : parseIntCell(prop.value)
    result.push({
      name: behavior.name,
      index,
      tapMs,
      isDefault,
      hint: checkTapMs({ name: behavior.name, tapMs, isDefault }),
    })
  })
  return result
}

function checkTapMs({
  name,
  tapMs,
  isDefault,
}: Pick<ScrollRotateTapMs, 'name' | 'tapMs' | 'isDefault'>): HintResult {
  if (tapMs === null || tapMs >= MSC_PERIOD_MS) return OK
  const actual = isDefault ? `is unset (defaults to ${tapMs}ms)` : `is ${tapMs}ms`
  return {
    level: 'error',
    message: `${name}: tap-ms ${actual}, must be >= ${MSC_PERIOD_MS}ms (msc event period); scroll will not fire`,
  }
}

function parseIntCell(value: string): number | null {
  const m = value.match(/^\s*<\s*(\d+)\s*>\s*$/)
  return m ? Number(m[1]) : null
}

export function checkScrlVal(val: number | null): HintResult {
  if (val === null) return OK
  if (val < SCRL_VAL_MACOS_MIN) {
    return {
      level: 'error',
      message: `SCRL_VAL < ${SCRL_VAL_MACOS_MIN} may be ignored entirely on macOS`,
    }
  }
  if (val < SCRL_VAL_MACOS_RECOMMENDED) {
    return {
      level: 'warn',
      message: `SCRL_VAL < ${SCRL_VAL_MACOS_RECOMMENDED} feels sluggish on macOS`,
    }
  }
  return OK
}

export function checkTriggersPerRotation(tpr: number, steps: number): HintResult {
  if (tpr <= 0 || steps <= 0) return OK
  if (steps % tpr !== 0) {
    return {
      level: 'warn',
      message: `Non-divisor of steps=${steps}; the first detent after idle can misfire`,
    }
  }
  return OK
}

// sensor-bindings は behavior ノードを指すだけで、回転方向ごとの割当はノード側の
// `cw-binding` / `ccw-binding` が持つ。
export function describeEncoderRotation(
  chain: BindingChain,
  behaviors: BehaviorEntry[],
): EncoderRotationDescription | null {
  if (chain.tokens.length !== 1) return null
  const token = chain.tokens[0]!
  const behavior = behaviors.find(
    (b) => `&${b.name}` === token && b.compatible === RUNTIME_SENSOR_ROTATE,
  )
  if (!behavior) return null
  return {
    behavior: token,
    cw: rotationBinding(behavior, 'cw-binding'),
    ccw: rotationBinding(behavior, 'ccw-binding'),
  }
}

function rotationChain(behavior: BehaviorEntry, prop: RotationProp): BindingChain | null {
  const value = behavior.props.find((p) => p.name === prop)?.value
  if (value === undefined) return null
  const chain = parseSingleBindingChain(value)
  return chain.tokens.length > 0 ? chain : null
}

function rotationBinding(behavior: BehaviorEntry, prop: RotationProp): RotationBinding | null {
  const chain = rotationChain(behavior, prop)
  if (!chain) return null
  const [head, ...args] = chain.tokens
  const target = getBehavior(head!)
  const label =
    args.length > 0
      ? args.map((arg, i) => resolveArgLabel(target?.argTypes?.[i] ?? null, arg)).join(' ')
      : (target?.label ?? head!)
  return { tokens: chain.tokens, label }
}

function resolveArgLabel(argType: BehaviorArgType | null, token: string): string {
  if (argType === 'keycode' || argType === 'msc-action') {
    const hit = KEYCODES.find((k) => k.token === token)
    if (hit) return hit.label
  }
  return token
}
