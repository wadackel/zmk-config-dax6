import type { Child } from 'hono/jsx'

export type DockShellProps = {
  ariaLabel: string
  children: Child
}

/**
 * Shared bottom-dock chrome. Full-width `border-t` section that anchors
 * to the bottom of each tab's main column and hosts the selection-
 * scoped editor (binding row for Layers, name/binding/positions for
 * Combos, step editor for Macros, tuning fields for Sensors, direction
 * props for Mouse Gestures, add-property search for Behaviors).
 *
 * The internal layout (identity / center / actions arrangement) is
 * owned by each individual dock component (BindingDock, ComboDock,
 * etc.) because their slot structures diverge — e.g. Behaviors' add-
 * property dock has no "identity" the way Layers' key-binding dock
 * does. Keeping the chrome minimal (just the border-t + shadow + aria
 * role) avoids paying for slot props that would go unused four
 * callers out of six.
 *
 * Semantics: `role="complementary"` — a supplemental panel that edits
 * the currently-selected element of the main content, not part of the
 * tabpanel's flow. Assistive tech announces it consistently across
 * every tab.
 *
 * `--shadow-dock` provides the subtle upward halo so the dock reads as
 * an overlay of the surface beneath the board / list, matching the
 * design's inverted `shadow-panel`.
 */
export function DockShell({ ariaLabel, children }: DockShellProps) {
  return (
    <section
      role="complementary"
      aria-label={ariaLabel}
      class="flex-none border-t border-border-subtle bg-surface-1 shadow-dock"
    >
      <div class="flex items-stretch gap-0 px-[24px] py-[22px]">{children}</div>
    </section>
  )
}
