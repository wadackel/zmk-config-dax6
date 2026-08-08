// Component-level tests for the Layers tab selection model. Rendered with the
// 3-key virtual-layout mock (2 left keys + 1 right key). Marquee geometry is
// unit-tested in selection.test.ts; here only the mousedown→mousemove→mouseup
// wiring and click suppression get a smoke test with mocked client rects,
// since jsdom's real getBoundingClientRect returns zeros.

import { render } from 'hono/jsx/dom'
import { useEffect } from 'hono/jsx'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EditorProvider, useEditor } from '../../../../../core/editor-state/context'
import type { EditorAction, EditorState } from '../../../../../core/editor-state/types'
import type { LayerData } from '../../../../../core/keymap-dt/types'
import { LayersTab } from '../layers-tab'

let container: HTMLDivElement
let tabStub: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  // The keydown handlers only act while the Layers tab is the active editor
  // tab, detected through this DOM probe.
  tabStub = document.createElement('div')
  tabStub.setAttribute('role', 'tab')
  tabStub.setAttribute('data-editor-tab', 'layers')
  tabStub.setAttribute('aria-selected', 'true')
  document.body.appendChild(tabStub)
})

afterEach(() => {
  container.remove()
  tabStub.remove()
})

// hono/jsx flushes queued useEffect runners one requestAnimationFrame after
// each committed render (dom/render.js), and jsdom's rAF sits on a ~16 ms
// timer — a bare `setTimeout(0)` wakes up before the effects (window keydown
// / marquee listeners) are installed.
async function nextFrame() {
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  await new Promise((r) => setTimeout(r, 0))
}

const makeLayer = (name: string, chains: string[][]): LayerData => ({
  name,
  bindings: chains.map((tokens) => ({ tokens: [...tokens] })),
  sensorBindings: null,
})

let editor: { state: EditorState; dispatch: (a: EditorAction) => void }

function Capture() {
  editor = useEditor()
  return <></>
}

async function mount() {
  render(
    <EditorProvider>
      <>
        <Capture />
        <LayersTab />
      </>
    </EditorProvider>,
    container,
  )
  await nextFrame()
  editor.dispatch({
    type: 'LOAD',
    source: '',
    mtimeMs: 1,
    draft: {
      layers: [
        makeLayer('default_layer', [['&kp', 'A'], ['&kp', 'B'], ['&kp', 'C']]),
        makeLayer('Symbol', [['&trans'], ['&trans'], ['&trans']]),
      ],
      combos: [],
      macros: [],
      behaviors: [],
      mouseGestures: [],
      rootBehaviors: [],
    },
  })
  await nextFrame()
}

const capButton = (idx: number) =>
  container.querySelector<HTMLButtonElement>(`[data-key="${idx}"] button`)!

const selectedCaps = () =>
  Array.from(container.querySelectorAll('[data-key] button[data-state="selected"]')).map((el) =>
    Number(el.closest('[data-key]')!.getAttribute('data-key')),
  )

const click = (el: Element, init: MouseEventInit = {}) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }))

const keydown = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent('keydown', init))

describe('LayersTab selection', () => {
  it('plain click selects exactly one key; another plain click moves the selection', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    expect(selectedCaps()).toEqual([0])
    click(capButton(1))
    await nextFrame()
    expect(selectedCaps()).toEqual([1])
  })

  it('cmd-click toggles membership; shift-click adds without removing', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    click(capButton(1), { metaKey: true })
    await nextFrame()
    expect(selectedCaps()).toEqual([0, 1])
    click(capButton(1), { metaKey: true })
    await nextFrame()
    expect(selectedCaps()).toEqual([0])
    click(capButton(2), { shiftKey: true })
    await nextFrame()
    expect(selectedCaps()).toEqual([0, 2])
    click(capButton(2), { shiftKey: true })
    await nextFrame()
    expect(selectedCaps()).toEqual([0, 2])
  })

  it('a multi-selection opens the dock in batch mode with an "N keys" label', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    click(capButton(1), { shiftKey: true })
    await nextFrame()
    const dock = container.querySelector('section[role="complementary"]')!
    expect(dock.textContent).toContain('2 keys')
    expect(dock.textContent).toContain('mixed bindings')
  })

  it('a homogeneous multi-selection shows the shared chain as subtitle', async () => {
    await mount()
    editor.dispatch({ type: 'SET_ACTIVE_LAYER', layerIdx: 1 })
    await nextFrame()
    click(capButton(0))
    await nextFrame()
    click(capButton(1), { shiftKey: true })
    await nextFrame()
    const dock = container.querySelector('section[role="complementary"]')!
    expect(dock.textContent).toContain('2 keys')
    expect(dock.textContent).toContain('&trans')
  })

  it('Escape clears the selection and closes the dock', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    click(capButton(1), { shiftKey: true })
    await nextFrame()
    keydown({ key: 'Escape' })
    await nextFrame()
    expect(selectedCaps()).toEqual([])
    expect(container.textContent).toContain('No key selected')
  })

  it('switching layers clears the selection', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    editor.dispatch({ type: 'SET_ACTIVE_LAYER', layerIdx: 1 })
    await nextFrame()
    expect(selectedCaps()).toEqual([])
  })

  it('context-menu reset applies to the whole selection as one undo step', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    click(capButton(1), { metaKey: true })
    await nextFrame()
    capButton(0).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
    )
    await nextFrame()
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    const reset = items.find((b) => b.textContent?.includes('Reset 2 keys to &trans'))!
    expect(reset).toBeDefined()
    const pastBefore = editor.state.past.length
    click(reset)
    await nextFrame()
    expect(editor.state.draft.layers[0].bindings[0].tokens).toEqual(['&trans'])
    expect(editor.state.draft.layers[0].bindings[1].tokens).toEqual(['&trans'])
    expect(editor.state.draft.layers[0].bindings[2].tokens).toEqual(['&kp', 'C'])
    expect(editor.state.past.length).toBe(pastBefore + 1)
  })

  it('right-click outside the selection retargets it to the clicked key', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    capButton(2).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
    )
    await nextFrame()
    expect(selectedCaps()).toEqual([2])
  })

  it('Cmd+C on a multi-selection then Cmd+V on another layer pastes positionally', async () => {
    await mount()
    click(capButton(0))
    await nextFrame()
    click(capButton(1), { shiftKey: true })
    await nextFrame()
    keydown({ key: 'c', metaKey: true })
    await nextFrame()
    expect(editor.state.clipboard?.entries).toEqual([
      { keyIdx: 0, chain: { tokens: ['&kp', 'A'] } },
      { keyIdx: 1, chain: { tokens: ['&kp', 'B'] } },
    ])
    editor.dispatch({ type: 'SET_ACTIVE_LAYER', layerIdx: 1 })
    await nextFrame()
    keydown({ key: 'v', metaKey: true })
    await nextFrame()
    expect(editor.state.draft.layers[1].bindings[0].tokens).toEqual(['&kp', 'A'])
    expect(editor.state.draft.layers[1].bindings[1].tokens).toEqual(['&kp', 'B'])
    expect(editor.state.draft.layers[1].bindings[2].tokens).toEqual(['&trans'])
  })

  it('Cmd+V with a single clipboard entry broadcasts to the selection', async () => {
    await mount()
    // Copy key 2 (&kp C) via hover fallback.
    capButton(2).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    await nextFrame()
    keydown({ key: 'c', metaKey: true })
    await nextFrame()
    expect(editor.state.clipboard?.entries).toHaveLength(1)
    click(capButton(0))
    await nextFrame()
    click(capButton(1), { shiftKey: true })
    await nextFrame()
    keydown({ key: 'v', metaKey: true })
    await nextFrame()
    expect(editor.state.draft.layers[0].bindings[0].tokens).toEqual(['&kp', 'C'])
    expect(editor.state.draft.layers[0].bindings[1].tokens).toEqual(['&kp', 'C'])
    expect(selectedCaps()).toEqual([])
  })
})

describe('LayersTab marquee (mocked rects)', () => {
  const RECTS: Record<number, { left: number; top: number; right: number; bottom: number }> = {
    0: { left: 0, top: 0, right: 56, bottom: 56 },
    1: { left: 64, top: 0, right: 120, bottom: 56 },
    2: { left: 200, top: 0, right: 256, bottom: 56 },
  }
  let origGBCR: typeof Element.prototype.getBoundingClientRect

  beforeEach(() => {
    origGBCR = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const dk = this.getAttribute?.('data-key')
      if (dk !== null && dk !== undefined) {
        const r = RECTS[Number(dk)]
        if (r) {
          return { ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, toJSON: () => ({}) } as DOMRect
        }
      }
      return origGBCR.call(this)
    }
  })

  afterEach(() => {
    Element.prototype.getBoundingClientRect = origGBCR
  })

  it('drag selects intersecting keys and the trailing click is suppressed', async () => {
    await mount()
    const grid = container.querySelector('[data-keyboard-grid]')!
    grid.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 130, clientY: 60 }),
    )
    await nextFrame()
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 30 }),
    )
    await nextFrame()
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: -10, clientY: -10 }),
    )
    await nextFrame()
    expect(selectedCaps()).toEqual([0, 1])
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextFrame()
    expect(selectedCaps()).toEqual([0, 1])
    // The browser fires a click on whatever is under the pointer after the
    // drag; it must not collapse the selection.
    click(capButton(0))
    await nextFrame()
    expect(selectedCaps()).toEqual([0, 1])
    // The suppression is one-shot: the next real click behaves normally.
    click(capButton(0))
    await nextFrame()
    expect(selectedCaps()).toEqual([0])
  })

  it('a sub-threshold press stays a plain click', async () => {
    await mount()
    const cap = capButton(1)
    cap.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 70, clientY: 10 }),
    )
    await nextFrame()
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 72, clientY: 11 }),
    )
    await nextFrame()
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextFrame()
    click(cap)
    await nextFrame()
    expect(selectedCaps()).toEqual([1])
  })

  it('Escape during a drag cancels it and restores the previous selection', async () => {
    await mount()
    click(capButton(2))
    await nextFrame()
    const grid = container.querySelector('[data-keyboard-grid]')!
    grid.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
    )
    await nextFrame()
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 110, clientY: 40 }),
    )
    await nextFrame()
    expect(selectedCaps()).toEqual([0, 1])
    keydown({ key: 'Escape' })
    await nextFrame()
    expect(selectedCaps()).toEqual([2])
  })
})
