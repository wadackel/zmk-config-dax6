import type { JSX } from 'hono/jsx'
import type { EditorTab } from '../../../core/editor-state/types'
import type { LayersIcon } from '../../../ui/nav-icons'

/**
 * Icon-component reference (not a JSX element). Storing `<LayersIcon />`
 * VNodes in a module-level array meant the same VNode instance was
 * shared across every render — hono/jsx caches `e` (DOM node) on the
 * VNode itself, so a second mount would try to reuse an already-detached
 * subtree and quietly fail on real Blink/WebKit. Instantiating the
 * component at render time avoids that stale-DOM-ref pitfall.
 *
 * The type is anchored to `typeof LayersIcon` (any of the seven nav-
 * icon exports would work identically) so we get the JSX-callable
 * signature TypeScript verifies for `<Icon />` without depending on the
 * `JSX.Element` alias, which hono/jsx does not re-export from its
 * `JSX` namespace.
 */
export type NavRailIcon = typeof LayersIcon

/**
 * Discriminated union so `{ id: 'tester', kind: 'editor-tab' }` and
 * `{ id: 'layers', kind: 'tester' }` are compile errors — the two
 * kinds ship different link semantics and callers should not mix them.
 */
export type NavRailItem =
  | {
      id: EditorTab
      kind: 'editor-tab'
      /** Compact monospace label (max ~7 chars) shown under the icon. */
      label: string
      /** Icon component — the caller passes `LayersIcon` etc., never
       *  `<LayersIcon />`. See {@link NavRailIcon}. */
      Icon: NavRailIcon
      /**
       * When present, clicking the item navigates to this href. Used
       * from the tester page to hop back into the editor at `/`.
       */
      href?: string
    }
  | {
      id: 'tester'
      kind: 'tester'
      label: string
      Icon: NavRailIcon
      href?: string
    }

export type NavRailProps = {
  items: NavRailItem[]
  /** Currently selected tab id (or `'tester'` when rendered on the tester page). */
  activeId: EditorTab | 'tester'
  /**
   * Fires when an editor tab is picked (kind === 'editor-tab' and no
   * href navigation). The shell dispatches `SET_ACTIVE_TAB`.
   */
  onSelect?: (tab: EditorTab) => void
  /**
   * Set true from the tester page to gate editor tabs on production
   * builds. In dev the editor lives at `/` so editor tabs are
   * clickable links; in prod SSG the editor is dead code so they must
   * be disabled to prevent 404s.
   */
  isTesterPage?: boolean
  /** Rail-level keydown for ArrowUp/Down/Home/End on the editor tabs. */
  onKeyDown?: JSX.IntrinsicElements['aside']['onKeyDown']
}

type EditorTabItem = Extract<NavRailItem, { kind: 'editor-tab' }>

/**
 * 62px icon rail shared by the editor and the tester. The top slot is
 * an "zmk" ink monogram; below that sit the six editor tabs; the bottom
 * slot is the Tester entry. Every item is a fixed-size icon + tiny
 * monospace label — the layout mirrors the design HTMLs from the
 * DesignSync project.
 *
 * Semantics for the editor page: the rail is a vertical `tablist`
 * populated by the six editor tabs; the Tester entry sits after the
 * list as a plain link so it does not compete with tab-cycling
 * shortcuts.
 *
 * Semantics for the tester page: the rail is *not* a tablist (there is
 * no tabpanel on that page); every item is a plain link, and on
 * production the six editor entries render as `<button disabled>` so
 * their inactive state is announced to assistive tech and the tester
 * page stays reachable when the editor is not built.
 */
export function NavRail({
  items,
  activeId,
  onSelect,
  isTesterPage = false,
  onKeyDown,
}: NavRailProps) {
  const editorTabs = items.filter(
    (i): i is EditorTabItem => i.kind === 'editor-tab',
  )
  const testerItem = items.find((i) => i.kind === 'tester')
  const editorTabsDisabled = isTesterPage && !import.meta.env.DEV

  return (
    <aside
      class="w-[62px] flex-none bg-surface-2 border-r border-border-subtle flex flex-col items-center py-4 gap-1"
      aria-label="Keymap Editor sections"
      onKeyDown={onKeyDown}
    >
      <span
        class="mb-3 w-8 h-8 rounded-input bg-ink text-ink-fg flex items-center justify-center font-mono font-bold text-[9.5px] tracking-tight leading-none"
        aria-hidden="true"
      >
        zmk
      </span>

      <div
        role={isTesterPage ? undefined : 'tablist'}
        aria-orientation={isTesterPage ? undefined : 'vertical'}
        class="flex flex-col gap-1 items-center"
      >
        {editorTabs.map((t) => {
          const isActive = t.id === activeId
          const commonClasses = [
            'w-[42px] h-10 rounded-input flex flex-col items-center justify-center gap-[3px] transition-colors',
            isActive
              ? 'bg-ink text-ink-fg font-semibold'
              : editorTabsDisabled
                ? 'text-fg-subtler'
                : 'text-fg-subtle hover:text-fg hover:bg-surface-3',
          ].join(' ')
          const labelClass = [
            'font-mono text-[8px] leading-none',
            isActive ? 'font-semibold text-ink-fg' : 'font-medium',
          ].join(' ')
          const Icon = t.Icon
          const glyph = (
            <>
              <span class="w-[17px] h-[17px] flex items-center justify-center">
                <Icon />
              </span>
              <span class={labelClass}>{t.label}</span>
            </>
          )

          if (isTesterPage && editorTabsDisabled) {
            // Render as a real `<button disabled>` so the accessibility
            // tree announces "button, dimmed / unavailable" instead of a
            // `<span>` which has no interactive role.
            return (
              <button
                key={t.id}
                type="button"
                disabled
                aria-label={`${t.label} (available in the dev-mode editor only)`}
                class={`${commonClasses} opacity-70 cursor-not-allowed`}
              >
                {glyph}
              </button>
            )
          }
          if (isTesterPage && t.href) {
            return (
              <a key={t.id} href={t.href} title={t.label} class={commonClasses}>
                {glyph}
              </a>
            )
          }
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              data-editor-tab={t.id}
              aria-selected={isActive ? 'true' : 'false'}
              // Only the active tab has a rendered tabpanel — pointing
              // inactive tabs at a nonexistent id creates a dangling
              // aria-controls reference, so skip the attr entirely then.
              aria-controls={isActive ? `tabpanel-${t.id}` : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect?.(t.id)}
              class={commonClasses}
            >
              {glyph}
            </button>
          )
        })}
      </div>

      {testerItem && (
        <div class="mt-auto pt-3 border-t border-border-subtle flex flex-col items-center">
          {(() => {
            const isActive = testerItem.id === activeId
            const commonClasses = [
              'w-[42px] h-10 rounded-input flex flex-col items-center justify-center gap-[3px] transition-colors',
              isActive
                ? 'bg-ink text-ink-fg font-semibold'
                : 'text-fg-subtle hover:text-fg hover:bg-surface-3',
            ].join(' ')
            const TesterIcon = testerItem.Icon
            const glyph = (
              <>
                <span class="w-[17px] h-[17px] flex items-center justify-center">
                  <TesterIcon />
                </span>
                <span
                  class={[
                    'font-mono text-[8px] leading-none',
                    isActive ? 'font-semibold text-ink-fg' : 'font-medium',
                  ].join(' ')}
                >
                  {testerItem.label}
                </span>
              </>
            )
            if (testerItem.href && !isActive) {
              return (
                <a href={testerItem.href} class={commonClasses} title="Keyboard tester">
                  {glyph}
                </a>
              )
            }
            return <span class={commonClasses}>{glyph}</span>
          })()}
        </div>
      )}
    </aside>
  )
}
