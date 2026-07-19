import { createRoute } from 'honox/factory'
import KeyboardTester from '../islands/keyboard-tester'
import KeymapEditor from '../islands/keymap-editor'

// In dev mode `/` is the keymap editor (daily-use workflow). In production
// (`pnpm build` → GitHub Pages SSG) the editor is excluded — see
// `vite-plugins/dev-only-routes.ts` and `app/server.ts` — so `/` serves the
// tester instead. `import.meta.env.DEV` is statically replaced by Vite at
// build time, so the editor branch is dead-code-eliminated in production.
export default createRoute((c) => {
  if (import.meta.env.DEV) {
    // NavRail already renders the "← Tester" link at its foot; any header
    // here would duplicate that affordance and eat the vertical space the
    // left-rail + inspector layout needs to fill the viewport.
    return c.render(
      <div class="h-screen flex flex-col">
        <KeymapEditor />
      </div>,
    )
  }
  // Production (SSG for GitHub Pages) serves the tester at `/`. Match the
  // dev tester route's scroll wrapper — body is fixed at 100vh, so the
  // tester needs its own overflow-auto container to reach the event log
  // on shorter viewports.
  return c.render(
    <div class="h-screen overflow-auto">
      <KeyboardTester />
    </div>,
  )
})
