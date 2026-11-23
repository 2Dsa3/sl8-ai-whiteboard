// Service worker de Pizarra IA: permite abrir la app y dibujar sin conexión.
// Estrategia "red primero": si hay internet se usa la versión nueva y se actualiza la caché;
// si no hay, se sirve lo último guardado. Las llamadas a /api nunca se guardan.

const CACHE_NAME = 'pizarra-ia-v1';
const APP_SHELL = [
    './',
    './index.html',
    './main.js',
    './draw.js',
    './prompts.js',
    './help-ladder.js',
    './metrics.js',
    './offline.js',
    './format.js',
    './exercise-photo.js',
    './styles.css',
    './docente.html',
    './docente.js'
];
const CACHEABLE_HOSTS = ['cdn.tailwindcss.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // Uno por uno: en el build de Vite algunos archivos cambian de nombre y no deben romper la instalación.
            Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null)))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;
    if (sameOrigin && url.pathname.startsWith('/api/')) return;
    if (!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && (response.ok || response.type === 'opaque')) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(request, { ignoreSearch: true });
                if (cached) return cached;
                if (request.mode === 'navigate') return caches.match('./index.html');
                return Response.error();
            })
    );
});
