import { getBoard } from '../boards/active'
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
const MSC_PERIOD_MS = 16

// macOS のマウススクロールは delta が小さすぎると無視されることが実測されて
// おり、120 未満で体感の劣化、60 未満で完全無視になり得る。
const SCRL_VAL_MACOS_MIN = 60
const SCRL_VAL_MACOS_RECOMMENDED = 120

export type HintLevel = 'ok' | 'warn' | 'error'
export type HintResult = { level: HintLevel; message?: string }

const OK: HintResult = { level: 'ok' }

export type EncoderRotationDescription = {
  behavior: string
  behaviorLabel: string
  ccw: string
  cw: string
  argType: BehaviorArgType | null
}

export function extractScrlVal(source: string): number | null {
  const m = source.match(/^\s*#define\s+ZMK_POINTING_DEFAULT_SCRL_VAL\s+(\d+)/m)
  if (!m) return null
  return Number(m[1])
}

export function getEncScrollTapMs(behaviors: BehaviorEntry[]): number | null {
  const enc = behaviors.find((b) => b.name === 'enc_scroll')
  if (!enc) return null
  const prop = enc.props.find((p) => p.name === 'tap-ms')
  if (!prop) return null
  const m = prop.value.match(/<\s*(\d+)\s*>/)
  if (!m) return null
  return Number(m[1])
}

export function checkTapMs(ms: number | null): HintResult {
  if (ms === null) return OK
  if (ms < MSC_PERIOD_MS) {
    return {
      level: 'error',
      message: `tap-ms must be >= ${MSC_PERIOD_MS}ms (msc event period); scroll will not fire`,
    }
  }
  return OK
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

export function describeEncoderRotation(chain: BindingChain): EncoderRotationDescription | null {
  const behaviorToken = chain.tokens[0]
  if (!behaviorToken) return null
  const behavior = getBehavior(behaviorToken)
  if (!behavior) return null
  if (chain.tokens.length !== 3) return null
  // BehaviorEntry.argTypes は引数スロットごとの配列なので、CCW と CW を別々に
  // 解決する。現行 behaviors (enc_scroll / inc_dec_kp) は同型 (2 要素同じ) だが、
  // 将来 [layer, keycode] のような非対称 behavior を追加した瞬間の silent な
  // ラベル誤解決を避けるため意図的に分岐している。
  const ccwArgType = behavior.argTypes?.[0] ?? null
  const cwArgType = behavior.argTypes?.[1] ?? null
  const ccw = resolveArgLabel(ccwArgType, chain.tokens[1]!)
  const cw = resolveArgLabel(cwArgType, chain.tokens[2]!)
  return {
    behavior: behavior.token,
    behaviorLabel: behavior.label,
    ccw,
    cw,
    argType: ccwArgType,
  }
}

function resolveArgLabel(argType: BehaviorArgType | null, token: string): string {
  if (argType === 'keycode' || argType === 'msc-action') {
    const hit = KEYCODES.find((k) => k.token === token)
    if (hit) return hit.label
  }
  return token
}
