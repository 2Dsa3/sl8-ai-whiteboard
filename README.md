# Pizarra IA

**Plantea primero, luego te guío con pistas.**

Pizarra IA es una pizarra digital para celular y tablet donde el estudiante sube la foto de un ejercicio de Matemática o Física, **plantea su propio razonamiento con trazo a mano** y recién después recibe **pistas socráticas por niveles**. La solución completa es el último recurso, nunca lo primero.

Es el producto del proyecto **PoliAprende** (Emprendimiento e Innovación, ESPOL, Paralelo 4, PAO2 2026). Nace de **SL8.ai**, la pizarra con IA ganadora del hackathon Ecuador Tech Week 2025.

## El problema

Muchos estudiantes le piden la respuesta a la IA, la copian sin verificar y sacan buena nota en las tareas, pero no entienden el tema. Eso se nota en los exámenes presenciales.

## Cómo funciona

1. **📷 Ejercicio:** toma o sube la foto (o escribe o pega el enunciado).
2. **✍️ Planteamiento:** dibuja en la pizarra cómo lo empezarías, o escríbelo. Hasta que no lo hagas, la ayuda está bloqueada.
3. **🆘 Escalera de ayuda:** los niveles se habilitan en orden.

| Nivel | Botón | Qué hace |
|---|---|---|
| 1 | 🤔 Estoy atascado | Una pregunta guía para mirar el problema de otra forma |
| 2 | 💡 Necesito una pista | Una sola pista para avanzar un paso |
| 3 | 👣 Siguiente paso | Te dice qué hacer después, sin hacerlo por ti |
| 4 | ✅ Verificar mi solución | Revisa tu procedimiento y te dice dónde mirar |
| 5 | 📖 Mostrar solución | Se desbloquea tras usar 3 niveles. Es la solución explicada paso a paso |
| – | ❓ Aclarar el enunciado | Siempre disponible: datos e incógnita, sin resolver |

Otras funciones:

- **Sin conexión:** la app se puede abrir y usar para dibujar sin internet. Si pides ayuda sin señal, el pedido se envía solo cuando vuelve la conexión.
- **Vista docente (`/docente.html`):** muestra un resumen de cómo plantearon los estudiantes, con una miniatura de la pizarra y el nivel de pista al que llegaron. Las métricas se pueden exportar a CSV.
- **Privacidad:** las métricas se guardan solo en el `localStorage` del dispositivo. No se envían datos personales a ningún servidor.

## Métricas (evidencias S14)

Por cada ejercicio se registra:

- el tiempo desde que se abre el ejercicio hasta el primer trazo (meta: menos de 5 min);
- si el estudiante planteó antes de pedir ayuda, y cuántas veces intentó pedirla sin plantear;
- el nivel máximo de pista usado;
- si llegó a pedir la solución.

## Uso local

```bash
npm install
cp .env.example .env     # pon tu API key (ver CLAUDE.md, sección 4)
npm run dev              # http://localhost:3000
npm run build            # genera dist/
npm run lint
```

## Tecnología

- Frontend: HTML, JavaScript (ES modules) y Tailwind por CDN, sin framework.
- Backend: una función serverless de Vercel (`api/get-ai-response.js`) que traduce a Gemini, Groq, OpenRouter, Kimi o cualquier API compatible con OpenAI.
- Despliegue: ver [DEPLOYMENT.md](DEPLOYMENT.md).
