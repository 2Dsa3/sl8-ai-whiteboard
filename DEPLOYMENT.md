# Despliegue de Pizarra IA

## Vercel (recomendado)

Vercel es la única opción que ejecuta la función `/api/get-ai-response`. Sin ella, la IA no funciona.

1. Importa el repositorio en [vercel.com](https://vercel.com) (*Add New → Project*).
2. No hace falta configurar el build: `vercel.json` ya publica la carpeta `SL8-AI (MVP)/` como sitio estático y `api/get-ai-response.js` como función.
3. En *Settings → Environment Variables* agrega las variables del proveedor que vas a usar:

| Variable | Uso |
|---|---|
| `AI_PROVIDER` | `gemini` (por defecto), `groq`, `openrouter`, `kimi` o `custom` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `MOONSHOT_API_KEY` | La key del proveedor elegido |
| `AI_MODEL` | Opcional. Cambia el modelo por defecto del preset |
| `AI_FALLBACK_MODELS` | Opcional. Modelos de respaldo, separados por coma, si el principal está saturado |
| `AI_TIMEOUT_MS` | Opcional. Tiempo máximo por intento (por defecto 20000 ms) |
| `AI_BASE_URL`, `AI_API_KEY` | Solo para `custom` (cualquier API compatible con OpenAI) |

4. Vuelve a desplegar (*Deployments → Redeploy*) para que tome las variables.
5. Prueba: abre la URL, sube un ejercicio, dibuja algo y pide "Estoy atascado".

Notas:

- El modelo tiene que **aceptar imágenes**, porque se mandan la pizarra y la foto del ejercicio.
- Si Gemini responde "high demand" (503), la app pasa sola a los modelos de respaldo. Si pasa muy seguido, usa como `AI_MODEL` uno de los respaldos (por ejemplo `gemini-3.5-flash-lite`).
- Los nombres de los modelos cambian seguido. Si aparece un error tipo "model … is no longer available", cambia `AI_MODEL` en Vercel y no el código.
- Nunca pongas API keys en el frontend ni subas `.env` al repositorio.

## Desarrollo local

```bash
npm install
cp .env.example .env     # completa la key del proveedor
npm run dev              # http://localhost:3000
```

`vite.config.js` monta `/api/get-ai-response` dentro del servidor de desarrollo, así que la IA funciona en local solo con el `.env`. El service worker (modo sin conexión) no se registra en `npm run dev` para no interferir con la recarga en caliente. Para probarlo, usa `npm run build && npm run preview`.

## GitHub Pages

`.github/workflows/deploy.yml` publica `SL8-AI (MVP)/` en cada push a `main`. Es **solo HTML estático: ahí la IA no funciona**. Sirve únicamente para mostrar la UI.

## Archivos que publica el frontend

- `index.html` es la pizarra.
- `docente.html` es la vista docente con las métricas del dispositivo.
- `sw.js` es el service worker del modo sin conexión. Tiene que quedar en la misma carpeta que `index.html`. En `npm run build`, Vite lo copia a `dist/`.
