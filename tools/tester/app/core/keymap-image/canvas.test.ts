import { describe, expect, it, beforeEach, vi } from 'vitest'
import { GEOMETRY, renderKeymapPng } from './canvas'
import type { EditorDraft } from '../editor-state/types'
import type { KeyDef } from '../layout'

type FontFaceSetMock = {
  load: ReturnType<typeof vi.fn>
}

type Ctx = {
  scale: ReturnType<typeof vi.fn>
  fillRect: ReturnType<typeof vi.fn>
  fillText: ReturnType<typeof vi.fn>
  strokeRect: ReturnType<typeof vi.fn>
  stroke: ReturnType<typeof vi.fn>
  fill: ReturnType<typeof vi.fn>
  beginPath: ReturnType<typeof vi.fn>
  closePath: ReturnType<typeof vi.fn>
  moveTo: ReturnType<typeof vi.fn>
  arcTo: ReturnType<typeof vi.fn>
  measureText: ReturnType<typeof vi.fn>
  setLineDash: ReturnType<typeof vi.fn>
  font: string
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
}

const makeCtx = (): Ctx => ({
  scale: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  strokeRect: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  arcTo: vi.fn(),
  measureText: vi.fn(() => ({ width: 10 })),
  setLineDash: vi.fn(),
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  textAlign: 'start',
  textBaseline: 'alphabetic',
})

let currentCtx: Ctx
let lastCanvas: { width: number; height: number } | null = null
let toBlobCalls = 0

const chain = (...tokens: string[]) => ({ tokens })

const draft: EditorDraft = {
  layers: [
    {
      name: 'default_layer',
      bindings: Array.from({ length: 44 }, (_, i) =>
        i === 0 ? chain('&kp', 'A') : i === 1 ? chain('&trans') : chain('&kp', 'B'),
      ),
      sensorBindings: null,
    },
    {
      name: 'Symbol',
      bindings: Array.from({ length: 44 }, () => chain('&mt', 'LSHIFT', 'A')),
      sensorBindings: null,
    },
  ],
  combos: [],
  macros: [],
  behaviors: [],
  mouseGestures: [],
  rootBehaviors: [],
}

const keys: KeyDef[] = [
  { index: 0, x: 0, y: 0, label: 'A', side: 'left', testability: 'keyboard' },
  { index: 1, x: 1, y: 0, label: 'B', side: 'left', testability: 'keyboard' },
  { index: 2, x: 9, y: 0, label: 'C', side: 'right', testability: 'keyboard' },
]

beforeEach(() => {
  currentCtx = makeCtx()
  lastCanvas = null
  toBlobCalls = 0

  const OriginalHTMLCanvas = HTMLCanvasElement
  vi.spyOn(OriginalHTMLCanvas.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    _kind: string,
  ) {
    lastCanvas = { width: this.width, height: this.height }
    return currentCtx as unknown as CanvasRenderingContext2D
  } as HTMLCanvasElement['getContext'])

  vi.spyOn(OriginalHTMLCanvas.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
  ) {
    toBlobCalls += 1
    lastCanvas = { width: this.width, height: this.height }
    cb(new Blob(['fake-png'], { type: 'image/png' }))
  })

  const fontsMock: FontFaceSetMock = {
    load: vi.fn(() => Promise.resolve([])),
  }
  Object.defineProperty(document, 'fonts', {
    value: fontsMock,
    configurable: true,
  })
})

describe('renderKeymapPng', () => {
  it('awaits document.fonts.load for both sans and mono weights before drawing', async () => {
    await renderKeymapPng({
      draft,
      selection: [0],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    const fontsMock = document.fonts as unknown as FontFaceSetMock
    expect(fontsMock.load).toHaveBeenCalled()
    const argsSeen = fontsMock.load.mock.calls.map((c) => c[0])
    expect(argsSeen.some((a: string) => a.includes('Instrument Sans'))).toBe(true)
    expect(argsSeen.some((a: string) => a.includes('JetBrains Mono'))).toBe(true)
  })

  it('produces a canvas sized per stack layout formula for the selection count', async () => {
    await renderKeymapPng({
      draft,
      selection: [0, 1],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    const expectedW = GEOMETRY.LAYER_W + GEOMETRY.OUTER_PAD * 2
    const expectedH =
      GEOMETRY.OUTER_PAD * 2 + 2 * GEOMETRY.LAYER_TOTAL_H + 1 * GEOMETRY.LAYER_GAP
    expect(lastCanvas).toEqual({ width: expectedW * 2, height: expectedH * 2 })
  })

  it('produces a canvas sized per grid layout formula (2 columns)', async () => {
    await renderKeymapPng({
      draft,
      selection: [0, 1],
      layout: 'grid',
      bg: 'light',
      keys,
    })
    const expectedW = GEOMETRY.OUTER_PAD * 2 + 2 * GEOMETRY.LAYER_W + 1 * GEOMETRY.GRID_COL_GAP
    const expectedH = GEOMETRY.OUTER_PAD * 2 + 1 * GEOMETRY.LAYER_TOTAL_H
    expect(lastCanvas).toEqual({ width: expectedW * 2, height: expectedH * 2 })
  })

  it('scales the context by 2 for retina output', async () => {
    await renderKeymapPng({
      draft,
      selection: [0],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    expect(currentCtx.scale).toHaveBeenCalledWith(2, 2)
  })

  it('fills the background when bg=light', async () => {
    await renderKeymapPng({
      draft,
      selection: [0],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    expect(currentCtx.fillRect).toHaveBeenCalled()
  })

  it('does NOT fill the background when bg=transparent', async () => {
    await renderKeymapPng({
      draft,
      selection: [0],
      layout: 'stack',
      bg: 'transparent',
      keys,
    })
    const fillRectCalls = currentCtx.fillRect.mock.calls
    expect(fillRectCalls.length).toBe(0)
  })

  it('draws the layer name in the band via fillText', async () => {
    await renderKeymapPng({
      draft,
      selection: [0],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    const texts = currentCtx.fillText.mock.calls.map((c) => c[0])
    expect(texts).toContain('default_layer')
    expect(texts).toContain('0')
  })

  it('resolves with a PNG blob', async () => {
    const blob = await renderKeymapPng({
      draft,
      selection: [0],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    expect(toBlobCalls).toBe(1)
  })

  it('skips invalid layer indices without throwing', async () => {
    await renderKeymapPng({
      draft,
      selection: [0, 99],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    const expectedH =
      GEOMETRY.OUTER_PAD * 2 + 1 * GEOMETRY.LAYER_TOTAL_H
    expect(lastCanvas?.height).toBe(expectedH * 2)
  })

  it('uses dashed border for &trans cells', async () => {
    await renderKeymapPng({
      draft,
      selection: [0],
      layout: 'stack',
      bg: 'light',
      keys,
    })
    const dashCalls = currentCtx.setLineDash.mock.calls
    const anyDashed = dashCalls.some(
      (c) => Array.isArray(c[0]) && c[0].length > 0,
    )
    expect(anyDashed).toBe(true)
  })
})
