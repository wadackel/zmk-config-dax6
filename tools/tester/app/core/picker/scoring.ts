// Keycode relevance scoring used by the binding-picker combobox.
//
// The match types are ranked so that an exact label or token comes first, then
// prefixes, then substrings. Aliases score one tier below the same match type
// on label/token. Group order and original array order break ties so the
// output is deterministic across runs.

import { KEYCODES, type KeycodeEntry, type KeycodeGroup } from './keycodes'

// Higher score = higher in the result list.
const SCORE = {
  exactLabel: 100,
  exactToken: 95,
  tokenPrefix: 80,
  labelPrefix: 78,
  aliasPrefix: 60,
  tokenSubstring: 40,
  labelSubstring: 38,
  aliasSubstring: 20,
  none: 0,
} as const

const GROUP_ORDER: KeycodeGroup[] = [
  'letters',
  'numbers',
  'symbols',
  'brackets',
  'modifiers',
  'nav',
  'media',
  'mouse',
  'lang',
  'system',
]

const GROUP_RANK: Record<KeycodeGroup, number> = (() => {
  const out = {} as Record<KeycodeGroup, number>
  for (let i = 0; i < GROUP_ORDER.length; i++) out[GROUP_ORDER[i]] = i
  return out
})()

function scoreEntry(entry: KeycodeEntry, q: string): number {
  const token = entry.token.toLowerCase()
  const label = entry.label.toLowerCase()
  const aliases = (entry.aliases ?? []).map((a) => a.toLowerCase())
  if (label === q) return SCORE.exactLabel
  if (token === q) return SCORE.exactToken
  if (token.startsWith(q)) return SCORE.tokenPrefix
  if (label.startsWith(q)) return SCORE.labelPrefix
  if (aliases.some((a) => a.startsWith(q))) return SCORE.aliasPrefix
  if (token.includes(q)) return SCORE.tokenSubstring
  if (label.includes(q)) return SCORE.labelSubstring
  if (aliases.some((a) => a.includes(q))) return SCORE.aliasSubstring
  return SCORE.none
}

export function searchKeycodesRanked(query: string): KeycodeEntry[] {
  const q = query.toLowerCase().trim()
  if (!q) return KEYCODES
  const scored: { entry: KeycodeEntry; score: number; idx: number }[] = []
  for (let i = 0; i < KEYCODES.length; i++) {
    const entry = KEYCODES[i]
    const score = scoreEntry(entry, q)
    if (score > 0) scored.push({ entry, score, idx: i })
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    const ga = GROUP_RANK[a.entry.group]
    const gb = GROUP_RANK[b.entry.group]
    if (ga !== gb) return ga - gb
    return a.idx - b.idx
  })
  return scored.map((s) => s.entry)
}
