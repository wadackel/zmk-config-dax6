import { render } from 'hono/jsx/dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LayerData } from '../../../../../core/keymap-dt/types'
import { ArgumentControl } from '../argument-control'
import { BtSpecialForm } from '../bt-special-form'

let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  container.remove()
})

const dummyLayer = (name: string): LayerData => ({
  name,
  bindings: [],
  sensorBindings: null,
})

const eightLayers: LayerData[] = [
  'default_layer',
  'Symbol',
  'Num',
  'Function',
  'Mouse',
  'Scroll',
  'Device',
  'MacGesture',
].map(dummyLayer)

async function nextFrame() {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

describe('ArgumentControl — initial <select> value reflects passed value', () => {
  it('LayerSelect selects the current layer index (regression for hono/jsx select.value ordering)', async () => {
    render(
      <ArgumentControl
        argType="layer"
        value="3"
        onChange={() => {}}
        layers={eightLayers}
        isActive
        onFocus={() => {}}
        label="layer"
      />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')
    expect(select).not.toBeNull()
    expect(select!.value).toBe('3')
    expect(select!.selectedIndex).toBe(3)
    expect(select!.selectedOptions[0]?.textContent).toContain('Function')
  })

  it('LayerSelect falls back to "0" when value is empty', async () => {
    render(
      <ArgumentControl
        argType="layer"
        value=""
        onChange={() => {}}
        layers={eightLayers}
        isActive
        onFocus={() => {}}
        label="layer"
      />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')!
    expect(select.value).toBe('0')
  })

  it('NativeSelect (msc-action) selects a non-first option', async () => {
    render(
      <ArgumentControl
        argType="msc-action"
        value="SCRL_LEFT"
        onChange={() => {}}
        layers={[]}
        isActive
        onFocus={() => {}}
        label="action"
      />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')!
    expect(select.value).toBe('SCRL_LEFT')
  })

  it('NativeSelect (output) selects OUT_BLE', async () => {
    render(
      <ArgumentControl
        argType="output"
        value="OUT_BLE"
        onChange={() => {}}
        layers={[]}
        isActive
        onFocus={() => {}}
        label="output"
      />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')!
    expect(select.value).toBe('OUT_BLE')
  })

  it('NativeSelect falls back when value is not in options', async () => {
    render(
      <ArgumentControl
        argType="msc-action"
        value=""
        onChange={() => {}}
        layers={[]}
        isActive
        onFocus={() => {}}
        label="action"
      />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')!
    expect(select.value).toBe('SCRL_UP')
  })
})

describe('BtSpecialForm — initial <select> value reflects passed tokens', () => {
  it('selects BT_SEL_3 for &bt BT_SEL 3 (regression for select.value ordering)', async () => {
    render(
      <BtSpecialForm tokens={['&bt', 'BT_SEL', '3']} onChange={() => {}} />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')!
    expect(select.value).toBe('BT_SEL_3')
  })

  it('selects BT_NXT for &bt BT_NXT', async () => {
    render(
      <BtSpecialForm tokens={['&bt', 'BT_NXT']} onChange={() => {}} />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')!
    expect(select.value).toBe('BT_NXT')
  })

  it('selects BT_CLR for &bt BT_CLR', async () => {
    render(
      <BtSpecialForm tokens={['&bt', 'BT_CLR']} onChange={() => {}} />,
      container,
    )
    await nextFrame()
    const select = container.querySelector<HTMLSelectElement>('select')!
    expect(select.value).toBe('BT_CLR')
  })
})
