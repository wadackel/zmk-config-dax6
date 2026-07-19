import { render } from 'hono/jsx/dom'
import { describe, expect, it } from 'vitest'

describe('hono/jsx/dom smoke', () => {
  it('renders JSX into a DOM container', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const Item = ({ id }: { id: number }) => <div data-key={id}>cell {id}</div>
    render(
      <div data-root>
        {[0, 1, 2].map((id) => (
          <Item id={id} />
        ))}
      </div>,
      container,
    )

    expect(container.querySelectorAll('[data-key]').length).toBe(3)
    expect(container.querySelector('[data-root]')).not.toBeNull()
  })
})
