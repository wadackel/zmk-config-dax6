// Excludes editor-only islands from production builds.
//
// The `/api/**` server endpoints are excluded via the HonoX `ROUTES` glob
// filter in `app/server.ts`. The `/` route is shared (editor in dev, tester
// in prod via a runtime `import.meta.env.DEV` branch in `routes/index.tsx`).
// Island modules (`keymap-editor.tsx` + the editor tabs + the picker
// subcomponents) are still picked up by HonoX's island registry, which would
// emit orphan JS chunks into `dist/static/` referencing dev-only code paths.
// We stub their source at transform time so they compile to
// `export default null`, then drop the emitted chunks via `generateBundle`
// so `dist/` contains no editor-related output.

import type { Plugin } from 'vite'

const DEV_ONLY_ISLAND_PATTERN = /app\/islands\/keymap-editor\.tsx$/
const DEV_ONLY_OUTPUT_STEMS = ['keymap-editor']

export function devOnlyRoutes(): Plugin {
  let isBuild = false
  return {
    name: 'dev-only-routes',
    config(_userConfig, env) {
      isBuild = env.command === 'build'
    },
    transform(_code, id) {
      if (isBuild && DEV_ONLY_ISLAND_PATTERN.test(id)) {
        return {
          code: 'export default function() { return null }\n',
          map: null,
        }
      }
      return null
    },
    generateBundle(_options, bundle) {
      if (!isBuild) return
      for (const fileName of Object.keys(bundle)) {
        const base = fileName.split('/').pop() ?? ''
        // Match `${stem}-*.js` (regular chunk) and `${stem}.test-*.js` (orphan
        // .tsx test files picked up by HonoX's island glob).
        if (
          DEV_ONLY_OUTPUT_STEMS.some(
            (stem) => base.startsWith(stem + '-') || base.startsWith(stem + '.test-'),
          )
        ) {
          delete bundle[fileName]
        }
      }
    },
  }
}
