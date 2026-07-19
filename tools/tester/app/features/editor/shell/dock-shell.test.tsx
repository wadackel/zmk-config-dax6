import { render } from 'hono/jsx/dom'
import { describe, expect, it } from 'vitest'
import { DockShell } from './dock-shell'

describe('DockShell', () => {
  it('renders role=complementary with the aria-label', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(<DockShell ariaLabel="Layers dock">body</DockShell>, container)
    const section = container.querySelector<HTMLElement>('section[role="complementary"]')
    expect(section).not.toBeNull()
    expect(section?.getAttribute('aria-label')).toBe('Layers dock')
  })

  it('renders children inside a border-t section', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(
      <DockShell ariaLabel="Combos dock">
        <span data-slot="body">Name field</span>
      </DockShell>,
      container,
    )
    const section = container.querySelector<HTMLElement>('section[role="complementary"]')!
    expect(section.className).toContain('border-t')
    expect(section.className).toContain('bg-surface-1')
    expect(section.className).toContain('shadow-dock')
    expect(section.querySelector('[data-slot="body"]')?.textContent).toBe('Name field')
  })

  it('applies the flex chrome around the children row', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(<DockShell ariaLabel="Empty">body</DockShell>, container)
    const section = container.querySelector<HTMLElement>('section[role="complementary"]')!
    const row = section.querySelector<HTMLElement>('div.flex')
    expect(row).not.toBeNull()
    expect(row?.className).toContain('items-stretch')
    expect(row?.className).toContain('px-[24px]')
    expect(row?.className).toContain('py-[22px]')
  })
})
