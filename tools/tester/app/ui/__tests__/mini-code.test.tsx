import { render } from 'hono/jsx/dom'
import { describe, expect, it } from 'vitest'
import { MiniCode } from '../mini-code'

describe('MiniCode', () => {
  it('renders inline chip variant as <code> by default', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(<MiniCode>&kp A</MiniCode>, container)
    await new Promise((r) => setTimeout(r, 0))
    const code = container.querySelector('code')
    expect(code).not.toBeNull()
    expect(code?.textContent).toBe('&kp A')
  })

  it('renders <pre> for dark multiline preview', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(
      <MiniCode dark multiline>
        {'arrow_macro: arrow_macro {\n  bindings = <&kp LEFT>;\n};'}
      </MiniCode>,
      container,
    )
    await new Promise((r) => setTimeout(r, 0))
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toContain('arrow_macro')
    expect(pre?.textContent).toContain('bindings')
  })
})
