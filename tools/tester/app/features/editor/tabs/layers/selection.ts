// Pure selection/marquee helpers for the Layers tab. DOM-free on purpose:
// the component collects client rects and feeds them in, so the geometry and
// paste rules stay unit-testable under jsdom (where getBoundingClientRect
// returns zeros and a rendered marquee cannot be exercised end-to-end).

import type { BindingChain } from '../../../../core/keymap-dt/types'

export type Rect = { left: number; top: number; right: number; bottom: number }

export type ClipboardEntry = { keyIdx: number; chain: BindingChain }

/**
 * Minimum pointer travel (px) before a mousedown becomes a marquee drag.
 * Below this the gesture stays a plain click.
 */
export const DRAG_THRESHOLD_PX = 5

export function applyClickSelection(
  prev: ReadonlySet<number>,
  idx: number,
  mods: { shift: boolean; toggle: boolean },
): Set<number> {
  if (mods.toggle) {
    const next = new Set(prev)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    return next
  }
  if (mods.shift) {
    const next = new Set(prev)
    next.add(idx)
    return next
  }
  return new Set([idx])
}

export function normalizeRect(
  start: { x: number; y: number },
  cur: { x: number; y: number },
): Rect {
  return {
    left: Math.min(start.x, cur.x),
    top: Math.min(start.y, cur.y),
    right: Math.max(start.x, cur.x),
    bottom: Math.max(start.y, cur.y),
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom
}

export function hitTestCells(
  marquee: Rect,
  cells: Array<{ idx: number; rect: Rect }>,
): Set<number> {
  const hits = new Set<number>()
  for (const cell of cells) {
    if (rectsIntersect(marquee, cell.rect)) hits.add(cell.idx)
  }
  return hits
}

export function marqueeSelection(
  base: ReadonlySet<number>,
  hits: Set<number>,
  additive: boolean,
): Set<number> {
  if (!additive) return new Set(hits)
  const next = new Set(base)
  for (const idx of hits) next.add(idx)
  return next
}

/**
 * The chain shared by every selected key, or null when the selection is
 * heterogeneous (or empty, or any index has no binding).
 */
export function commonChain(
  bindings: BindingChain[],
  idxs: ReadonlySet<number>,
): BindingChain | null {
  let shared: BindingChain | null = null
  for (const idx of idxs) {
    const chain = bindings[idx]
    if (!chain) return null
    if (shared === null) {
      shared = chain
      continue
    }
    if (
      chain.tokens.length !== shared.tokens.length ||
      chain.tokens.some((t, i) => t !== shared!.tokens[i])
    ) {
      return null
    }
  }
  return shared
}

/**
 * Paste rules, in one place:
 * - single entry → broadcast its chain to the selection (fallback: hovered key)
 * - multiple entries → positional paste onto the stored keyIdx values,
 *   ignoring the selection (the cross-layer copy use case)
 * Returns null when there is nothing to paste or no target.
 */
export function resolvePasteEdits(
  clipboard: { entries: ClipboardEntry[] } | null,
  selection: ReadonlySet<number>,
  hoveredIdx: number | null,
): Array<{ keyIdx: number; chain: BindingChain }> | null {
  if (!clipboard || clipboard.entries.length === 0) return null
  if (clipboard.entries.length === 1) {
    const chain = clipboard.entries[0].chain
    const targets = selection.size > 0 ? [...selection] : hoveredIdx !== null ? [hoveredIdx] : []
    if (targets.length === 0) return null
    return targets.map((keyIdx) => ({ keyIdx, chain: { tokens: [...chain.tokens] } }))
  }
  return clipboard.entries.map((e) => ({
    keyIdx: e.keyIdx,
    chain: { tokens: [...e.chain.tokens] },
  }))
}
