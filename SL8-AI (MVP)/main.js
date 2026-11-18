// Pizarra IA – lógica principal de la app.
//
// Flujo: 1) foto o texto del ejercicio → 2) planteamiento propio (trazo o texto)
//        → 3) ayuda socrática por niveles (la solución es el último recurso).
//
// Módulos:
//   prompts.js        prompts de Matemática y Física
//   help-ladder.js    "plantea primero" y escalera de ayuda
//   metrics.js        métricas locales (localStorage) y exportación CSV
//   offline.js / sw.js modo sin conexión
//   exercise-photo.js foto del ejercicio desde la cámara o galería
//   format.js         formato seguro de las respuestas

import { Whiteboard } from './draw.js';
import { BASE_PROMPT, TUTOR_PROMPTS, PROMPT_SETTINGS, buildQueryPrompt } from './prompts.js';
import { HelpLadder, HELP_MODES, LEVELS, getPlanStatus, levelForMode } from './help-ladder.js';
import { MetricsStore } from './metrics.js';
import { isOnline, isNetworkError, registerServiceWorker, watchConnection } from './offline.js';
import { escapeHtml, formatAIText } from './format.js';
import { readImageFileAsJpeg, setupPhotoInputs } from './exercise-photo.js';

const API_URL = '/api/get-ai-response';
const EMPTY_RESPONSE_TEXT = 'Las respuestas de la IA aparecerán aquí';
const EMPTY_RESPONSE_HTML = `<p class="text-gray-500 italic">${EMPTY_RESPONSE_TEXT}…</p>`;

const MODE_LABELS = {
    stuck: '🤔 Nivel 1 · Pregunta guía',
    hint: '💡 Nivel 2 · Pista',
    clarify: '❓ Aclaración del enunciado',
    next_step: '👣 Nivel 3 · Siguiente paso',
    verify: '✅ Nivel 4 · Verificación',
    solution: '📖 Nivel 5 · Solución'
};

function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

class PizarraIA {
    constructor() {
        // Límite diario de consultas (se guarda en localStorage)
        this.maxTokens = 3000;
        this.usedTokens = 0;
        this.tokenStorageKey = 'pizarraIA_tokens';

        // Contexto de la conversación del ejercicio actual
        this.conversationHistory = [];
        this.responseHistory = [];

        // Perfil simple que se ajusta con el feedback 👍/👎
        this.userProfile = {
            skillLevel: 'unknown', // beginner, intermediate, advanced
            preferredStyle: 'unknown', // direct, socratic
            successfulInteractions: []
        };

        // Estado del ejercicio y del planteamiento
        this.exerciseText = '';
        this.exerciseImageData = null;
        this.hasExercise = false;
        this.hasDrawing = false;
        this.isContentBlocked = true;

        this.whiteboard = null;
        this.ladder = new HelpLadder();
        this.metrics = new MetricsStore();

        // Pedido de ayuda en espera cuando no hay conexión
        this.pendingRequest = null;
        this.isRequesting = false;

        this.saveExerciseMetricsDebounced = debounce(() => {
            this.metrics.updateExercise({ source: this.getExerciseSource(), text: this.exerciseText });
        }, 800);

        this.loadUserProfile();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ---------- Inicialización ----------

    init() {
        this.loadTokensFromStorage();

        this.whiteboard = new Whiteboard('whiteboard', 'eraser-cursor');
        window.whiteboard = this.whiteboard;
        if (!this.whiteboard || !this.whiteboard.canvas) {
            console.error('No se pudo iniciar la pizarra.');
            return;
        }
        this.whiteboard.canvas.addEventListener('whiteboard:change', (e) => this.onWhiteboardChange(e.detail));
        this.selectPenTool();

        this.bindHelpEvents();
        this.bindCanvasEvents();
        this.bindOutputEvents();
        this.bindExerciseEvents();

        watchConnection({ onOnline: () => this.flushPendingRequest() });

        this.updateContentBlockState();
        this.refreshPlanState();
        this.showWelcome();
    }

    bindClick(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    bindHelpEvents() {
        this.bindClick('help-toggle', () => this.toggleHelpMenu());
        for (let i = 1; i <= 6; i++) {
            this.bindClick(`help-${i}`, () => this.getHelp(i));
        }

        // Cerrar el menú al tocar fuera
        document.addEventListener('click', (e) => {
            const helpMenu = document.getElementById('help-menu');
            const helpToggle = document.getElementById('help-toggle');
            const fromPanel = document.getElementById('open-help-from-panel');
            if (helpMenu && helpToggle && !helpToggle.contains(e.target) && !helpMenu.contains(e.target)
                && !(fromPanel && fromPanel.contains(e.target))) {
                this.closeHelpMenu();
            }
        });
    }

    bindCanvasEvents() {
        this.bindClick('clear-all', () => this.clearAll());
        this.bindClick('undo-action', () => this.undoAction());
        this.bindClick('redo-action', () => this.redoAction());
        this.bindClick('pen-tool', () => this.selectPenTool());
        this.bindClick('eraser-tool', () => this.selectEraserTool());

        const eraserSize = document.getElementById('eraser-size');
        const eraserSizeDisplay = document.getElementById('eraser-size-display');
        if (eraserSize && eraserSizeDisplay) {
            eraserSize.addEventListener('input', (e) => {
                const size = parseInt(e.target.value, 10);
                eraserSizeDisplay.textContent = `${size}px`;
                if (this.whiteboard && this.whiteboard.mode === 'eraser') {
                    this.whiteboard.setBrushSize(size);
                    this.updateCanvasCursor('eraser', size);
                }
            });
        }
    }

    bindOutputEvents() {
        this.bindClick('send-query', () => this.sendQuery());
        const queryInput = document.getElementById('query-input');
        if (queryInput) {
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.sendQuery();
            });
        }

        this.bindClick('minimize-output', () => this.minimizeOutputPanel());
        this.bindClick('close-output', () => this.closeOutputPanel());
        this.bindClick('minimized-output', () => this.showOutputPanel());
        this.bindClick('open-help-from-panel', () => {
            this.minimizeOutputPanel();
            this.openHelpMenu();
        });

        // Botones 👍/👎 de cada respuesta
        const aiResponse = document.getElementById('ai-response');
        if (aiResponse) {
            aiResponse.addEventListener('click', (e) => {
                const btn = e.target.closest('.feedback-btn');
                if (!btn) return;
                this.recordFeedback(btn.dataset.mode, btn.dataset.helpful === 'true', btn.closest('.feedback-container'));
            });
        }
    }

    bindExerciseEvents() {
        const exerciseInput = document.getElementById('exercise-input');
        if (exerciseInput) {
            exerciseInput.addEventListener('input', () => this.onExerciseChanged());
        }

        const planInput = document.getElementById('plan-input');
        if (planInput) {
            planInput.addEventListener('input', () => this.refreshPlanState());
        }

        this.bindClick('clear-exercise', () => this.clearExercise());
        this.bindClick('remove-exercise-image', () => this.removeExerciseImage());

        setupPhotoInputs(['exercise-photo-camera', 'exercise-photo-gallery'], (file) => this.handleExerciseImageFile(file));
        this.setupExerciseImagePaste();
    }

    // ---------- Estado del ejercicio y del planteamiento ----------

    getExerciseSource() {
        const hasText = this.exerciseText.length > 0;
        const hasImage = Boolean(this.exerciseImageData);
        if (hasText && hasImage) return 'foto+texto';
        return hasImage ? 'foto' : 'texto';
    }

    getPlanText() {
        return document.getElementById('plan-input')?.value.trim() || '';
    }

    onExerciseChanged() {
        const exerciseInput = document.getElementById('exercise-input');
        this.exerciseText = exerciseInput ? exerciseInput.value.trim() : '';
        const nowHasExercise = this.exerciseText.length > 0 || Boolean(this.exerciseImageData);

        if (nowHasExercise && !this.metrics.current) {
            this.startExerciseSession();
        } else if (nowHasExercise) {
            this.saveExerciseMetricsDebounced();
        }

        this.hasExercise = nowHasExercise;
        this.isContentBlocked = !nowHasExercise;
        this.updateContentBlockState();
        this.refreshPlanState();
    }

    // Un ejercicio nuevo: se reinicia la escalera y empieza un registro de métricas.
    startExerciseSession() {
        this.ladder.reset();
        this.conversationHistory = [];
        this.pendingRequest = null;
        this.metrics.startExercise({ source: this.getExerciseSource(), text: this.exerciseText });
    }

    endExerciseSession() {
        this.metrics.endExercise();
        this.ladder.reset();
        this.conversationHistory = [];
        this.pendingRequest = null;
    }

    onWhiteboardChange(detail) {
        this.hasDrawing = !this.whiteboard.isEmpty();
        if (detail && detail.type === 'stroke' && detail.mode === 'pen' && this.hasDrawing) {
            this.metrics.recordFirstStroke();
        }
        this.refreshPlanState();
    }

    currentPlanStatus() {
        return getPlanStatus({
            hasExercise: this.hasExercise,
            hasDrawing: this.hasDrawing,
            planText: this.getPlanText()
        });
    }

    refreshPlanState() {
        const status = this.currentPlanStatus();
        this.ladder.render(status);

        const planStatus = document.getElementById('plan-status');
        if (planStatus) {
            let text = '⏳ Aún no planteas tu razonamiento.';
            let color = 'text-amber-700';
            if (!this.hasExercise) {
                text = 'Primero agrega el ejercicio (paso 1).';
                color = 'text-gray-500';
            } else if (status.ok) {
                text = '✅ Planteamiento listo: ya puedes pedir ayuda (paso 3).';
                color = 'text-green-700';
            }
            planStatus.textContent = text;
            planStatus.className = `text-xs mt-1 ${color}`;
        }
        return status;
    }

    // ---------- Límite diario de consultas ----------

    loadTokensFromStorage() {
        try {
            const stored = localStorage.getItem(this.tokenStorageKey);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.date === new Date().toDateString()) {
                    this.usedTokens = data.usedTokens || 0;
                }
            }
        } catch {
            this.usedTokens = 0;
        }
        this.updateTokenDisplay();
    }

    saveTokensToStorage() {
        try {
            localStorage.setItem(this.tokenStorageKey, JSON.stringify({
                usedTokens: this.usedTokens,
                date: new Date().toDateString()
            }));
        } catch {
            // Sin almacenamiento disponible: el contador vive solo en memoria.
        }
    }

    hasTokensAvailable() {
        return this.usedTokens < this.maxTokens;
    }

    consumeToken() {
        if (!this.hasTokensAvailable()) return false;
        this.usedTokens++;
        this.saveTokensToStorage();
        this.updateTokenDisplay();
        return true;
    }

    getRemainingTokens() {
        return Math.max(0, this.maxTokens - this.usedTokens);
    }

    updateTokenDisplay() {
        let tokenCounter = document.getElementById('tokenCounter');
        if (!tokenCounter) {
            const header = document.querySelector('header');
            if (!header) return;
            tokenCounter = document.createElement('div');
            tokenCounter.id = 'tokenCounter';
            tokenCounter.className = 'text-center mt-2 text-sm';
            header.appendChild(tokenCounter);
        }
        const remaining = this.getRemainingTokens();
        let colorClass = 'text-green-500';
        if (remaining <= 5) colorClass = 'text-red-500';
        else if (remaining <= 15) colorClass = 'text-yellow-500';
        tokenCounter.innerHTML = `<span class="font-semibold ${colorClass}">🪙 ${remaining}/${this.maxTokens} consultas restantes hoy</span>`;
    }

    // ---------- Menú de ayuda ----------

    toggleHelpMenu() {
        const helpMenu = document.getElementById('help-menu');
        if (helpMenu && helpMenu.classList.contains('hidden')) this.openHelpMenu();
        else this.closeHelpMenu();
    }

    openHelpMenu() {
        const helpMenu = document.getElementById('help-menu');
        const helpArrow = document.getElementById('help-arrow');
        if (!helpMenu) return;
        this.refreshPlanState();
        helpMenu.classList.remove('hidden');
        if (helpArrow) helpArrow.style.transform = 'rotate(180deg)';
    }

    closeHelpMenu() {
        const helpMenu = document.getElementById('help-menu');
        const helpArrow = document.getElementById('help-arrow');
        if (helpMenu) helpMenu.classList.add('hidden');
        if (helpArrow) helpArrow.style.transform = 'rotate(0deg)';
    }

    // Muestra por unos segundos por qué un botón está bloqueado, dentro del mismo menú.
    flashMenuNotice(message) {
        const notice = document.getElementById('plan-first-notice');
        if (!notice) return;
        notice.textContent = message;
        notice.classList.remove('hidden');
        notice.classList.add('animate-pulse');
        clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => {
            notice.classList.remove('animate-pulse');
            this.refreshPlanState();
        }, 4000);
    }

    // ---------- Pedidos a la IA ----------

    async requestAI(requestBody) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(this.getErrorMessage(response.status, errorData));
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('La IA devolvió una respuesta vacía. Intenta de nuevo.');
        return text;
    }

    // Imágenes del pedido: la pizarra (planteamiento) y la foto del ejercicio, cada una con su etiqueta.
    buildImageParts() {
        const parts = [];
        if (this.hasDrawing) {
            const boardImage = this.whiteboard.getCanvasImageData();
            if (boardImage) {
                parts.push({ text: 'Imagen 1: la pizarra con el planteamiento a mano del estudiante.' });
                parts.push({ inline_data: { mime_type: 'image/jpeg', data: boardImage } });
            }
        }
        const exerciseImage = this.getExerciseImageData();
        if (exerciseImage) {
            parts.push({ text: 'Foto del enunciado del ejercicio:' });
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: exerciseImage } });
        }
        return parts;
    }

    buildStudentContext({ includeExercise = true } = {}) {
        let context = '';
        if (includeExercise && this.exerciseText) {
            context += `\n\nENUNCIADO DEL EJERCICIO (texto): "${this.exerciseText}"`;
        }
        const planText = this.getPlanText();
        if (planText) {
            context += `\n\nPLANTEAMIENTO ESCRITO DEL ESTUDIANTE: "${planText}"`;
        }
        if (!this.hasDrawing) {
            context += '\n\nNOTA: la pizarra está vacía; el estudiante planteó su idea solo por escrito.';
        }
        if (this.conversationHistory.length > 0) {
            context += `\n\nAYUDAS YA DADAS EN ESTE EJERCICIO (no repitas lo mismo, avanza a partir de ahí):\n${this.conversationHistory.slice(-3).join('\n')}`;
        }
        if (this.userProfile.skillLevel === 'beginner') {
            context += '\n\nADAPTACIÓN: el estudiante parece estar empezando con el tema. Usa palabras sencillas y recuerda los conceptos básicos.';
        } else if (this.userProfile.skillLevel === 'advanced') {
            context += '\n\nADAPTACIÓN: el estudiante tiene buen nivel. Puedes usar terminología técnica.';
        }
        return context;
    }

    buildHelpRequest(mode) {
        const used = [...this.ladder.usedLevels].sort((a, b) => a - b)
            .map((level) => `${level} (${LEVELS[level - 1].label})`);
        let prompt = `${BASE_PROMPT}\n\n${TUTOR_PROMPTS[mode]}`; // eslint-disable-line security/detect-object-injection
        prompt += `\n\nESCALERA DE AYUDA: niveles ya usados en este ejercicio: ${used.length ? used.join(', ') : 'ninguno'}.`;
        prompt += this.buildStudentContext();

        return {
            contents: [{ parts: [{ text: prompt }, ...this.buildImageParts()] }],
            generationConfig: {
                temperature: PROMPT_SETTINGS.temperature[mode] ?? 0.5, // eslint-disable-line security/detect-object-injection
                topK: 40,
                topP: 0.95,
                maxOutputTokens: PROMPT_SETTINGS.maxOutputTokens[mode] || 800 // eslint-disable-line security/detect-object-injection
            }
        };
    }

    // Revisa si se puede pedir ayuda ahora. Devuelve el estado del planteamiento o null si está bloqueado.
    checkCanAsk(kind, fromMenu) {
        if (!this.hasExercise) {
            const msg = '⚠️ Primero sube la foto del ejercicio o escribe el enunciado. 📷';
            if (fromMenu) this.flashMenuNotice(msg);
            else this.showNotice(msg);
            return null;
        }
        const plan = this.currentPlanStatus();
        if (!plan.ok) {
            this.metrics.recordBlockedAttempt(kind);
            if (fromMenu) this.flashMenuNotice(plan.reason);
            else this.showNotice(plan.reason);
            return null;
        }
        if (!this.hasTokensAvailable()) {
            this.showOutputPanel();
            this.showError('Has agotado tus consultas de hoy. Vuelve mañana. 🪙');
            return null;
        }
        return plan;
    }

    async getHelp(helpType) {
        const mode = HELP_MODES[helpType]; // eslint-disable-line security/detect-object-injection
        if (!mode) return;

        const plan = this.checkCanAsk(mode, true);
        if (!plan) return;

        const lock = this.ladder.check(mode);
        if (!lock.unlocked) {
            this.flashMenuNotice(lock.reason);
            return;
        }
        if (this.isRequesting) return;

        this.closeHelpMenu();
        this.showOutputPanel();

        if (!isOnline()) {
            this.queueRequest({ kind: 'help', helpType });
            return;
        }

        this.isRequesting = true;
        this.showLoading(true);
        try {
            const aiText = await this.requestAI(this.buildHelpRequest(mode));
            this.consumeToken();

            const needsThumbnail = this.hasDrawing && this.metrics.current && !this.metrics.current.planThumbnail;
            this.metrics.recordHelp({
                mode,
                level: levelForMode(mode),
                planVia: plan.via,
                planText: this.getPlanText(),
                thumbnail: needsThumbnail ? this.whiteboard.getThumbnailDataURL() : null,
                response: aiText
            });
            this.ladder.markUsed(mode);
            this.refreshPlanState();

            this.conversationHistory.push(`- ${MODE_LABELS[mode]}: ${aiText.substring(0, 200)}…`); // eslint-disable-line security/detect-object-injection
            if (this.conversationHistory.length > 5) this.conversationHistory.shift();

            this.showResponse(aiText, MODE_LABELS[mode]); // eslint-disable-line security/detect-object-injection
            this.addToHistory(`Ayuda: ${MODE_LABELS[mode]}`, aiText); // eslint-disable-line security/detect-object-injection
            this.addFeedbackButtons(mode);
            this.warnIfLowTokens();
        } catch (error) {
            if (isNetworkError(error)) {
                this.queueRequest({ kind: 'help', helpType });
            } else {
                console.error('Error al pedir ayuda:', error);
                this.showError(`Error: ${error.message}`);
            }
        } finally {
            this.isRequesting = false;
            this.showLoading(false);
        }
    }

    async sendQuery(queuedQuery = null) {
        const queryInput = document.getElementById('query-input');
        const query = (queuedQuery ?? queryInput?.value ?? '').trim();

        if (!query) {
            this.showError('Escribe una pregunta antes de enviar.');
            return;
        }
        const plan = this.checkCanAsk('pregunta', false);
        if (!plan || this.isRequesting) return;

        this.showOutputPanel();
        if (!isOnline()) {
            this.queueRequest({ kind: 'query', query });
            if (queryInput) queryInput.value = '';
            return;
        }

        this.isRequesting = true;
        this.showLoading(true);
        try {
            const prompt = buildQueryPrompt(query, this.exerciseText) + this.buildStudentContext({ includeExercise: false });
            const aiText = await this.requestAI({
                contents: [{ parts: [{ text: prompt }, ...this.buildImageParts()] }],
                generationConfig: { temperature: 0.5, topK: 40, topP: 0.95, maxOutputTokens: 700 }
            });
            this.consumeToken();
            this.metrics.recordQuery({ query, response: aiText, planVia: plan.via });

            this.conversationHistory.push(`- Pregunta "${query.substring(0, 80)}": ${aiText.substring(0, 150)}…`);
            if (this.conversationHistory.length > 5) this.conversationHistory.shift();

            this.showResponse(aiText, `💬 Tu pregunta: ${query}`);
            this.addToHistory(query, aiText);
            if (queryInput && !queuedQuery) queryInput.value = '';
            this.warnIfLowTokens();
        } catch (error) {
            if (isNetworkError(error)) {
                this.queueRequest({ kind: 'query', query });
            } else {
                console.error('Error al enviar la pregunta:', error);
                this.showError(`Error: ${error.message}`);
            }
        } finally {
            this.isRequesting = false;
            this.showLoading(false);
        }
    }

    // ---------- Sin conexión ----------

    queueRequest(request) {
        this.pendingRequest = request;
        this.showNotice('📴 Sin conexión. Guardé tu pedido de ayuda y lo enviaré solo cuando vuelva la señal. Mientras tanto, sigue trabajando en la pizarra.');
    }

    flushPendingRequest() {
        if (!this.pendingRequest || !isOnline()) return;
        const request = this.pendingRequest;
        this.pendingRequest = null;
        this.showOutputPanel();
        this.showNotice('📶 Volvió la conexión. Enviando tu pedido de ayuda…');
        if (request.kind === 'help') this.getHelp(request.helpType);
        else this.sendQuery(request.query);
    }

    // ---------- Feedback 👍/👎 ----------

    addFeedbackButtons(mode) {
        const aiResponse = document.getElementById('ai-response');
        if (!aiResponse) return;
        const responses = aiResponse.querySelectorAll('.ai-message');
        const lastResponse = responses[responses.length - 1];
        if (!lastResponse) return;
        lastResponse.insertAdjacentHTML('beforeend', `
            <div class="feedback-container mt-2 p-2 bg-gray-50 rounded border text-center">
                <div class="text-xs text-gray-600 mb-2">¿Te ayudó esta respuesta?</div>
                <div class="flex justify-center space-x-2">
                    <button class="feedback-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs" data-mode="${mode}" data-helpful="true">👍 Me sirvió</button>
                    <button class="feedback-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs" data-mode="${mode}" data-helpful="false">👎 Me confundió</button>
                </div>
            </div>
        `);
    }

    recordFeedback(mode, wasHelpful, container) {
        this.updateUserProfile(mode, wasHelpful);
        if (container) {
            container.innerHTML = `<div class="text-xs text-gray-500">${wasHelpful ? '✅ ¡Gracias por contarnos!' : '📝 Gracias, lo tomaremos en cuenta.'}</div>`;
        }
    }

    updateUserProfile(mode, wasHelpful) {
        if (mode === 'solution' && this.conversationHistory.length < 3) {
            this.userProfile.skillLevel = 'beginner';
        } else if (mode === 'verify' && wasHelpful) {
            this.userProfile.skillLevel = 'intermediate';
        }
        if (wasHelpful) {
            this.userProfile.successfulInteractions.push({ mode, timestamp: Date.now() });
            this.userProfile.successfulInteractions = this.userProfile.successfulInteractions.slice(-20);
        }
        try {
            localStorage.setItem('pizarraIA_userProfile', JSON.stringify(this.userProfile));
        } catch {
            // Sin almacenamiento disponible.
        }
    }

    loadUserProfile() {
        try {
            const stored = localStorage.getItem('pizarraIA_userProfile');
            if (stored) this.userProfile = { ...this.userProfile, ...JSON.parse(stored) };
        } catch {
            // Perfil corrupto o sin almacenamiento: se usa el perfil por defecto.
        }
    }

    // ---------- Acciones de la pizarra ----------

    clearAll() {
        if (!confirm('¿Seguro que quieres borrar todo (ejercicio, pizarra y respuestas)?')) return;
        this.clearExercise({ skipConfirm: true });
        const aiResponse = document.getElementById('ai-response');
        if (aiResponse) aiResponse.innerHTML = EMPTY_RESPONSE_HTML;
        this.responseHistory = [];
    }

    undoAction() {
        if (!this.whiteboard) return;
        if (this.whiteboard.undo()) this.showExerciseSuccess('↶ Acción deshecha');
        else this.showExerciseSuccess('No hay acciones para deshacer.');
    }

    redoAction() {
        if (!this.whiteboard) return;
        if (this.whiteboard.redo()) this.showExerciseSuccess('↷ Acción rehecha');
        else this.showExerciseSuccess('No hay acciones para rehacer.');
    }

    // "Limpiar" = empezar otro ejercicio: se borra el enunciado, el planteamiento y la pizarra.
    clearExercise({ skipConfirm = false } = {}) {
        const planInput = document.getElementById('plan-input');
        const hasWork = this.hasDrawing || (planInput && planInput.value.trim());
        if (!skipConfirm && hasWork && !confirm('¿Empezar otro ejercicio? También se borrarán la pizarra y tu planteamiento.')) {
            return;
        }

        const exerciseInput = document.getElementById('exercise-input');
        if (exerciseInput) {
            exerciseInput.value = '';
            exerciseInput.style.height = 'auto';
        }
        if (planInput) planInput.value = '';
        this.setExerciseImage(null);
        if (this.whiteboard) this.whiteboard.clearCanvas();

        this.endExerciseSession();
        this.onExerciseChanged();
        this.showExerciseSuccess('🗑️ Listo para un ejercicio nuevo');
    }

    // ---------- Herramientas de dibujo ----------

    selectPenTool() {
        if (!this.whiteboard) return;
        this.whiteboard.setMode('pen');
        this.updateToolButtons();
        this.hideEraserSizePanel();
        this.updateCanvasCursor('pen');
    }

    selectEraserTool() {
        if (!this.whiteboard) return;
        this.whiteboard.setMode('eraser');
        this.updateToolButtons();
        this.showEraserSizePanel();
        const eraserSize = document.getElementById('eraser-size');
        const size = eraserSize ? parseInt(eraserSize.value, 10) : 15;
        this.whiteboard.setBrushSize(size);
        this.updateCanvasCursor('eraser', size);
    }

    updateToolButtons() {
        const penTool = document.getElementById('pen-tool');
        const eraserTool = document.getElementById('eraser-tool');
        if (!penTool || !eraserTool || !this.whiteboard) return;

        penTool.classList.remove('bg-blue-500', 'text-white');
        penTool.classList.add('bg-gray-300', 'text-gray-700');
        eraserTool.classList.remove('bg-orange-500', 'text-white');
        eraserTool.classList.add('bg-gray-300', 'text-gray-700');

        if (this.whiteboard.mode === 'pen') {
            penTool.classList.remove('bg-gray-300', 'text-gray-700');
            penTool.classList.add('bg-blue-500', 'text-white');
        } else if (this.whiteboard.mode === 'eraser') {
            eraserTool.classList.remove('bg-gray-300', 'text-gray-700');
            eraserTool.classList.add('bg-orange-500', 'text-white');
        }
    }

    showEraserSizePanel() {
        document.getElementById('eraser-size-panel')?.classList.remove('hidden');
    }

    hideEraserSizePanel() {
        document.getElementById('eraser-size-panel')?.classList.add('hidden');
    }

    updateCanvasCursor(tool, size = 15) {
        const canvas = document.getElementById('whiteboard');
        if (!canvas) return;

        if (tool === 'eraser') {
            const cursorSize = Math.max(12, Math.min(size, 50));
            const cursorSvg = `
                <svg width="${cursorSize}" height="${cursorSize}" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="${cursorSize / 2}" cy="${cursorSize / 2}" r="${(cursorSize - 3) / 2}"
                            fill="rgba(255,255,255,0.3)" stroke="black" stroke-width="2" opacity="0.9"/>
                </svg>
            `;
            const cursorUrl = `data:image/svg+xml,${encodeURIComponent(cursorSvg)}`;
            canvas.style.cursor = `url("${cursorUrl}") ${cursorSize / 2} ${cursorSize / 2}, auto`;
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }

    // ---------- Panel de respuestas ----------

    showOutputPanel() {
        const outputPanel = document.getElementById('output-panel');
        const wasHidden = outputPanel?.classList.contains('hidden');
        outputPanel?.classList.remove('hidden');
        document.getElementById('minimized-output')?.classList.add('hidden');
        // En el celular el panel queda debajo de la pizarra: se lleva a la vista.
        if (wasHidden && window.innerWidth < 768) {
            outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    minimizeOutputPanel() {
        const outputPanel = document.getElementById('output-panel');
        const minimizedOutput = document.getElementById('minimized-output');
        if (!outputPanel || !minimizedOutput) return;
        outputPanel.classList.add('hidden');
        minimizedOutput.classList.remove('hidden');

        const responseCount = document.querySelectorAll('#ai-response .ai-message').length;
        const countBadge = minimizedOutput.querySelector('.bg-blue-600');
        if (countBadge) countBadge.textContent = String(Math.max(responseCount, 1));
    }

    closeOutputPanel() {
        document.getElementById('output-panel')?.classList.add('hidden');
        document.getElementById('minimized-output')?.classList.add('hidden');
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const aiResponse = document.getElementById('ai-response');
        const sendQuery = document.getElementById('send-query');

        if (loadingIndicator) loadingIndicator.classList.toggle('hidden', !show);
        if (aiResponse) aiResponse.classList.toggle('hidden', show);
        if (sendQuery) {
            sendQuery.disabled = show;
            sendQuery.classList.toggle('opacity-50', show);
            sendQuery.classList.toggle('cursor-not-allowed', show);
        }
    }

    appendToResponses(html) {
        const aiResponse = document.getElementById('ai-response');
        if (!aiResponse) return;
        if (aiResponse.innerHTML.includes(EMPTY_RESPONSE_TEXT) || aiResponse.querySelector('.welcome-message')) {
            aiResponse.innerHTML = html;
        } else {
            aiResponse.insertAdjacentHTML('beforeend', html);
        }
        aiResponse.scrollTop = aiResponse.scrollHeight;
    }

    timestamp() {
        return new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    }

    showResponse(text, label = 'Respuesta') {
        this.appendToResponses(`
            <div class="ai-message mb-3 p-2 bg-white rounded border-l-4 border-blue-400">
                <div class="text-xs text-gray-500 mb-1">${escapeHtml(label)} · ${this.timestamp()}</div>
                <div class="text-gray-800 leading-relaxed">${formatAIText(text)}</div>
            </div>
        `);
    }

    showNotice(message) {
        this.showOutputPanel();
        this.appendToResponses(`
            <div class="mb-3 p-2 bg-amber-50 rounded border-l-4 border-amber-400">
                <div class="text-amber-800 text-sm">${escapeHtml(message)}</div>
            </div>
        `);
    }

    showError(message) {
        this.showOutputPanel();
        this.appendToResponses(`
            <div class="mb-3 p-2 bg-red-50 rounded border-l-4 border-red-400">
                <div class="text-xs text-red-500 mb-1">❌ Error · ${this.timestamp()}</div>
                <div class="text-red-700 font-medium">${escapeHtml(message)}</div>
            </div>
        `);
    }

    warnIfLowTokens() {
        const remaining = this.getRemainingTokens();
        if (remaining <= 5 && remaining > 0) {
            setTimeout(() => this.showNotice(`⚠️ Te quedan solo ${remaining} consultas hoy.`), 1500);
        }
    }

    showExerciseSuccess(message) {
        const exerciseContent = document.getElementById('exercise-content');
        if (!exerciseContent) return;
        const msg = document.createElement('div');
        msg.className = 'text-xs text-green-600 mt-1';
        msg.textContent = message;
        exerciseContent.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    showWelcome() {
        const aiResponse = document.getElementById('ai-response');
        if (!aiResponse || !aiResponse.innerHTML.includes(EMPTY_RESPONSE_TEXT)) return;
        aiResponse.innerHTML = `
            <div class="welcome-message">
                <div class="text-green-700 text-xs mb-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                    <strong>👋 Hola, soy Pizarra IA</strong><br>
                    No te voy a dar la respuesta de entrada: te ayudo a llegar tú.
                </div>
                <div class="text-gray-600 text-xs">
                    <strong>Cómo funciona:</strong><br>
                    1. 📷 Toma o sube la foto del ejercicio (o escríbelo).<br>
                    2. ✍️ Plantea tu razonamiento en la pizarra o por escrito.<br>
                    3. 🆘 Pide ayuda por niveles: pregunta guía → pista → siguiente paso → verificación.<br>
                    4. 📖 La solución completa se desbloquea al final, como último recurso.
                </div>
            </div>
        `;
    }

    addToHistory(query, response) {
        this.responseHistory.push({ timestamp: new Date(), query, response });
        if (this.responseHistory.length > 10) this.responseHistory = this.responseHistory.slice(-10);
    }

    getHistory() {
        return this.responseHistory;
    }

    getErrorMessage(status, errorData) {
        // El backend (/api/get-ai-response) ya devuelve mensajes claros en español.
        const backendMessage = errorData?.error?.message;
        if (backendMessage && status !== 429) return backendMessage;
        switch (status) {
            case 400: return 'Solicitud inválida. Revisa el ejercicio y la pizarra e intenta de nuevo.';
            case 401: return 'Error de autenticación con el proveedor de IA.';
            case 403: return 'Acceso denegado por el proveedor de IA.';
            case 429: return 'Se superó el límite de solicitudes. Intenta de nuevo en unos minutos.';
            case 500: return 'Error interno del servidor. Intenta de nuevo más tarde.';
            default: return backendMessage || 'No se pudo generar una respuesta. Intenta de nuevo.';
        }
    }

    // ---------- Foto / imagen del ejercicio ----------

    setupExerciseImagePaste() {
        const exerciseContent = document.getElementById('exercise-content');
        const exerciseInput = document.getElementById('exercise-input');
        if (!exerciseContent || !exerciseInput) return;

        exerciseContent.addEventListener('paste', (e) => {
            const items = [...(e.clipboardData?.items || [])];
            const imageItem = items.find((item) => item.type.startsWith('image/'));
            if (!imageItem) return; // texto: que el navegador lo pegue normal (dispara "input")
            e.preventDefault();
            this.handleExerciseImageFile(imageItem.getAsFile());
        });
    }

    async handleExerciseImageFile(file) {
        try {
            const dataUrl = await readImageFileAsJpeg(file);
            this.setExerciseImage(dataUrl);
            this.onExerciseChanged();
            this.showExerciseSuccess('✅ Foto del ejercicio lista. Ahora plantea tu razonamiento ✍️');
        } catch (error) {
            this.showError(error.message || 'No se pudo cargar la imagen.');
        }
    }

    setExerciseImage(dataUrl) {
        const imageContainer = document.getElementById('exercise-image-container');
        const exerciseImage = document.getElementById('exercise-image');
        this.exerciseImageData = dataUrl;
        if (exerciseImage) {
            if (dataUrl) exerciseImage.src = dataUrl;
            else exerciseImage.removeAttribute('src');
        }
        if (imageContainer) imageContainer.classList.toggle('hidden', !dataUrl);
    }

    removeExerciseImage() {
        this.setExerciseImage(null);
        this.onExerciseChanged();
    }

    getExerciseImageData() {
        return this.exerciseImageData ? this.exerciseImageData.replace(/^data:image\/[a-z]+;base64,/, '') : null;
    }

    // ---------- Bloqueo hasta que haya ejercicio ----------

    updateContentBlockState() {
        const blocked = this.isContentBlocked;
        document.getElementById('canvas-main')?.classList.toggle('canvas-blocked', blocked);
        document.getElementById('canvas-block-overlay')?.classList.toggle('active', blocked);
        document.getElementById('canvas-controls')?.classList.toggle('controls-blocked', blocked);
        document.getElementById('help-section')?.classList.toggle('help-blocked', blocked);
        if (this.whiteboard) this.whiteboard.canvas.style.pointerEvents = blocked ? 'none' : 'auto';
    }
}

registerServiceWorker();

const pizarraIA = new PizarraIA();
window.pizarraIA = pizarraIA;
