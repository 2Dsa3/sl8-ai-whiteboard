// Capa de proveedores de IA para Pizarra IA.
//
// El frontend siempre manda el cuerpo en formato Gemini
// ({ contents: [{ parts: [...] }], generationConfig }) y siempre espera
// la respuesta en formato Gemini ({ candidates: [{ content: { parts: [{ text }] } }] }).
// Este módulo traduce ese formato al proveedor elegido con AI_PROVIDER
// y normaliza la respuesta, así el frontend no cambia al cambiar de API.
//
// Archivos que empiezan con "_" dentro de /api no se publican como endpoint en Vercel.

const PRESETS = {
  gemini: {
    type: 'gemini',
    keyEnv: ['GEMINI_API_KEY'],
    model: 'gemini-2.5-flash',
    // Si el modelo principal está saturado (503), sin cuota (429) o retirado (404),
    // se prueban estos en orden. Se cambian con AI_FALLBACK_MODELS, sin tocar el código.
    fallbacks: ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'],
  },
  groq: {
    type: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: ['GROQ_API_KEY'],
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
  },
  openrouter: {
    type: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: ['OPENROUTER_API_KEY'],
    model: 'google/gemma-3-27b-it:free',
  },
  kimi: {
    type: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    keyEnv: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    model: 'kimi-latest',
  },
  // Cualquier otra API compatible con OpenAI (Mistral, GitHub Models, Ollama local, etc.)
  custom: {
    type: 'openai',
    baseUrl: '',
    keyEnv: [],
    model: '',
  },
};

// Tiempo máximo por intento y para el pedido completo (todos los modelos de respaldo).
const DEFAULT_ATTEMPT_TIMEOUT_MS = 20000;
const DEFAULT_TOTAL_TIMEOUT_MS = 50000;

// Un modelo que falló se salta durante este tiempo, para no esperar su timeout en cada pedido.
// (Vive en memoria: dura mientras la función de Vercel o el servidor de Vite sigan activos.)
const COOLDOWN_MS = 2 * 60 * 1000;
const cooldownUntil = new Map();

// Errores que justifican probar con el siguiente modelo de la lista.
const RETRYABLE_STATUS = new Set([404, 408, 429, 500, 502, 503, 504]);

export class ProviderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function resolveConfig(env = process.env) {
  const name = (env.AI_PROVIDER || 'gemini').toLowerCase().trim();
  const preset = Object.hasOwn(PRESETS, name) ? PRESETS[name] : null; // eslint-disable-line security/detect-object-injection
  if (!preset) {
    throw new ProviderError(500, `AI_PROVIDER "${name}" no existe. Usa: ${Object.keys(PRESETS).join(', ')}.`);
  }

  const apiKey = env.AI_API_KEY || preset.keyEnv.map((k) => env[k]).find(Boolean) || ''; // eslint-disable-line security/detect-object-injection
  let baseUrl = env.AI_BASE_URL || preset.baseUrl || '';
  while (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  const model = env.AI_MODEL || preset.model;
  const fallbackList = env.AI_FALLBACK_MODELS !== undefined
    ? env.AI_FALLBACK_MODELS.split(',')
    : preset.fallbacks || [];
  const models = [...new Set([model, ...fallbackList].map((m) => (m || '').trim()).filter(Boolean))];
  const attemptTimeoutMs = Number(env.AI_TIMEOUT_MS) || DEFAULT_ATTEMPT_TIMEOUT_MS;

  if (!apiKey && !(preset.type === 'openai' && baseUrl.includes('localhost'))) {
    const vars = ['AI_API_KEY', ...preset.keyEnv].join(' o ');
    throw new ProviderError(500, `Falta la API key de ${name}. Configura ${vars} en .env (local) o en Vercel.`);
  }
  if (preset.type === 'openai' && !baseUrl) {
    throw new ProviderError(500, 'Con AI_PROVIDER=custom debes configurar AI_BASE_URL.');
  }
  if (!model) {
    throw new ProviderError(500, 'Configura AI_MODEL con el modelo que quieres usar.');
  }

  return { name, type: preset.type, apiKey, baseUrl, model, models, attemptTimeoutMs };
}

function toGeminiShape(text) {
  return { candidates: [{ content: { role: 'model', parts: [{ text }] } }] };
}

// fetch con límite de tiempo: si el proveedor se cuelga, se corta y se pasa al siguiente modelo.
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ProviderError(504, `La IA tardó más de ${Math.round(timeoutMs / 1000)} s en responder.`);
    }
    throw new ProviderError(502, `No se pudo conectar con el proveedor de IA (${error.message}).`);
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res) {
  const raw = await res.text();
  try {
    const data = JSON.parse(raw);
    return data?.error?.message || data?.message || raw;
  } catch {
    return raw || res.statusText;
  }
}

// ---------- Gemini ----------

async function callGemini(body, cfg, timeoutMs) {
  const generationConfig = { ...(body.generationConfig || {}) };

  // Los modelos 2.5 "piensan" y ese razonamiento consume maxOutputTokens.
  // Con límites cortos (pistas de 400 tokens) la respuesta puede llegar vacía,
  // así que se apaga el razonamiento salvo que se pida explícitamente.
  if (/2\.5-flash/.test(cfg.model) && !generationConfig.thinkingConfig) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
    body: JSON.stringify({ ...body, generationConfig }),
  }, timeoutMs);

  if (!res.ok) throw new ProviderError(res.status, await readError(res));

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'sin texto';
    throw new ProviderError(502, `La IA no devolvió texto (${reason}).`);
  }
  return toGeminiShape(text);
}

// ---------- APIs compatibles con OpenAI (Groq, OpenRouter, Kimi, custom) ----------

function geminiToOpenAIMessages(body) {
  const messages = [];

  const sys = body.systemInstruction || body.system_instruction;
  if (sys?.parts?.length) {
    messages.push({ role: 'system', content: sys.parts.map((p) => p.text || '').join('\n') });
  }

  for (const turn of body.contents || []) {
    const content = [];
    for (const part of turn.parts || []) {
      if (part.text) {
        content.push({ type: 'text', text: part.text });
        continue;
      }
      const img = part.inline_data || part.inlineData;
      if (img?.data) {
        const mime = img.mime_type || img.mimeType || 'image/png';
        content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${img.data}` } });
      }
    }
    if (!content.length) continue;

    const role = turn.role === 'model' ? 'assistant' : 'user';
    const onlyText = content.every((c) => c.type === 'text');
    messages.push({ role, content: onlyText ? content.map((c) => c.text).join('\n') : content });
  }
  return messages;
}

async function callOpenAICompatible(body, cfg, timeoutMs) {
  const gc = body.generationConfig || {};
  const payload = {
    model: cfg.model,
    messages: geminiToOpenAIMessages(body),
    temperature: gc.temperature ?? 0.7,
    top_p: gc.topP ?? 0.95,
    max_tokens: gc.maxOutputTokens ?? 1024,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.name === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'https://github.com/matheoglg/sl8-ai-whiteboard';
    headers['X-Title'] = 'Pizarra IA';
  }

  const res = await fetchWithTimeout(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }, timeoutMs);

  if (!res.ok) {
    let message = await readError(res);
    const hasImage = payload.messages.some((m) => Array.isArray(m.content));
    if (hasImage && res.status === 400) {
      message += ` (¿el modelo "${cfg.model}" acepta imágenes? Prueba otro AI_MODEL con visión.)`;
    }
    throw new ProviderError(res.status, message);
  }

  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new ProviderError(502, 'La IA no devolvió texto.');
  return toGeminiShape(text);
}

export async function generate(body, env = process.env) {
  if (!body || !Array.isArray(body.contents) || body.contents.length === 0) {
    throw new ProviderError(400, 'El cuerpo debe traer "contents" en formato Gemini.');
  }
  const cfg = resolveConfig(env);
  const call = cfg.type === 'gemini' ? callGemini : callOpenAICompatible;
  const totalTimeoutMs = Number(env.AI_TOTAL_TIMEOUT_MS) || DEFAULT_TOTAL_TIMEOUT_MS;
  const deadline = Date.now() + totalTimeoutMs;

  // Primero los modelos sanos; los que están en pausa quedan al final, por si los demás también fallan.
  const now = Date.now();
  const isCooling = (m) => (cooldownUntil.get(m) || 0) > now;
  const ordered = [...cfg.models.filter((m) => !isCooling(m)), ...cfg.models.filter(isCooling)];

  let lastError = null;
  for (const model of ordered) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    try {
      const result = await call(body, { ...cfg, model }, Math.min(cfg.attemptTimeoutMs, remaining));
      cooldownUntil.delete(model);
      return result;
    } catch (error) {
      const retryable = error instanceof ProviderError && RETRYABLE_STATUS.has(error.status);
      if (!retryable) throw error;
      lastError = error;
      cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
      console.warn(`[ia] ${model} falló (${error.status}): ${error.message} Se pausa 2 min y se prueba el siguiente modelo.`);
    }
  }

  // Ningún modelo respondió: mensaje claro para el estudiante (el detalle técnico queda en el log).
  console.error('[ia] Ningún modelo respondió. Último error:', lastError?.status, lastError?.message);
  throw new ProviderError(
    503,
    'La IA está muy ocupada en este momento. Tu trabajo sigue en la pizarra: espera unos segundos y vuelve a pedir la ayuda.'
  );
}
