// Component-level tests for the Sensors tab against the keymap fixture: the
// CW / CCW cards resolve through the assigned rotate behavior, the tuning dock
// carries one TAP-MS field per `&msc` rotate behavior, and an encoder can be
// re-pointed at another behavior through the binding dock.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from 'hono/jsx/dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EditorProvider, useEditor } from '../../../../../core/editor-state/context'
import type { EditorAction, EditorDraft, EditorState } from '../../../../../core/editor-state/types'
import { parseKeymap } from '../../../../../core/keymap-dt/parse'
import { SensorsTab } from '../sensors-tab'

const fixture = readFileSync(
  path.resolve(__dirname, '../../../../../core/keymap-dt/__fixtures__/dax6.keymap'),
  'utf8',
)

let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  container.remove()
})

// hono/jsx flushes queued useEffect runners one requestAnimationFrame after
// each committed render, and jsdom's rAF sits on a ~16 ms timer.
async function nextFrame() {
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  await new Promise((r) => setTimeout(r, 0))
}

let editor: { state: EditorState; dispatch: (a: EditorAction) => void }

function Capture() {
  editor = useEditor()
  return <></>
}

function fixtureDraft(): EditorDraft {
  const { layers, combos, macros, behaviors, mouseGestures, rootBehaviors } = parseKeymap(fixture)
  return { layers, combos, macros, behaviors, mouseGestures, rootBehaviors }
}

async function mount(draft: EditorDraft = fixtureDraft()) {
  render(
    <EditorProvider>
      <>
        <Capture />
        <SensorsTab />
      </>
    </EditorProvider>,
    container,
  )
  await nextFrame()
  editor.dispatch({ type: 'LOAD', source: fixture, mtimeMs: 1, draft })
  await nextFrame()
}

const card = (direction: 'cw' | 'ccw') =>
  container.querySelector(`[data-rotation="${direction}"]`)!.textContent ?? ''

const dock = () => container.querySelector('section[role="complementary"]')!

const assignButton = () =>
  container.querySelector<HTMLButtonElement>('button[aria-label^="Change behavior"]')!

const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const layerIdx = (name: string) => editor.state.draft.layers.findIndex((l) => l.name === name)

describe('SensorsTab rotation cards', () => {
  it('resolves CW / CCW through the behavior assigned to the selected encoder', async () => {
    await mount()
    expect(assignButton().textContent).toContain('&rsr_scroll')
    expect(card('cw')).toContain('&msc SCRL_UP')
    expect(card('cw')).toContain('Scroll↑')
    expect(card('ccw')).toContain('&msc SCRL_DOWN')
    expect(card('ccw')).toContain('Scroll↓')
  })

  it('follows the encoder selector', async () => {
    await mount()
    click(container.querySelectorAll('[role="radio"]')[1]!)
    await nextFrame()
    expect(assignButton().textContent).toContain('&rsr_scroll_rev')
    expect(card('cw')).toContain('&msc SCRL_DOWN')
    expect(card('ccw')).toContain('&msc SCRL_UP')
  })

  it('follows the active layer', async () => {
    await mount()
    editor.dispatch({ type: 'SET_ACTIVE_LAYER', layerIdx: layerIdx('Num') })
    await nextFrame()
    expect(assignButton().textContent).toContain('&rsr_vol')
    expect(card('cw')).toContain('&kp C_VOL_DN')
    expect(card('cw')).toContain('Vol-')
    expect(card('ccw')).toContain('&kp C_VOL_UP')
    expect(card('ccw')).toContain('Vol+')
  })

  it('shows unresolved cards for an assignment that is not a rotate behavior', async () => {
    await mount()
    editor.dispatch({
      type: 'UPDATE_SENSOR_BINDING',
      layerIdx: 0,
      encoderIdx: 0,
      chain: { tokens: ['&trans'] },
    })
    await nextFrame()
    expect(card('cw')).toContain('—')
    expect(card('ccw')).toContain('—')
    expect(container.textContent).toContain('Not a runtime-sensor-rotate behavior')
  })
})

describe('SensorsTab re-assignment', () => {
  it('re-points an encoder at another rotate behavior through the binding dock', async () => {
    await mount()
    click(assignButton())
    await nextFrame()

    const input = dock().querySelector<HTMLInputElement>('input[aria-label="Behaviour"]')!
    input.focus()
    await nextFrame()
    input.value = 'rsr_vol'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextFrame()
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await nextFrame()
    const commit = Array.from(dock().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Commit',
    )!
    commit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await nextFrame()

    expect(editor.state.draft.layers[0]!.sensorBindings!.perEncoder.map((c) => c.tokens)).toEqual([
      ['&rsr_vol'],
      ['&rsr_scroll_rev'],
    ])
    expect(card('cw')).toContain('Vol-')
  })
})

describe('SensorsTab tap-ms tuning', () => {
  const tapMsInput = (name: string) =>
    dock().querySelector<HTMLInputElement>(`input[id="tap-ms-${name}"]`)

  it('lists one field per &msc rotate behavior and reports the rules as OK', async () => {
    await mount()
    expect(tapMsInput('rsr_scroll')?.value).toBe('20')
    expect(tapMsInput('rsr_scroll_rev')?.value).toBe('20')
    expect(tapMsInput('rsr_hscroll')?.value).toBe('20')
    expect(tapMsInput('rsr_vol')).toBeNull()
    expect(tapMsInput('rsr_bri')).toBeNull()
    expect(dock().textContent).toContain('rules OK')
  })

  it('names the behavior whose tap-ms is below the msc period', async () => {
    const draft = fixtureDraft()
    draft.behaviors = draft.behaviors.map((b) =>
      b.name === 'rsr_hscroll' ? { ...b, props: b.props.filter((p) => p.name !== 'tap-ms') } : b,
    )
    await mount(draft)
    expect(dock().textContent).toContain('rules error')
    expect(dock().textContent).toContain('rsr_hscroll: tap-ms is unset (defaults to 5ms)')
    expect(tapMsInput('rsr_hscroll')?.value).toBe('5')
  })

  it('writes an edited tap-ms back to that behavior only, adding the prop when absent', async () => {
    const draft = fixtureDraft()
    draft.behaviors = draft.behaviors.map((b) =>
      b.name === 'rsr_hscroll' ? { ...b, props: b.props.filter((p) => p.name !== 'tap-ms') } : b,
    )
    await mount(draft)
    const input = tapMsInput('rsr_hscroll')!
    input.focus()
    input.value = '24'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextFrame()
    input.blur()
    await nextFrame()

    const tapMs = (name: string) =>
      editor.state.draft.behaviors
        .find((b) => b.name === name)!
        .props.find((p) => p.name === 'tap-ms')?.value
    expect(tapMs('rsr_hscroll')).toBe('<24>')
    expect(tapMs('rsr_scroll')).toBe('<20>')
    expect(tapMs('rsr_vol')).toBe('<20>')
    expect(dock().textContent).toContain('rules OK')
  })
})
