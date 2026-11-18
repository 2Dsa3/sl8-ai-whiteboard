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

  return { name, type: preset.type, apiKey, baseUrl, model, fallbackRaw: env.AI_FALLBACK_MODELS };
}

function toGeminiShape(text) {
  return { candidates: [{ content: { role: 'model', parts: [{ text }] } }] };
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

// Modelos gratuitos de respaldo si el principal está saturado o sin cuota.
// Se puede cambiar con AI_FALLBACK_MODELS (separados por coma, vacío = sin respaldo).
const GEMINI_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

// 503 = modelo saturado ("high demand"), 500 = error temporal de Google,
// 429 = sin cuota para ese modelo (cada modelo tiene su propia cuota gratis).
const RETRYABLE = new Set([429, 500, 503]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiModel(body, model, apiKey) {
  const generationConfig = { ...(body.generationConfig || {}) };

  // Los modelos 2.5 "piensan" y ese razonamiento consume maxOutputTokens.
  // Con límites cortos (pistas de 400 tokens) la respuesta puede llegar vacía,
  // así que se apaga el razonamiento salvo que se pida explícitamente.
  if (/2\.5-flash/.test(model) && !generationConfig.thinkingConfig) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const send = (config) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ ...body, generationConfig: config }),
    });

  let res = await send(generationConfig);
  if (!res.ok) throw new ProviderError(res.status, await readError(res));
  let data = await res.json();

  // Modelos que razonan (3.x) pueden gastarse el límite completo pensando y no devolver texto:
  // se reintenta una vez con más margen de tokens.
  if (data?.candidates?.[0]?.finishReason === 'MAX_TOKENS' && !extractText(data)) {
    const bigger = { ...generationConfig, maxOutputTokens: Math.max(2048, (generationConfig.maxOutputTokens || 512) * 4) };
    res = await send(bigger);
    if (!res.ok) throw new ProviderError(res.status, await readError(res));
    data = await res.json();
  }

  const text = extractText(data);
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'sin texto';
    throw new ProviderError(502, `La IA no devolvió texto (${reason}).`);
  }
  return toGeminiShape(text);
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
}

function geminiModels(cfg) {
  const raw = cfg.fallbackRaw;
  const fallbacks = raw === undefined ? GEMINI_FALLBACKS : raw.split(',').map((m) => m.trim()).filter(Boolean);
  return [cfg.model, ...fallbacks.filter((m) => m !== cfg.model)];
}

async function callGemini(body, cfg) {
  const models = geminiModels(cfg);
  let lastError;

  for (const model of models) {
    // Un reintento corto en el mismo modelo si está saturado; luego se pasa al siguiente.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callGeminiModel(body, model, cfg.apiKey);
      } catch (error) {
        lastError = error;
        if (!RETRYABLE.has(error.status)) throw error;
        console.warn(`[gemini] ${model} respondió ${error.status}, intento ${attempt + 1}`); // eslint-disable-line no-console
        if (error.status === 429) break; // sin cuota: reintentar el mismo modelo no sirve
        if (attempt === 0) await sleep(1200);
      }
    }
  }

  if (lastError?.status === 429) {
    throw new ProviderError(429, 'Se acabó la cuota gratuita de la IA por ahora. Intenta en unos minutos.');
  }
  throw new ProviderError(503, 'La IA está saturada en este momento. Espera unos segundos e inténtalo de nuevo.');
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

async function callOpenAICompatible(body, cfg) {
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

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

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
  return cfg.type === 'gemini' ? callGemini(body, cfg) : callOpenAICompatible(body, cfg);
}
