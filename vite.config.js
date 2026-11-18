import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// En desarrollo, Vite no ejecuta las funciones serverless de /api (eso lo hace Vercel).
// Este plugin monta /api/get-ai-response dentro del servidor de Vite para que
// `npm run dev` funcione completo con solo tener el archivo .env.
function localApi(env) {
  return {
    name: 'pizarra-ia-local-api',
    configureServer(server) {
      server.middlewares.use('/api/get-ai-response', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: 'Solo se aceptan solicitudes POST.' } }))
          return
        }

        let raw = ''
        for await (const chunk of req) raw += chunk

        const { generate, ProviderError } = await import(
          pathToFileURL(path.resolve(process.cwd(), 'api/_providers.js')).href
        )
        res.setHeader('Content-Type', 'application/json')
        try {
          const data = await generate(JSON.parse(raw || '{}'), { ...process.env, ...env })
          res.statusCode = 200
          res.end(JSON.stringify(data))
        } catch (error) {
          res.statusCode = error instanceof ProviderError ? error.status : 500
          console.error('[api local]', res.statusCode, error.message)
          res.end(JSON.stringify({ error: { message: error.message } }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' = carga todas las variables del .env de la raíz, no solo las VITE_*.
  // Nunca se exponen al navegador: solo las usa el middleware de arriba.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    root: 'SL8-AI (MVP)',
    envDir: process.cwd(),
    plugins: [localApi(env)],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: 'SL8-AI (MVP)/index.html'
        }
      }
    },
    server: {
      port: 3000,
      open: true
    },
    preview: {
      port: 4173,
      open: true
    }
  }
})
