import { render } from 'hono/jsx/dom'
import { useState } from 'hono/jsx'
import { describe, expect, it } from 'vitest'
import { Toggle } from '../toggle'

describe('Toggle', () => {
  it('renders role=switch with aria-checked reflecting the checked prop', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<Toggle checked={true} onChange={() => {}} ariaLabel="Eager mode" />, container)
    const btn = container.querySelector<HTMLButtonElement>('button[role="switch"]')
    expect(btn).not.toBeNull()
    expect(btn?.getAttribute('aria-checked')).toBe('true')
    expect(btn?.getAttribute('aria-label')).toBe('Eager mode')

    render(<Toggle checked={false} onChange={() => {}} />, container)
    expect(
      container.querySelector<HTMLButtonElement>('button[role="switch"]')?.getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('calls onChange with the negated value when clicked', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    function Wrapper() {
      const [v, setV] = useState(false)
      return <Toggle checked={v} onChange={setV} />
    }
    render(<Wrapper />, container)
    // hono/jsx/dom flushes on microtask; give it a tick.
    await new Promise((r) => setTimeout(r, 0))

    const btn = container.querySelector<HTMLButtonElement>('button[role="switch"]')!
    expect(btn.getAttribute('aria-checked')).toBe('false')
    btn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(btn.getAttribute('aria-checked')).toBe('true')
    btn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(btn.getAttribute('aria-checked')).toBe('false')
  })

  it('marks disabled and suppresses click when disabled', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let called = 0
    render(<Toggle checked={false} onChange={() => called++} disabled />, container)
    await new Promise((r) => setTimeout(r, 0))
    const btn = container.querySelector<HTMLButtonElement>('button[role="switch"]')!
    expect(btn.disabled).toBe(true)
    // Even if clicked, the native disabled attribute suppresses the callback.
    btn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(called).toBe(0)
  })
})
