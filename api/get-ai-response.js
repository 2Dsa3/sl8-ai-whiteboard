import { generate, ProviderError } from './_providers.js';

// Endpoint único que usa el frontend. El proveedor se elige con AI_PROVIDER
// (gemini, groq, openrouter, kimi o custom); ver CLAUDE.md y .env.example.
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: { message: 'Solo se aceptan solicitudes POST.' } });
  }

  try {
    let body = request.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');

    const data = await generate(body);
    return response.status(200).json(data);
  } catch (error) {
    const status = error instanceof ProviderError ? error.status : 500;
    console.error('[get-ai-response]', status, error.message);
    return response.status(status).json({ error: { message: error.message || 'Error interno del servidor.' } });
  }
}
