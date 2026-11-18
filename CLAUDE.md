# CLAUDE.md – Pizarra IA (repo `sl8-ai-whiteboard`)

Guía para trabajar en este repositorio con Claude Code. Léela completa antes de cambiar código.

## 1. Qué es el proyecto

Este repo empezó como **SL8.ai**, una pizarra con IA para pensamiento algorítmico que ganó el hackathon Ecuador Tech Week 2025. Ahora es la base de **Pizarra IA**, el producto del proyecto **PoliAprende**. El proyecto es de la materia Emprendimiento e Innovación de ESPOL (Paralelo 4, PAO2 2026).

- **Problema:** los estudiantes le piden la respuesta a la IA, la copian sin verificar y sacan buena nota en las tareas, pero no entienden el tema. Eso se nota en los exámenes presenciales.
- **Solución:** una pizarra digital para celular o tablet. El estudiante sube la foto del ejercicio y **primero plantea su propio razonamiento con trazo a mano**. Recién después recibe **pistas socráticas por niveles**. Nunca recibe la respuesta directa al inicio.
- **Usuarios:**
  - Principal: estudiantes de 2.º y 3.º de bachillerato y universitarios de Guayaquil, en Matemática, Física y otras materias STEM.
  - Secundario: el docente, que puede ver cómo planteó el alumno y hasta qué nivel de pista llegó.
- **Nombre oficial:** "Pizarra IA", con espacio. En la UI y en los textos nuevos usar ese nombre, no "SL8", "TutorIA" ni "PizarraIA".

### Principios de producto (no romperlos)
1. **Plantea primero:** la ayuda de la IA no se habilita hasta que el estudiante haya escrito o dibujado su propio planteamiento.
2. **Pistas por niveles:** la ayuda escala de una pregunta guía, a una pista, a un siguiente paso, a la verificación y, al final, a la solución. La solución completa es el último recurso.
3. **Nunca dar la respuesta de entrada.** Los prompts deben guiar con preguntas, no resolver.
4. **Todo en español**, con un tono cercano y no condescendiente.
5. **Mobile/tablet first:** se tiene que poder usar con el dedo o con un lápiz óptico (pointer events).

## 2. Estructura

```
SL8-AI (MVP)/         Frontend estático (la app real)
  index.html          UI con Tailwind por CDN, menú de ayuda (help-1 … help-6), panel de respuesta
  main.js             Clase TutorIA: prompts, bloqueo de contenido, tokens, llamadas a /api
  draw.js             Clase Whiteboard: canvas, pointer events, deshacer/rehacer, getCanvasImageData()
  styles.css
api/
  get-ai-response.js  Endpoint serverless (Vercel), el ÚNICO punto de contacto con la IA
  _providers.js       Traductor a cada proveedor de IA (Gemini, Groq, OpenRouter, Kimi, custom)
prompting/            Notas y casos de prueba de prompts (de la etapa SL8)
analytics.js, experiments.js, feedback-collector.js, golden-dataset.js, dashboard.*
                      Infraestructura de métricas. Hoy está DESACTIVADA (comentada en main.js)
reports/, scripts/    Reportes de ESLint (entregable de Ingeniería de Software II)
vite.config.js        Dev server; incluye un middleware que sirve /api localmente
vercel.json           Despliega el frontend estático y la función /api
```

Hay archivos sueltos de una etapa anterior que no se usan: `tmp_*.txt`, `patch_snippet.txt`, `cur_updateRecentInteractions.txt`, y `CODE_REVIEW.md` y `FEATURE_SUMMARY.md`, que están vacíos. Se pueden borrar si el equipo está de acuerdo.

## 3. Comandos

```bash
npm install
cp .env.example .env     # y poner la API key (ver sección 4)
npm run dev              # http://localhost:3000, la IA funciona gracias al middleware de vite.config.js
npm run build            # genera dist/
npm run lint             # ESLint (plugins security y sonarjs)
```

No hay tests automáticos todavía. Para probar un cambio, levanta `npm run dev`, escribe o pega un ejercicio, dibuja algo y usa los botones de ayuda.

## 4. IA: cómo funciona y cómo cambiar de proveedor

**Contrato fijo:**
- El frontend siempre manda a `POST /api/get-ai-response` un cuerpo en **formato Gemini**: `{ contents:[{ parts:[{text}, {inline_data:{mime_type, data}}] }], generationConfig }`.
- Siempre recibe `{ candidates:[{ content:{ parts:[{ text }] } }] }`.
- Los errores llegan como `{ error:{ message } }`, con un mensaje en español que se muestra tal cual.
- `api/_providers.js` traduce ese formato al proveedor elegido. **No cambies el formato en el frontend.** Si agregas un proveedor, hazlo en `PRESETS` dentro de `_providers.js`.

**Variables de entorno** (`.env` en local; en Vercel van en *Settings → Environment Variables*):

| Variable | Uso |
|---|---|
| `AI_PROVIDER` | `gemini` (por defecto), `groq`, `openrouter`, `kimi` o `custom` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `MOONSHOT_API_KEY` | La key del proveedor elegido |
| `AI_MODEL` | Opcional, cambia el modelo por defecto del preset |
| `AI_FALLBACK_MODELS` | Modelos de respaldo si Gemini está saturado (por defecto `gemini-2.5-flash,gemini-2.5-flash-lite`; vacío = sin respaldo) |
| `AI_BASE_URL`, `AI_API_KEY` | Para `custom`, que acepta cualquier API compatible con OpenAI |

**Modelos por defecto:**

| Preset | Modelo |
|---|---|
| gemini | `gemini-2.5-flash` |
| groq | `meta-llama/llama-4-maverick-17b-128e-instruct` |
| openrouter | `google/gemma-3-27b-it:free` |
| kimi | `kimi-latest` |

Los nombres de modelos gratuitos cambian seguido. Si uno deja de existir, cambia `AI_MODEL` y no el código.

**Importante:**
- La app manda **imágenes**: la pizarra y la foto del ejercicio. El modelo elegido debe aceptar imágenes. Gemini es la opción recomendada.
- Con `gemini-2.5-flash` se desactiva el razonamiento interno (`thinkingBudget: 0`). Si no, se come los tokens de las pistas cortas y la respuesta llega vacía.
- **Nunca** poner API keys en el frontend ni subir `.env`; ya está en `.gitignore`.

## 5. Despliegue

- **Vercel (recomendado):** es el único que ejecuta `/api`. `vercel.json` ya incluye la función. Hay que configurar las variables de entorno y redeplegar.
- **GitHub Pages** (`.github/workflows/deploy.yml`): solo publica el HTML estático, así que **la IA no funciona ahí**. Sirve únicamente para mostrar la UI.

## 6. Convenciones de código

- JavaScript ES modules, sin framework. Tailwind por CDN en `index.html`.
- Textos de UI y prompts en español. Comentarios en español.
- Cambios chicos y enfocados. Antes de terminar, corre `npm run lint` y no dejes errores nuevos.
- `main.js` es grande (~1400 líneas). Si agregas una funcionalidad nueva, preferir un archivo aparte en `SL8-AI (MVP)/` e importarlo, en vez de seguir creciendo `main.js`.
- No reactivar la infraestructura de analytics vieja sin revisarla. Para métricas nuevas, ver la tarea 6 de abajo.
- Commits en español, descriptivos. Trabajar en ramas y abrir PR hacia `main`.

## 7. Backlog: lo que falta para que el repo refleje Pizarra IA

Está en orden de prioridad y sale del prototipo, del storyboard y del feedback del profesor del Sprint 2.

1. **Rebranding:** cambiar "SL8 - AI" y "TutorIA" por "Pizarra IA" en `<title>`, encabezados, textos y prompts. Actualizar el README.
2. **Prompts para Matemática y Física:** hoy los prompts de `tutorPrompts` en `main.js` hablan de programación y algoritmos. Hay que reescribirlos para ejercicios de bachillerato y universidad (álgebra, cálculo, física), manteniendo el estilo socrático. Los modos `stuck`, `hint`, `clarify`, `next_step`, `verify` y `solution` se mantienen.
3. **"Plantea primero" real:** hoy solo se bloquea hasta que hay un ejercicio. Falta exigir además un planteamiento propio antes de habilitar `help-1…help-6`, ya sea un trazo en la pizarra (`!whiteboard.isEmpty()`) o un texto mínimo. Mostrar un mensaje claro de por qué está bloqueado.
4. **Escalera de ayuda:** habilitar los niveles en orden. La "Solución" (help-6) solo se desbloquea después de haber usado al menos 2 o 3 niveles previos en ese ejercicio. Mostrar el nivel actual.
5. **Flujo con foto del ejercicio en el celular:** que subir o tomar la foto sea el primer paso visible (`<input type="file" accept="image/*" capture="environment">`). Hoy solo se puede pegar.
6. **Métricas para validar la propuesta de valor:** guardarlas en `localStorage`, con opción de exportar a CSV:
   - tiempo desde que se abre el ejercicio hasta el primer trazo (meta: menos de 5 min);
   - si el estudiante planteó antes de pedir ayuda (meta: reducir el "copiar y pegar" en un 65 %);
   - nivel máximo de pista usado por ejercicio;
   - si llegó a pedir la solución.
   Estas son las evidencias de la actividad S14. No mandar datos personales a ningún servidor.
7. **Vista docente (simple):** una pantalla de resumen que lea esas métricas y el historial de un dispositivo, para la demo del piloto.
8. **Modo sin conexión:** que se pueda seguir dibujando sin internet y que la ayuda se pueda pedir al volver la señal.
9. **Limpieza:** borrar los archivos temporales de la sección 2, actualizar `DEPLOYMENT.md` con el flujo de Vercel y las variables de la sección 4.

Cuando termines una tarea del backlog, márcala aquí con ✅ y una línea sobre qué se hizo.
