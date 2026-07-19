// `&bt` is awkward to model as a generic argType list (BT_SEL takes a profile
// index, BT_NXT/BT_PRV/BT_CLR take none). This form replaces the regular arg
// slot UI with a single high-level selector and handles tokens roundtripping
// in one place.

import { useEffect } from 'hono/jsx'
import { DockField } from '../../../../features/editor/shell/dock-field'

type Props = {
  /** Full chain including the leading `&bt`, e.g. `['&bt', 'BT_SEL', '1']` or `['&bt', 'BT_NXT']`. */
  tokens: string[]
  onChange: (tokens: string[]) => void
}

const OPTIONS = [
  { value: 'BT_SEL_0', label: 'BT_SEL 0', tokens: ['BT_SEL', '0'] },
  { value: 'BT_SEL_1', label: 'BT_SEL 1', tokens: ['BT_SEL', '1'] },
  { value: 'BT_SEL_2', label: 'BT_SEL 2', tokens: ['BT_SEL', '2'] },
  { value: 'BT_SEL_3', label: 'BT_SEL 3', tokens: ['BT_SEL', '3'] },
  { value: 'BT_SEL_4', label: 'BT_SEL 4', tokens: ['BT_SEL', '4'] },
  { value: 'BT_CLR', label: 'BT_CLR (clear current)', tokens: ['BT_CLR'] },
  { value: 'BT_NXT', label: 'BT_NXT (next profile)', tokens: ['BT_NXT'] },
  { value: 'BT_PRV', label: 'BT_PRV (previous profile)', tokens: ['BT_PRV'] },
] as const

type OptionValue = (typeof OPTIONS)[number]['value']

export function btTokensToOption(tokens: string[]): OptionValue {
  const [, op, arg] = tokens
  if (op === 'BT_SEL' && arg !== undefined) {
    const v = `BT_SEL_${arg}` as OptionValue
    return OPTIONS.some((o) => o.value === v) ? v : 'BT_SEL_0'
  }
  if (op === 'BT_CLR') return 'BT_CLR'
  if (op === 'BT_NXT') return 'BT_NXT'
  if (op === 'BT_PRV') return 'BT_PRV'
  return 'BT_SEL_0'
}

export function btOptionToTokens(value: OptionValue): string[] {
  const opt = OPTIONS.find((o) => o.value === value)
  if (!opt) return ['&bt', 'BT_SEL', '0']
  return ['&bt', ...opt.tokens]
}

export function BtSpecialForm({ tokens, onChange }: Props) {
  const current = btTokensToOption(tokens)
  // When a behaviour swap (e.g. &kp Q → &bt) reseeds args to [''], the
  // displayed default "BT_SEL 0" doesn't match the parent state and a commit
  // would emit a bare `&bt`. Sync the parent to the resolved default so the
  // visible value is always the value that commits.
  const expectedTokens = btOptionToTokens(current)
  const synced =
    tokens.length === expectedTokens.length &&
    tokens.every((t, i) => t === expectedTokens[i])
  useEffect(() => {
    if (!synced) onChange(expectedTokens)
  }, [synced])

  return (
    <DockField label="BLUETOOTH ACTION">
      {/*
        hono/jsx/dom applies `select.value` before <option> children are
        appended, which strands non-default selections at selectedIndex 0.
        Mark the target <option> as `selected` instead — that path runs at
        per-option DOM creation and survives the append order.
      */}
      <select
        class="flex-1 min-w-0 border-none outline-none bg-transparent font-mono font-semibold text-[13px] leading-none text-fg cursor-pointer"
        onChange={(e: Event) => {
          const v = (e.target as HTMLSelectElement).value as OptionValue
          onChange(btOptionToTokens(v))
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value} selected={o.value === current}>
            {o.label}
          </option>
        ))}
      </select>
    </DockField>
  )
}
