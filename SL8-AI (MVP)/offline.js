// Modo sin conexión.
// - El service worker (sw.js) guarda la app en caché para que abra y se pueda dibujar sin internet.
// - Si se pide ayuda sin señal, el pedido queda en espera y se envía solo al volver la conexión.

export function isOnline() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
}

// Un fetch que falla por red (no por respuesta del servidor) lanza TypeError.
export function isNetworkError(error) {
    return error instanceof TypeError || !isOnline();
}

export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // En `npm run dev` no se registra para no interferir con la recarga en caliente de Vite.
    if (import.meta.env && import.meta.env.DEV) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((error) => {
            console.warn('No se pudo registrar el service worker:', error);
        });
    });
}

// Muestra/oculta el aviso de "sin conexión" y avisa cuando vuelve la señal.
export function watchConnection({ onOnline, onOffline } = {}) {
    const banner = document.getElementById('offline-banner');
    const update = () => {
        const online = isOnline();
        if (banner) banner.classList.toggle('hidden', online);
        return online;
    };
    window.addEventListener('online', () => {
        update();
        if (onOnline) onOnline();
    });
    window.addEventListener('offline', () => {
        update();
        if (onOffline) onOffline();
    });
    update();
}
