import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { EditorDraft } from '../editor-state/types'
import type { KeyDef } from '../layout'

vi.mock('./canvas', () => ({
  renderKeymapPng: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
}))

import { copyKeymapToClipboard, downloadKeymapPng } from './export'
import * as canvasMod from './canvas'

const draft: EditorDraft = {
  layers: [{ name: 'default_layer', bindings: [], sensorBindings: null }],
  combos: [],
  macros: [],
  behaviors: [],
  mouseGestures: [],
  rootBehaviors: [],
}
const keys: KeyDef[] = []
const args = { draft, selection: [0], layout: 'stack' as const, bg: 'light' as const, keys }

class MockClipboardItem {
  presentationStyle: 'unspecified' = 'unspecified'
  items: Record<string, Blob | Promise<Blob>>
  constructor(items: Record<string, Blob | Promise<Blob>>) {
    this.items = items
  }
  getType(type: string): Promise<Blob> {
    const v = this.items[type]
    return v instanceof Promise ? v : Promise.resolve(v as Blob)
  }
  types = ['image/png']
}

beforeEach(() => {
  ;(canvasMod.renderKeymapPng as ReturnType<typeof vi.fn>).mockClear()
  ;(globalThis as unknown as { ClipboardItem: typeof MockClipboardItem }).ClipboardItem =
    MockClipboardItem
})

describe('copyKeymapToClipboard', () => {
  it('calls clipboard.write with a ClipboardItem that includes image/png', async () => {
    const write = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { write },
      configurable: true,
    })

    await copyKeymapToClipboard(args)

    expect(write).toHaveBeenCalledTimes(1)
    const [items] = write.mock.calls[0] as unknown as [MockClipboardItem[]]
    expect(items.length).toBe(1)
    expect(items[0].items['image/png']).toBeDefined()
  })

  it('passes a Promise<Blob> (not an awaited Blob) to ClipboardItem to preserve user activation', async () => {
    const write = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { write },
      configurable: true,
    })

    await copyKeymapToClipboard(args)

    const [items] = write.mock.calls[0] as unknown as [MockClipboardItem[]]
    const pngEntry = items[0].items['image/png']
    expect(pngEntry).toBeInstanceOf(Promise)
  })

  it('re-throws when clipboard.write rejects', async () => {
    const write = vi.fn(() => Promise.reject(new Error('nope')))
    Object.defineProperty(navigator, 'clipboard', {
      value: { write },
      configurable: true,
    })
    await expect(copyKeymapToClipboard(args)).rejects.toThrow('nope')
  })
})

describe('downloadKeymapPng', () => {
  it('creates an <a> with the given download attribute and revokes the object URL', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    })

    const appended: HTMLAnchorElement[] = []
    const spy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(function (this: HTMLElement, el: Node) {
        appended.push(el as HTMLAnchorElement)
        return HTMLElement.prototype.appendChild.call(this, el) as Node
      } as typeof document.body.appendChild)

    try {
      await downloadKeymapPng(args, 'dax6-layers.png')

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      const a = appended.find((el) => el.tagName === 'A')
      expect(a).toBeDefined()
      expect(a?.download).toBe('dax6-layers.png')
      expect(a?.href.endsWith('blob:mock-url')).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })
})
