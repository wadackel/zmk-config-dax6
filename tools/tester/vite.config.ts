import path from 'node:path'
import ssg from '@hono/vite-ssg'
import tailwindcss from '@tailwindcss/vite'
import honox from 'honox/vite'
import { defineConfig } from 'vite'
import { zmkLayout } from './codegen/vite-plugin'
import { devOnlyRoutes } from './vite-plugins/dev-only-routes'
import { repoRoot } from './vite-plugins/repo-root'

const entry = './app/server.ts'

const sharedResolve = {
  alias: {
    '@': path.resolve(__dirname, 'app'),
  },
}

export default defineConfig(({ mode }) => {
  const base = process.env.BASE_PATH || '/'

  if (mode === 'client') {
    return {
      base,
      resolve: sharedResolve,
      plugins: [
        repoRoot(),
        devOnlyRoutes(),
        zmkLayout(),
        honox({
          client: { input: ['/app/client.ts', '/app/style.css'] },
          // Prevent @hono/vite-dev-server from overriding Vite's base option
          devServer: { base: undefined },
        }),
        tailwindcss(),
      ],
    }
  }

  return {
    base,
    resolve: sharedResolve,
    build: { emptyOutDir: false },
    plugins: [
      repoRoot(),
      devOnlyRoutes(),
      zmkLayout(),
      honox({
        // Prevent @hono/vite-dev-server from overriding Vite's base option
        devServer: { base: undefined },
      }),
      tailwindcss(),
      ssg({ entry }),
    ],
  }
})
