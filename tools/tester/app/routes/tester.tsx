import { createRoute } from 'honox/factory'
import KeyboardTester from '../islands/keyboard-tester'

export default createRoute((c) => {
  // Body is `h-screen overflow-hidden` (see routes/_renderer.tsx) so the
  // editor pane can never leak a page-level scrollbar. Tester content
  // (encoder row + 46 keys + event log) can exceed the viewport on shorter
  // screens; wrap the route in an internal scroll container to preserve
  // access to the full log.
  //
  // Cross-mode navigation lives in the icon rail rendered by
  // {@link KeyboardTester}; no dev-only "Back to editor" banner is
  // needed because the rail's editor tab items already link to `/`.
  return c.render(
    <div class="h-screen overflow-hidden">
      <KeyboardTester />
    </div>,
  )
})
