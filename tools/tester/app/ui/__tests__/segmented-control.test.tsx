import { render } from 'hono/jsx/dom'
import { describe, expect, it } from 'vitest'
import { SegmentedControl } from '../segmented-control'

type Flavor = 'balanced' | 'tap-preferred' | 'hold-preferred'

const options: { value: Flavor; label: string }[] = [
  { value: 'balanced', label: 'balanced' },
  { value: 'tap-preferred', label: 'tap-preferred' },
  { value: 'hold-preferred', label: 'hold-preferred' },
]

describe('SegmentedControl', () => {
  it('renders a radiogroup and marks the active option aria-checked=true', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(
      <SegmentedControl
        value={'balanced' as Flavor}
        options={options}
        onChange={() => {}}
        ariaLabel="flavor"
      />,
      container,
    )
    await new Promise((r) => setTimeout(r, 0))
    const group = container.querySelector<HTMLElement>('[role="radiogroup"]')
    expect(group?.getAttribute('aria-label')).toBe('flavor')
    const radios = container.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    expect(radios.length).toBe(3)
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    expect(radios[1].getAttribute('aria-checked')).toBe('false')
    expect(radios[2].getAttribute('aria-checked')).toBe('false')
  })

  it('calls onChange with the option value on click', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const seen: Flavor[] = []
    render(
      <SegmentedControl
        value={'balanced' as Flavor}
        options={options}
        onChange={(v) => seen.push(v)}
      />,
      container,
    )
    await new Promise((r) => setTimeout(r, 0))
    const radios = container.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    radios[1].click()
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toEqual(['tap-preferred'])
  })

  it('ArrowRight from the last active option wraps to the first', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const seen: Flavor[] = []
    render(
      <SegmentedControl
        value={'hold-preferred' as Flavor}
        options={options}
        onChange={(v) => seen.push(v)}
      />,
      container,
    )
    await new Promise((r) => setTimeout(r, 0))
    const radios = container.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    const last = radios[2]
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(seen).toEqual(['balanced'])
  })
})
