import { createApp } from 'honox/server'

type HonoxRoutes = NonNullable<Parameters<typeof createApp>[0]>['ROUTES']

// In production builds (`pnpm build`), exclude the dev-only `/api/**` server
// endpoints. The deployed GitHub Pages bundle is static and has no Node
// runtime to back these endpoints. The `/` route is shared (editor in dev,
// tester in prod via `import.meta.env.DEV` branching inside the route file).
const isProd = !import.meta.env.DEV

const ROUTES = isProd
  ? import.meta.glob(
      [
        '/app/routes/**/*.{ts,tsx,md,mdx}',
        '/app/routes/.well-known/**/*.{ts,tsx,md,mdx}',
        '!/app/routes/**/_*.{ts,tsx,md,mdx}',
        '!/app/routes/**/-*.{ts,tsx,md,mdx}',
        '!/app/routes/**/$*.{ts,tsx,md,mdx}',
        '!/app/routes/**/*.test.{ts,tsx}',
        '!/app/routes/**/*.spec.{ts,tsx}',
        '!/app/routes/**/-*/**/*',
        '!/app/routes/api/**/*',
      ],
      { eager: true },
    )
  : import.meta.glob(
      [
        '/app/routes/**/*.{ts,tsx,md,mdx}',
        '/app/routes/.well-known/**/*.{ts,tsx,md,mdx}',
        '!/app/routes/**/_*.{ts,tsx,md,mdx}',
        '!/app/routes/**/-*.{ts,tsx,md,mdx}',
        '!/app/routes/**/$*.{ts,tsx,md,mdx}',
        '!/app/routes/**/*.test.{ts,tsx}',
        '!/app/routes/**/*.spec.{ts,tsx}',
        '!/app/routes/**/-*/**/*',
      ],
      { eager: true },
    )

const app = createApp({ ROUTES: ROUTES as HonoxRoutes })

export default app
