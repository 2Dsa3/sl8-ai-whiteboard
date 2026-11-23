// Métricas de Pizarra IA para validar la propuesta de valor (evidencias de la actividad S14).
//
// Los datos se guardan SOLO en localStorage de este dispositivo. No se manda nada a ningún servidor.
// Por ejercicio se registra:
//   - tiempo desde que se abre el ejercicio hasta el primer trazo (meta: < 5 min)
//   - si planteó antes de pedir ayuda (y cuántas veces intentó pedirla sin plantear)
//   - nivel máximo de pista usado
//   - si llegó a pedir la solución

export const METRICS_STORAGE_KEY = 'pizarraIA_metricas';
export const FIRST_STROKE_GOAL_SECONDS = 5 * 60;

const MAX_RECORDS = 100;
const MAX_THUMBNAILS = 30;
const MAX_EVENTS = 40;
const PREVIEW_CHARS = 160;

function getStorage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `ej-${Date.now()}`;
}

function preview(text, max = PREVIEW_CHARS) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export class MetricsStore {
    constructor() {
        this.storage = getStorage();
        this.records = this.load();
        this.currentId = null;
    }

    load() {
        if (!this.storage) return [];
        try {
            const data = JSON.parse(this.storage.getItem(METRICS_STORAGE_KEY) || '[]');
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    save() {
        if (!this.storage) return;
        if (this.records.length > MAX_RECORDS) {
            this.records = this.records.slice(-MAX_RECORDS);
        }
        // Las miniaturas pesan; solo se guardan para los ejercicios más recientes.
        const cutoff = this.records.length - MAX_THUMBNAILS;
        this.records.forEach((r, i) => { if (i < cutoff) r.planThumbnail = null; });

        try {
            this.storage.setItem(METRICS_STORAGE_KEY, JSON.stringify(this.records));
        } catch {
            // Sin espacio: se quitan todas las miniaturas menos la actual y se reintenta.
            this.records.forEach((r) => { if (r.id !== this.currentId) r.planThumbnail = null; });
            try {
                this.storage.setItem(METRICS_STORAGE_KEY, JSON.stringify(this.records));
            } catch {
                // Si aun así no cabe, se conserva en memoria hasta la próxima vez.
            }
        }
    }

    get current() {
        return this.records.find((r) => r.id === this.currentId) || null;
    }

    touch(record) {
        record.lastActivityAt = Date.now();
        this.save();
    }

    addEvent(record, event) {
        record.events.push({ t: Date.now(), ...event });
        if (record.events.length > MAX_EVENTS) record.events.shift();
    }

    // Se llama cuando aparece un ejercicio (foto o texto) en una pizarra vacía.
    startExercise({ source, text }) {
        const now = Date.now();
        const record = {
            id: newId(),
            startedAt: now,
            lastActivityAt: now,
            source,
            exercisePreview: preview(text, 120),
            firstStrokeAt: null,
            secondsToFirstStroke: null,
            plantedBeforeHelp: null,
            planVia: null,
            planText: '',
            planThumbnail: null,
            blockedHelpAttempts: 0,
            helpRequests: 0,
            levelsUsed: [],
            maxLevel: 0,
            askedSolution: false,
            queries: 0,
            events: []
        };
        this.records.push(record);
        this.currentId = record.id;
        this.save();
        return record;
    }

    updateExercise({ source, text }) {
        const record = this.current;
        if (!record) return;
        if (source) record.source = source;
        if (text !== undefined) record.exercisePreview = preview(text, 120);
        this.touch(record);
    }

    endExercise() {
        this.currentId = null;
    }

    recordFirstStroke() {
        const record = this.current;
        if (!record || record.firstStrokeAt) return;
        record.firstStrokeAt = Date.now();
        record.secondsToFirstStroke = Math.round((record.firstStrokeAt - record.startedAt) / 1000);
        this.addEvent(record, { type: 'primer_trazo' });
        this.touch(record);
    }

    // Intentó pedir ayuda sin haber planteado nada propio.
    recordBlockedAttempt(mode) {
        const record = this.current;
        if (!record) return;
        record.blockedHelpAttempts += 1;
        if (record.plantedBeforeHelp === null) record.plantedBeforeHelp = false;
        this.addEvent(record, { type: 'bloqueado', mode });
        this.touch(record);
    }

    recordHelp({ mode, level, planVia, planText, thumbnail, response }) {
        const record = this.current;
        if (!record) return;
        if (record.plantedBeforeHelp === null) record.plantedBeforeHelp = true;
        if (!record.planVia) record.planVia = planVia;
        if (!record.planThumbnail && thumbnail) record.planThumbnail = thumbnail;
        if (planText) record.planText = preview(planText, 300);

        record.helpRequests += 1;
        if (level > 0 && !record.levelsUsed.includes(level)) {
            record.levelsUsed.push(level);
            record.levelsUsed.sort((a, b) => a - b);
        }
        record.maxLevel = Math.max(record.maxLevel, level);
        if (mode === 'solution') record.askedSolution = true;

        this.addEvent(record, { type: 'ayuda', mode, level, preview: preview(response) });
        this.touch(record);
    }

    recordQuery({ query, response, planVia }) {
        const record = this.current;
        if (!record) return;
        if (record.plantedBeforeHelp === null) record.plantedBeforeHelp = true;
        if (!record.planVia) record.planVia = planVia;
        record.queries += 1;
        this.addEvent(record, { type: 'pregunta', query: preview(query, 120), preview: preview(response) });
        this.touch(record);
    }

    getAll() {
        return [...this.records];
    }

    clear() {
        this.records = [];
        this.currentId = null;
        if (this.storage) this.storage.removeItem(METRICS_STORAGE_KEY);
    }

    summary() {
        return summarize(this.records);
    }

    toCSV() {
        return recordsToCSV(this.records);
    }
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function pct(part, total) {
    return total ? Math.round((part / total) * 100) : null;
}

export function summarize(records) {
    const withStroke = records.filter((r) => r.secondsToFirstStroke !== null);
    const strokeTimes = withStroke.map((r) => r.secondsToFirstStroke);
    const attempted = records.filter((r) => r.plantedBeforeHelp !== null);
    const helped = records.filter((r) => r.helpRequests > 0);

    const levelDistribution = {};
    for (let level = 0; level <= 5; level++) levelDistribution[level] = 0;
    for (const r of records) levelDistribution[r.maxLevel] = (levelDistribution[r.maxLevel] || 0) + 1;

    return {
        totalExercises: records.length,
        withStroke: withStroke.length,
        medianSecondsToFirstStroke: median(strokeTimes),
        pctFirstStrokeUnderGoal: pct(strokeTimes.filter((s) => s < FIRST_STROKE_GOAL_SECONDS).length, strokeTimes.length),
        withHelpAttempt: attempted.length,
        pctPlantedBeforeHelp: pct(attempted.filter((r) => r.plantedBeforeHelp).length, attempted.length),
        totalBlockedAttempts: records.reduce((acc, r) => acc + r.blockedHelpAttempts, 0),
        withHelp: helped.length,
        avgMaxLevel: helped.length
            ? Math.round((helped.reduce((acc, r) => acc + r.maxLevel, 0) / helped.length) * 10) / 10
            : null,
        pctAskedSolution: pct(helped.filter((r) => r.askedSolution).length, helped.length),
        levelDistribution
    };
}

function csvCell(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function siNo(value) {
    if (value === null || value === undefined) return '';
    return value ? 'sí' : 'no';
}

function isoDate(ms) {
    return ms ? new Date(ms).toISOString() : '';
}

export function recordsToCSV(records) {
    const header = [
        'id', 'inicio', 'origen_ejercicio', 'enunciado',
        'segundos_hasta_primer_trazo', 'primer_trazo_menos_5_min',
        'planteo_antes_de_ayuda', 'planteamiento_por', 'intentos_de_ayuda_sin_plantear',
        'pedidos_de_ayuda', 'niveles_usados', 'nivel_maximo', 'pidio_solucion',
        'preguntas_libres', 'ultima_actividad'
    ];
    const rows = records.map((r) => [
        r.id,
        isoDate(r.startedAt),
        r.source,
        r.exercisePreview,
        r.secondsToFirstStroke,
        r.secondsToFirstStroke === null ? '' : siNo(r.secondsToFirstStroke < FIRST_STROKE_GOAL_SECONDS),
        siNo(r.plantedBeforeHelp),
        r.planVia,
        r.blockedHelpAttempts,
        r.helpRequests,
        r.levelsUsed.join(' '),
        r.maxLevel,
        siNo(r.askedSolution),
        r.queries,
        isoDate(r.lastActivityAt)
    ]);
    // BOM para que Excel abra bien las tildes.
    return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadCSV(csv, filename = 'pizarra-ia-metricas.csv') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
