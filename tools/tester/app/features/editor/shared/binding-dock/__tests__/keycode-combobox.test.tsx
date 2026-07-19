import { render } from 'hono/jsx/dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _resetRecentKeycodesForTests } from '../../../../../core/picker/recent-keycodes'
import { KeycodeCombobox } from '../keycode-combobox'

let container: HTMLDivElement

beforeEach(() => {
  _resetRecentKeycodesForTests()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  container.remove()
})

function pressKey(target: Element, key: string, opts: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts })
  target.dispatchEvent(event)
}

describe('KeycodeCombobox', () => {
  it('renders the text input with the current value', async () => {
    let captured = 'Q'
    render(
      <KeycodeCombobox
        value={captured}
        onChange={(v) => {
          captured = v
        }}
      />,
      container,
    )
    await Promise.resolve()
    const input = container.querySelector<HTMLInputElement>('input')
    expect(input).not.toBeNull()
    expect(input?.value).toBe('Q')
  })

  it('opens the listbox on focus and exposes role=option items', async () => {
    render(
      <KeycodeCombobox value="" onChange={() => {}} />,
      container,
    )
    await Promise.resolve()
    const input = container.querySelector<HTMLInputElement>('input')!
    input.focus()
    await new Promise((r) => setTimeout(r, 30))
    const options = container.querySelectorAll('[role="option"]')
    expect(options.length).toBeGreaterThan(10) // Common keycodes pinned
  })

  it('initial value is preserved when the listbox opens (no surprise reset)', async () => {
    let captured = 'Q'
    render(
      <KeycodeCombobox
        value={captured}
        onChange={(v) => {
          captured = v
        }}
      />,
      container,
    )
    await Promise.resolve()
    const input = container.querySelector<HTMLInputElement>('input')!
    input.focus()
    await new Promise((r) => setTimeout(r, 30))
    expect(input.value).toBe('Q')
    // First Common option should still be reachable from the original Common
    // ordering (A, B, C, ...). No keyboard-driven nav covered here — that path
    // is exercised end-to-end in the manual QA pass.
    const options = container.querySelectorAll<HTMLElement>('[role="option"]')
    expect(options.length).toBeGreaterThan(0)
  })
})
