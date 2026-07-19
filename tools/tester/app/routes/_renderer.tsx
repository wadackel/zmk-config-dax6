import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, Script } from 'honox/server'
import { getBoard } from '../boards/active'

export default jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{getBoard().branding.title}</title>
        <Link href="/app/style.css" rel="stylesheet" />
        <Script src="/app/client.ts" async />
      </head>
      <body class="bg-surface-0 text-fg h-screen overflow-hidden">
        {children}
      </body>
    </html>
  )
})
