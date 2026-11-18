import { defineConfig, loadEnv } from 'vite'
import fs from 'node:fs'
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

// El service worker (modo sin conexión) no lo importa ningún módulo, así que Vite no lo copia solo.
function copyServiceWorker() {
  return {
    name: 'pizarra-ia-copy-sw',
    apply: 'build',
    closeBundle() {
      fs.copyFileSync(path.resolve(process.cwd(), 'SL8-AI (MVP)/sw.js'), path.resolve(process.cwd(), 'dist/sw.js'))
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
    plugins: [localApi(env), copyServiceWorker()],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: 'SL8-AI (MVP)/index.html',
          docente: 'SL8-AI (MVP)/docente.html'
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
