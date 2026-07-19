import type { EditorDraft } from '../editor-state/types'
import type { BindingChain } from '../keymap-dt/types'
import type { KeyDef } from '../layout'
import { formatBindingForCell, type CellDisplay } from '../binding-display'

export type BgKind = 'light' | 'dark' | 'transparent'
export type LayoutKind = 'stack' | 'grid'

export type RenderKeymapArgs = {
  draft: EditorDraft
  /** Layer indices in draft.layers, in the order to render. */
  selection: number[]
  layout: LayoutKind
  bg: BgKind
  /** Physical key positions, injected so this module stays free of virtual:zmk-layout. */
  keys: KeyDef[]
}

type Palette = {
  bg: string
  capIdle: string
  capMod: string
  capTrans: string
  border: string
  borderStrong: string
  fg: string
  fgSubtle: string
  transFg: string
  bandBg: string
}

const LIGHT: Palette = {
  bg: '#f6f6f4',
  capIdle: '#ffffff',
  capMod: '#f3f3f0',
  capTrans: '#fafafa',
  border: 'rgba(22,24,29,0.14)',
  borderStrong: 'rgba(22,24,29,0.28)',
  fg: '#16181d',
  fgSubtle: '#6a707a',
  transFg: '#bcc0c8',
  bandBg: 'rgba(22,24,29,0.045)',
}

const DARK: Palette = {
  bg: '#16181d',
  capIdle: '#22252b',
  capMod: '#2c2f36',
  capTrans: '#1e2126',
  border: 'rgba(255,255,255,0.16)',
  borderStrong: 'rgba(255,255,255,0.30)',
  fg: '#e8eaee',
  fgSubtle: '#a0a4ac',
  transFg: '#5c6069',
  bandBg: 'rgba(255,255,255,0.06)',
}

const TRANSPARENT: Palette = { ...LIGHT, bg: 'transparent' }

const PALETTES: Record<BgKind, Palette> = {
  light: LIGHT,
  dark: DARK,
  transparent: TRANSPARENT,
}

const UNIT = 64
const KEY_SIZE = 56
const KEY_OFFSET = 4
const RIGHT_X_OFFSET = 8.5
const LEFT_W = (6.5 + 1) * UNIT
const RIGHT_W = (15 - 8.5 + 1) * UNIT
const HALVES_GAP = 32
const LAYER_W = LEFT_W + HALVES_GAP + RIGHT_W
const LAYER_H = (3 + 1) * UNIT
const BAND_H = 28
const LAYER_TOTAL_H = LAYER_H + BAND_H
const LAYER_GAP = 24
const OUTER_PAD = 32
const GRID_COL_GAP = 24

const FONT_SANS = "'Instrument Sans', system-ui, -apple-system, sans-serif"
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"

type CapKind = 'idle' | 'mod' | 'trans'

function classifyBinding(chain: BindingChain | undefined): CapKind {
  if (!chain || chain.tokens.length === 0) return 'idle'
  const head = chain.tokens[0]
  if (head === '&trans' || head === '&none') return 'trans'
  if (head.startsWith('&') && head !== '&kp') return 'mod'
  return 'idle'
}

function capBg(kind: CapKind, palette: Palette): string {
  if (kind === 'mod') return palette.capMod
  if (kind === 'trans') return palette.capTrans
  return palette.capIdle
}

function capBorderColor(kind: CapKind, palette: Palette): string {
  return kind === 'trans' ? palette.borderStrong : palette.border
}

function mainLineFontSize(label: string): number {
  const len = label.length
  if (len <= 1) return 20
  if (len <= 2) return 18
  if (len <= 4) return 14
  if (len <= 8) return 11
  return 10
}

function fitMainLineSize(
  ctx: CanvasRenderingContext2D,
  label: string,
  maxWidth: number,
): number {
  let size = mainLineFontSize(label)
  while (size > 8) {
    ctx.font = `600 ${size}px ${FONT_SANS}`
    if (ctx.measureText(label).width <= maxWidth) return size
    size -= 1
  }
  return 8
}

function drawKeyCap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  chain: BindingChain | undefined,
  display: CellDisplay,
  palette: Palette,
) {
  const kind = classifyBinding(chain)
  const radius = 7

  ctx.beginPath()
  roundRect(ctx, x, y, size, size, radius)
  ctx.fillStyle = capBg(kind, palette)
  ctx.fill()

  ctx.beginPath()
  roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, radius - 0.5)
  ctx.strokeStyle = capBorderColor(kind, palette)
  ctx.lineWidth = 1
  if (kind === 'trans') ctx.setLineDash([4, 3])
  else ctx.setLineDash([])
  ctx.stroke()
  ctx.setLineDash([])

  const mainColor = display.faint ? palette.transFg : palette.fg
  const subColor = palette.fgSubtle
  const pad = 5

  if (display.topLine) {
    ctx.fillStyle = subColor
    ctx.font = `500 8px ${FONT_MONO}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(display.topLine, x + pad, y + pad, size - pad * 2)
  }

  if (display.mainLine) {
    const maxW = size - pad * 2
    const fs = fitMainLineSize(ctx, display.mainLine, maxW)
    ctx.fillStyle = mainColor
    ctx.font = `600 ${fs}px ${FONT_SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(display.mainLine, x + size / 2, y + size / 2, maxW)
  }

  if (display.subLine) {
    ctx.fillStyle = subColor
    ctx.font = `500 8px ${FONT_MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(display.subLine, x + size / 2, y + size - pad, size - pad * 2)
  }
}

function drawLayerBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  layerIdx: number,
  layerName: string,
  palette: Palette,
) {
  ctx.beginPath()
  roundRect(ctx, x, y, width, BAND_H, 6)
  ctx.fillStyle = palette.bandBg
  ctx.fill()

  ctx.font = `600 11px ${FONT_MONO}`
  ctx.fillStyle = palette.fgSubtle
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(layerIdx), x + 12, y + BAND_H / 2)

  ctx.font = `600 13px ${FONT_SANS}`
  ctx.fillStyle = palette.fg
  const idxLabelW = 20
  ctx.fillText(layerName, x + 12 + idxLabelW, y + BAND_H / 2)
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  layerIdx: number,
  layerName: string,
  bindings: BindingChain[],
  keys: KeyDef[],
  palette: Palette,
) {
  drawLayerBand(ctx, x, y, LAYER_W, layerIdx, layerName, palette)

  const boardY = y + BAND_H
  for (const k of keys) {
    const isLeft = k.side === 'left'
    const localX = isLeft
      ? k.x * UNIT + KEY_OFFSET
      : (k.x - RIGHT_X_OFFSET) * UNIT + KEY_OFFSET + LEFT_W + HALVES_GAP
    const localY = k.y * UNIT + KEY_OFFSET
    const chain = bindings[k.index]
    const display = chain
      ? formatBindingForCell(chain)
      : { topLine: '', mainLine: '', faint: true }
    drawKeyCap(ctx, x + localX, boardY + localY, KEY_SIZE, chain, display, palette)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function computeCanvasSize(layout: LayoutKind, n: number): { w: number; h: number } {
  if (layout === 'stack') {
    const w = LAYER_W + OUTER_PAD * 2
    const h = OUTER_PAD * 2 + n * LAYER_TOTAL_H + (n - 1) * LAYER_GAP
    return { w, h }
  }
  const cols = 2
  const rows = Math.ceil(n / cols)
  const w = OUTER_PAD * 2 + cols * LAYER_W + (cols - 1) * GRID_COL_GAP
  const h = OUTER_PAD * 2 + rows * LAYER_TOTAL_H + (rows - 1) * LAYER_GAP
  return { w, h }
}

function layerPosition(
  layout: LayoutKind,
  slot: number,
): { x: number; y: number } {
  if (layout === 'stack') {
    return {
      x: OUTER_PAD,
      y: OUTER_PAD + slot * (LAYER_TOTAL_H + LAYER_GAP),
    }
  }
  const cols = 2
  const col = slot % cols
  const row = Math.floor(slot / cols)
  return {
    x: OUTER_PAD + col * (LAYER_W + GRID_COL_GAP),
    y: OUTER_PAD + row * (LAYER_TOTAL_H + LAYER_GAP),
  }
}

async function ensureFontsLoaded(): Promise<void> {
  const anyDoc = document as Document & { fonts?: FontFaceSet }
  const fonts = anyDoc.fonts
  if (!fonts || typeof fonts.load !== 'function') return
  await Promise.all([
    fonts.load(`600 12px "Instrument Sans"`),
    fonts.load(`600 13px "Instrument Sans"`),
    fonts.load(`500 11px "JetBrains Mono"`),
    fonts.load(`500 8px "JetBrains Mono"`),
  ])
}

export async function renderKeymapPng(args: RenderKeymapArgs): Promise<Blob> {
  const { draft, selection, layout, bg, keys } = args
  const palette = PALETTES[bg]
  const layers = selection
    .map((i) => draft.layers[i])
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
  const layerIndices = selection.filter((i) => draft.layers[i])

  await ensureFontsLoaded()

  const { w, h } = computeCanvasSize(layout, layers.length)
  const canvas = document.createElement('canvas')
  canvas.width = w * 2
  canvas.height = h * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2D context unavailable')
  ctx.scale(2, 2)

  if (bg !== 'transparent') {
    ctx.fillStyle = palette.bg
    ctx.fillRect(0, 0, w, h)
  }

  layers.forEach((layer, slot) => {
    const pos = layerPosition(layout, slot)
    drawLayer(ctx, pos.x, pos.y, layerIndices[slot], layer.name, layer.bindings, keys, palette)
  })

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

/** Exposed for tests only — allows the test to compute expected canvas dimensions. */
export const GEOMETRY = {
  LAYER_W,
  LAYER_H,
  LAYER_TOTAL_H,
  LAYER_GAP,
  OUTER_PAD,
  GRID_COL_GAP,
  BAND_H,
  UNIT,
  KEY_SIZE,
}
