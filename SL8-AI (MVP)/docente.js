// Vista docente: lee las métricas locales de este dispositivo y muestra un resumen para la demo del piloto.

import { MetricsStore, FIRST_STROKE_GOAL_SECONDS, downloadCSV } from './metrics.js';
import { escapeHtml } from './format.js';

const LEVEL_NAMES = {
    0: 'Sin ayuda',
    1: '1 · Pregunta guía',
    2: '2 · Pista',
    3: '3 · Siguiente paso',
    4: '4 · Verificación',
    5: '5 · Solución'
};

const MODE_NAMES = {
    stuck: 'Pregunta guía',
    hint: 'Pista',
    clarify: 'Aclarar enunciado',
    next_step: 'Siguiente paso',
    verify: 'Verificación',
    solution: 'Solución',
    pregunta: 'Pregunta libre'
};

const store = new MetricsStore();

function formatSeconds(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    if (seconds < 60) return `${seconds} s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return sec ? `${min} min ${sec} s` : `${min} min`;
}

function formatPct(value) {
    return value === null || value === undefined ? '—' : `${value} %`;
}

function formatDate(ms) {
    return new Date(ms).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}

function kpiCard(title, value, detail) {
    return `
        <div class="bg-white border rounded-lg p-3">
            <div class="text-xs text-gray-600">${title}</div>
            <div class="text-2xl font-bold mt-1">${value}</div>
            <div class="text-xs text-gray-600 mt-1">${detail}</div>
        </div>`;
}

function renderKpis(summary) {
    const goalMin = FIRST_STROKE_GOAL_SECONDS / 60;
    document.getElementById('kpis').innerHTML = [
        kpiCard('Ejercicios registrados', summary.totalExercises,
            `${summary.withHelp} con al menos una ayuda`),
        kpiCard('Planteó antes de pedir ayuda', formatPct(summary.pctPlantedBeforeHelp),
            `${summary.totalBlockedAttempts} intento(s) de pedir ayuda sin plantear`),
        kpiCard('Tiempo hasta el primer trazo', formatSeconds(summary.medianSecondsToFirstStroke),
            `Mediana · ${formatPct(summary.pctFirstStrokeUnderGoal)} en menos de ${goalMin} min (meta)`),
        kpiCard('Pidió la solución', formatPct(summary.pctAskedSolution),
            `Nivel máximo promedio: ${summary.avgMaxLevel ?? '—'} de 5`)
    ].join('');
}

function renderLevelTable(summary) {
    const total = summary.totalExercises;
    document.getElementById('level-table').innerHTML = Object.entries(LEVEL_NAMES).map(([level, name]) => {
        const count = summary.levelDistribution[level] || 0; // eslint-disable-line security/detect-object-injection
        const pct = total ? Math.round((count / total) * 100) : 0;
        return `
            <tr class="border-b last:border-0">
                <td class="py-1">${name}</td>
                <td class="py-1 text-right tabular-nums">${count}</td>
                <td class="py-1 text-right tabular-nums">${total ? `${pct} %` : '—'}</td>
            </tr>`;
    }).join('');
}

function describeEvent(event) {
    const time = new Date(event.t).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    const mode = MODE_NAMES[event.mode] || event.mode || ''; // eslint-disable-line security/detect-object-injection
    switch (event.type) {
        case 'primer_trazo': return `${time} · ✏️ Primer trazo en la pizarra`;
        case 'bloqueado': return `${time} · 🔒 Intentó pedir «${mode}» sin plantear`;
        case 'ayuda': return `${time} · 🆘 ${mode}: ${event.preview || ''}`;
        case 'pregunta': return `${time} · 💬 «${event.query || ''}»: ${event.preview || ''}`;
        default: return `${time} · ${event.type}`;
    }
}

function badge(text, tone) {
    const tones = {
        good: 'bg-green-100 text-green-800',
        warn: 'bg-amber-100 text-amber-800',
        neutral: 'bg-gray-100 text-gray-700'
    };
    return `<span class="inline-block text-xs px-2 py-0.5 rounded-full ${tones[tone] || tones.neutral}">${text}</span>`; // eslint-disable-line security/detect-object-injection
}

function plantedBadge(record) {
    if (record.plantedBeforeHelp === true) return badge('Planteó antes de pedir ayuda', 'good');
    if (record.plantedBeforeHelp === false) return badge('Intentó pedir ayuda sin plantear', 'warn');
    return badge('No pidió ayuda', 'neutral');
}

function strokeBadge(record) {
    if (record.secondsToFirstStroke === null) return badge('Sin trazos', 'neutral');
    const tone = record.secondsToFirstStroke < FIRST_STROKE_GOAL_SECONDS ? 'good' : 'warn';
    return badge(`Primer trazo: ${formatSeconds(record.secondsToFirstStroke)}`, tone);
}

function renderRecord(record) {
    const exercise = record.exercisePreview ? escapeHtml(record.exercisePreview) : `<em>(${escapeHtml(record.source)})</em>`;
    const thumbnail = record.planThumbnail && record.planThumbnail.startsWith('data:image/')
        ? `<img src="${record.planThumbnail}" alt="Planteamiento del estudiante en la pizarra" class="w-full md:w-48 rounded border bg-white">`
        : '<div class="w-full md:w-48 h-24 rounded border bg-gray-50 flex items-center justify-center text-xs text-gray-500 text-center p-2">Sin imagen del planteamiento</div>';
    const levels = record.levelsUsed.length ? record.levelsUsed.join(', ') : '—';
    const events = record.events.map((e) => `<li>${escapeHtml(describeEvent(e))}</li>`).join('');

    return `
        <article class="bg-white border rounded-lg p-3">
            <div class="flex flex-col md:flex-row gap-3">
                ${thumbnail}
                <div class="flex-1 min-w-0">
                    <div class="text-xs text-gray-600">${formatDate(record.startedAt)} · origen: ${escapeHtml(record.source)}</div>
                    <div class="font-medium break-words">${exercise}</div>
                    ${record.planText ? `<div class="text-sm text-gray-700 mt-1 break-words">✍️ ${escapeHtml(record.planText)}</div>` : ''}
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${plantedBadge(record)}
                        ${strokeBadge(record)}
                        ${badge(`Nivel máximo: ${LEVEL_NAMES[record.maxLevel] || record.maxLevel}`, record.maxLevel >= 5 ? 'warn' : 'neutral')}
                        ${record.askedSolution ? badge('Pidió la solución', 'warn') : ''}
                    </div>
                    <div class="text-xs text-gray-600 mt-2">Niveles usados: ${levels} · ${record.helpRequests} ayuda(s) · ${record.queries} pregunta(s) libre(s)</div>
                    ${events ? `<details class="mt-2"><summary class="text-xs text-blue-700 cursor-pointer">Ver historial (${record.events.length})</summary><ul class="text-xs text-gray-700 mt-1 space-y-1 list-none">${events}</ul></details>` : ''}
                </div>
            </div>
        </article>`;
}

function render() {
    store.records = store.load();
    const summary = store.summary();
    renderKpis(summary);
    renderLevelTable(summary);

    const records = store.getAll().reverse();
    document.getElementById('history').innerHTML = records.length
        ? records.map(renderRecord).join('')
        : '<p class="text-sm text-gray-600 bg-white border rounded-lg p-4">Todavía no hay ejercicios registrados en este dispositivo. Abre la pizarra, carga un ejercicio y pide ayuda para ver datos aquí.</p>';
}

document.getElementById('export-csv').addEventListener('click', () => {
    store.records = store.load();
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(store.toCSV(), `pizarra-ia-metricas-${date}.csv`);
});

document.getElementById('refresh').addEventListener('click', render);

document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('¿Borrar todas las métricas guardadas en este dispositivo? Exporta el CSV antes si las necesitas.')) {
        store.clear();
        render();
    }
});

render();
