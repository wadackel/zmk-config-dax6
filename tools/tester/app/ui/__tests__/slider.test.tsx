import { render } from 'hono/jsx/dom'
import { describe, expect, it } from 'vitest'
import { Slider } from '../slider'

describe('Slider', () => {
  it('renders a range input with correct aria attributes and initial value', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(
      <Slider value={20} min={1} max={36} onChange={() => {}} label="triggers-per-rotation" />,
      container,
    )
    await new Promise((r) => setTimeout(r, 0))
    const input = container.querySelector<HTMLInputElement>('input[type="range"]')
    expect(input).not.toBeNull()
    expect(input?.min).toBe('1')
    expect(input?.max).toBe('36')
    expect(input?.value).toBe('20')
    expect(input?.getAttribute('aria-valuenow')).toBe('20')
    expect(input?.getAttribute('aria-valuemin')).toBe('1')
    expect(input?.getAttribute('aria-valuemax')).toBe('36')
  })

  it('fires onChange with the parsed numeric value on input', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const seen: number[] = []
    render(
      <Slider value={10} min={0} max={100} onChange={(n) => seen.push(n)} />,
      container,
    )
    await new Promise((r) => setTimeout(r, 0))
    const input = container.querySelector<HTMLInputElement>('input[type="range"]')!
    input.value = '42'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(seen).toEqual([42])
  })

  it('renders the unit next to the numeric readout when provided', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(
      <Slider value={200} min={0} max={500} onChange={() => {}} label="tapping-term-ms" unit="ms" />,
      container,
    )
    await new Promise((r) => setTimeout(r, 0))
    // The unit text is inside a span next to the value.
    expect(container.textContent).toContain('200')
    expect(container.textContent).toContain('ms')
  })
})
