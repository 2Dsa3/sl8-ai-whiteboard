// "Plantea primero" + escalera de ayuda por niveles.
//
// - Ningún botón de ayuda funciona hasta que el estudiante haya hecho su propio
//   planteamiento: un trazo en la pizarra o un texto mínimo en "Tu planteamiento".
// - Los niveles se habilitan en orden: pregunta guía → pista → siguiente paso → verificación.
// - La solución (help-6) es el último recurso: se desbloquea tras usar MIN_LEVELS_BEFORE_SOLUTION niveles.
// - "Aclarar el enunciado" (help-3) es una ayuda lateral: no resuelve nada, así que
//   está disponible apenas haya planteamiento y no cuenta como nivel.

export const PLAN_MIN_CHARS = 15;
export const MIN_LEVELS_BEFORE_SOLUTION = 3;

export const HELP_MODES = {
    1: 'stuck', 2: 'hint', 3: 'clarify',
    4: 'next_step', 5: 'verify', 6: 'solution'
};

export const LEVELS = [
    { level: 1, mode: 'stuck', buttonId: 'help-1', label: 'Pregunta guía' },
    { level: 2, mode: 'hint', buttonId: 'help-2', label: 'Pista' },
    { level: 3, mode: 'next_step', buttonId: 'help-4', label: 'Siguiente paso' },
    { level: 4, mode: 'verify', buttonId: 'help-5', label: 'Verificación' },
    { level: 5, mode: 'solution', buttonId: 'help-6', label: 'Solución' }
];
export const TOTAL_LEVELS = LEVELS.length;

const SIDE_HELP = { level: 0, mode: 'clarify', buttonId: 'help-3', label: 'Aclarar el enunciado' };

export function levelForMode(mode) {
    const found = LEVELS.find((l) => l.mode === mode);
    return found ? found.level : 0;
}

// Evalúa si el estudiante ya planteó algo propio.
export function getPlanStatus({ hasExercise, hasDrawing, planText }) {
    const textOk = (planText || '').trim().length >= PLAN_MIN_CHARS;
    if (!hasExercise) {
        return { ok: false, via: null, reason: 'Primero sube la foto del ejercicio o escribe el enunciado. 📷' };
    }
    if (!hasDrawing && !textOk) {
        return {
            ok: false,
            via: null,
            reason: `✍️ Plantea primero: dibuja tu razonamiento en la pizarra o escribe cómo empezarías (mínimo ${PLAN_MIN_CHARS} caracteres). Después se habilita la ayuda.`
        };
    }
    let via = 'texto';
    if (hasDrawing && textOk) via = 'trazo+texto';
    else if (hasDrawing) via = 'trazo';
    return { ok: true, via, reason: '' };
}

export class HelpLadder {
    constructor() {
        this.reset();
    }

    reset() {
        this.usedLevels = new Set();
    }

    markUsed(mode) {
        const level = levelForMode(mode);
        if (level > 0) this.usedLevels.add(level);
    }

    get currentLevel() {
        return this.usedLevels.size ? Math.max(...this.usedLevels) : 0;
    }

    usedBeforeSolution() {
        return [...this.usedLevels].filter((l) => l < TOTAL_LEVELS).length;
    }

    // ¿Se puede usar este modo ahora? Devuelve { unlocked, reason }.
    check(mode) {
        if (mode === SIDE_HELP.mode) return { unlocked: true, reason: '' };
        const level = levelForMode(mode);
        if (!level) return { unlocked: false, reason: 'Tipo de ayuda no válido.' };

        if (level === TOTAL_LEVELS) {
            const used = this.usedBeforeSolution();
            if (used < MIN_LEVELS_BEFORE_SOLUTION) {
                const faltan = MIN_LEVELS_BEFORE_SOLUTION - used;
                return {
                    unlocked: false,
                    reason: `🔒 La solución es el último recurso. Usa ${faltan} nivel${faltan === 1 ? '' : 'es'} más de ayuda antes de verla.`
                };
            }
            return { unlocked: true, reason: '' };
        }

        if (level > 1 && !this.usedLevels.has(level - 1)) {
            const previous = LEVELS[level - 2];
            return { unlocked: false, reason: `🔒 Primero usa el nivel ${previous.level}: «${previous.label}».` };
        }
        return { unlocked: true, reason: '' };
    }

    // Pinta el estado de los botones, el nivel actual y el aviso de "plantea primero".
    render(planStatus) {
        const all = [...LEVELS, SIDE_HELP];
        for (const item of all) {
            const btn = document.getElementById(item.buttonId);
            if (!btn) continue;
            let reason = '';
            if (!planStatus.ok) reason = '🔒 Plantea primero';
            else reason = this.check(item.mode).reason;

            const locked = Boolean(reason);
            btn.classList.toggle('help-locked', locked);
            btn.setAttribute('aria-disabled', String(locked));
            btn.classList.toggle('help-done', this.usedLevels.has(item.level));

            const reasonEl = btn.querySelector('.lock-reason');
            if (reasonEl) {
                reasonEl.textContent = reason;
                reasonEl.classList.toggle('hidden', !locked);
            }
        }

        const notice = document.getElementById('plan-first-notice');
        if (notice) {
            notice.textContent = planStatus.reason;
            notice.classList.toggle('hidden', planStatus.ok);
        }

        const current = this.currentLevel;
        const currentLabel = current ? LEVELS[current - 1].label : 'Sin ayuda aún';
        const status = document.getElementById('help-level-status');
        if (status) {
            status.textContent = `Nivel actual: ${current} de ${TOTAL_LEVELS} · ${currentLabel}`;
        }
        const badge = document.getElementById('help-level-badge');
        if (badge) {
            badge.textContent = planStatus.ok ? `Nivel ${current}/${TOTAL_LEVELS}` : '🔒';
        }
    }
}
