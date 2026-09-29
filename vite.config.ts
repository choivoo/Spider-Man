import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/** Serves /api/* from the same handlers Vercel runs, so `npm run dev` behaves like production. */
function devApi(): Plugin {
  return {
    name: 'spider-ai-dev-api',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const name = req.url.slice(5).split('?')[0].replace(/[^a-z-]/gi, '')
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const raw = Buffer.concat(chunks).toString('utf8')
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : raw,
          })
          const response: Response = await mod.default(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          server.config.logger.error(String(e))
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'dev_api_error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, "src") } },
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
