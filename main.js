// Main application logic for TutorIA - Clean version without duplications

import { Whiteboard } from './draw.js';
// Temporarily commented out analytics imports to fix basic functionality
// import { PromptAnalytics } from '../analytics.js';
// import { PromptExperiments } from '../experiments.js';
// import { GoldenDataset } from '../golden-dataset.js';
// import { FeedbackCollector } from '../feedback-collector.js';

class TutorIA {
    constructor() {
        // API Configuration

        // Prompt optimization infrastructure - temporarily commented out
        // this.analytics = new PromptAnalytics();
        // this.experiments = new PromptExperiments();
        // this.goldenDataset = new GoldenDataset();
        // this.feedbackCollector = new FeedbackCollector(this);

        // Token management
        this.maxTokens = 3000;
        this.usedTokens = 0;
        this.tokenStorageKey = 'tutorIA_tokens';
        this.loadTokensFromStorage();

        // Conversation context
        this.currentMode = 'initial';
        this.conversationHistory = [];
        this.responseHistory = [];

        // Prompt optimization system
        this.promptVariants = {
            temperature: {
                stuck: 0.8,     // High creativity for unblocking
                hint: 0.6,      // Moderate creativity for hints
                clarify: 0.4,   // Low creativity for clarity
                next_step: 0.7, // Moderate-high for guidance
                verify: 0.3,    // Low creativity for analysis
                solution: 0.5   // Balanced for comprehensive explanation
            },
            maxOutputTokens: {
                stuck: 800,     // Longer for emotional support and exploration
                hint: 400,      // Shorter for focused hints
                clarify: 600,   // Medium for clear explanations
                next_step: 500, // Medium for specific guidance
                verify: 700,    // Longer for thorough analysis
                solution: 1200  // Longest for complete explanations
            }
        };

        // User interaction patterns for prompt adaptation
        this.userProfile = {
            skillLevel: 'unknown', // beginner, intermediate, advanced
            preferredStyle: 'unknown', // direct, socratic, encouraging
            strugglingAreas: [], // track recurring difficulty patterns
            successfulInteractions: [] // track what works for this user
        };

        // Exercise validation and blocking system
        this.isContentBlocked = true;  // Start with content blocked
        this.exerciseText = '';
        this.exerciseImage = null;

        // Initialize the whiteboard but keep it blocked initially
        this.whiteboard = null;

        // Optimized Tutoring Prompts - Based on pedagogical research
        this.tutorPrompts = {
            initial: `Eres TutorIA, un tutor de programación experto y empático especializado en pensamiento algorítmico.

ANÁLISIS VISUAL REQUERIDO:
- Examina meticulosamente cada elemento en la pizarra: código, diagramas, texto, números
- Si la imagen no está clara al 95%, pregunta específicamente qué no puedes leer
- Identifica el nivel de progreso del estudiante basándote en lo que ves

MARCO PEDAGÓGICO:
1. RECONOCIMIENTO: Siempre comienza destacando qué está haciendo bien
2. DIAGNÓSTICO: Identifica el tipo de ayuda necesaria (conceptual, implementación, debugging)
3. RESPUESTA ADAPTADA: Proporciona el nivel exacto de orientación necesaria

PRINCIPIOS CLAVE:
- Usa el método socrático: pregunta antes de explicar
- Conecta con conocimiento previo visible en su trabajo
- Promueve descubrimiento independiente, no dependencia
- Mantén alta la confianza mientras corriges errores

Responde en español con curiosidad genuina sobre su pensamiento.`,

            stuck: `ESTADO IDENTIFICADO: Estudiante bloqueado necesita desbloquearse.

ESTRATEGIA DE DESBLOQUEO:
1. VALIDACIÓN EMOCIONAL: "Veo que has trabajado duro en esto..."
2. ANÁLISIS VISUAL: Describe específicamente qué observas en su trabajo
3. REFRAME DEL PROBLEMA: Ayúdalo a ver el problema desde otro ángulo
4. PREGUNTAS GUÍA: Haz 2-3 preguntas que despierten nuevas conexiones

TÉCNICAS ESPECÍFICAS:
- "¿Qué pasaría si...?" (escenarios hipotéticos)
- "¿Has visto algo similar antes en...?" (conexión con experiencias previas)
- "¿Qué parte te resulta más familiar?" (ancla en fortalezas)

EVITA: Dar pasos directos, resolver por él, mostrar frustración
BUSCA: Que tenga un "¡Ah!" momento de comprensión

Responde con energía positiva y curiosidad investigativa.`,

            hint: `MODO: Pista Progresiva Calibrada

PROTOCOLO DE PISTA:
1. CONFIRMACIÓN VISUAL: "Veo que has [descripción específica de su trabajo]..."
2. EVALUACIÓN: Identifica exactamente dónde está en su proceso de resolución
3. PISTA MÍNIMA VIABLE: Da LA MENOR cantidad de información que lo ayude a avanzar UN paso
4. VERIFICACIÓN: Pregunta si la pista tiene sentido antes de continuar

NIVELES DE PISTA (usar el mínimo necesario):
- Nivel 1: Pregunta reflexiva que lo guíe al insight
- Nivel 2: Señala hacia el área correcta sin dar la respuesta
- Nivel 3: Da una analogía o ejemplo paralelo
- Nivel 4: Estructura de alto nivel (solo si está muy perdido)

REGLAS ESTRICTAS:
- NO reveles la implementación directa
- NO des múltiples pistas a la vez
- SÍ confirma cuando está en el camino correcto
- SÍ pregunta qué piensa sobre la pista dada

Responde con una sola pista elegante y potente.`,

            clarify: `MODO: Clarificación de Problema (Sin Spoilers)

OBJETIVO: Aclarar QUÉ resolver, no CÓMO resolverlo.

ESTRUCTURA DE CLARIFICACIÓN:
1. CONTEXTO: Reformula el problema en palabras más simples
2. EJEMPLOS CONCRETOS: Da 2-3 casos de entrada/salida diferentes
3. RESTRICCIONES: Clarifica límites y casos especiales
4. EXPECTATIVAS: Explica qué tipo de solución se busca

TÉCNICAS PEDAGÓGICAS:
- Usa analogías del mundo real cuando sea útil
- Descompón problemas complejos en partes más simples
- Identifica conceptos clave que necesita entender primero
- Da ejemplos que cubran casos normales y extremos

LÍMITES ESTRICTOS:
- NO menciones algoritmos específicos
- NO des pistas sobre la implementación
- NO sugieras estructuras de datos específicas
- SÍ asegúrate que comprende completamente el problema

Responde enfocándote exclusivamente en la comprensión del enunciado.`,

            next_step: `MODO: Orientación de Siguiente Paso

ANÁLISIS REQUERIDO:
1. ESTADO ACTUAL: Evalúa precisamente dónde está en su solución
2. SIGUIENTE LÓGICO: Identifica el próximo paso más natural
3. DOSIFICACIÓN: Da orientación suficiente para UN paso, no más

ESTRATEGIA DE ORIENTACIÓN:
- Pregunta qué piensa que debería hacer después
- Si está correcto: confirma y da confianza para proceder
- Si está perdido: sugiere la dirección general sin especificar cómo
- Si está equivocado: redirige suavemente con una pregunta

FORMULACIONES EFECTIVAS:
- "Ahora que tienes X, ¿qué necesitas para Y?"
- "¿Qué información te falta para continuar?"
- "¿Has considerado qué pasa cuando...?"

MANTÉN AUTONOMÍA: El objetivo es que él tome las decisiones, tú solo orientas la dirección.

Responde con orientación específica pero no prescriptiva.`,

            verify: `MODO: Evaluación Constructiva de Solución

PROTOCOLO DE VERIFICACIÓN:
1. ANÁLISIS COMPLETO: Examina toda la lógica propuesta paso a paso
2. TESTING MENTAL: Prueba con casos normales y extremos
3. FEEDBACK BALANCEADO: Destaca aciertos antes de señalar errores

ESTRUCTURA DE RESPUESTA:
- RECONOCIMIENTO: "Has aplicado bien el concepto de..."
- EVALUACIÓN: "Tu solución funciona para casos como..."
- IDENTIFICACIÓN DE GAPS: "Considera qué pasaría si..."
- ORIENTACIÓN: "¿Cómo podrías manejar el caso donde...?"

SI ES CORRECTA:
- Celebra específicamente qué hizo bien
- Explica por qué su enfoque es sólido
- Menciona posibles optimizaciones (si aplica)
- Conecta con patrones algorítmicos generales

SI ES INCORRECTA:
- Da un contraejemplo concreto que demuestre el error
- Pregunta qué piensa sobre ese caso específico
- Guía hacia la corrección sin dar la respuesta directa

Responde con honestidad constructiva que mantenga alta la motivación.`,

            solution: `MODO: Solución Educativa Completa

ENFOQUE PEDAGÓGICO INTEGRAL:
1. RECONOCIMIENTO DEL ESFUERZO: Valida todo el trabajo realizado
2. SOLUCIÓN ESTRUCTURADA: Presenta paso a paso con razonamiento claro
3. ANÁLISIS COMPARATIVO: Contrasta su enfoque vs. solución óptima
4. GENERALIZACIÓN: Extrae patrones aplicables a problemas similares

ESTRUCTURA DE PRESENTACIÓN:
- INSIGHT CLAVE: "El breakthrough necesario era reconocer que..."
- SOLUCIÓN PASO A PASO: Con explicación del porqué en cada paso
- ANÁLISIS DE SU TRABAJO: "Tu enfoque de X fue correcto porque..."
- LECCIONES EXTRAÍBLES: "Este patrón aparece también en..."

ELEMENTOS DIDÁCTICOS:
- Conecta con conceptos que ya domina
- Explica por qué otras aproximaciones no funcionan
- Menciona cuándo usar vs. no usar esta técnica
- Sugiere problemas similares para practicar

CIERRE MOTIVACIONAL:
- Resalta el progreso en su pensamiento algorítmico
- Identifica fortalezas específicas demostradas
- Sugiere próximos desafíos apropiados para su nivel

Responde como un mentor experto que celebra el crecimiento intelectual.`
        };

        // Load user profile from previous sessions
        this.loadUserProfile();

        this.bindEvents();
    }

    // Token management
    loadTokensFromStorage() {
        const stored = localStorage.getItem(this.tokenStorageKey);
        if (stored) {
            const data = JSON.parse(stored);
            const today = new Date().toDateString();
            if (data.date === today) {
                this.usedTokens = data.usedTokens || 0;
            } else {
                this.usedTokens = 0;
                this.saveTokensToStorage();
            }
        }
        this.updateTokenDisplay();
    }

    saveTokensToStorage() {
        const data = {
            usedTokens: this.usedTokens,
            date: new Date().toDateString()
        };
        localStorage.setItem(this.tokenStorageKey, JSON.stringify(data));
    }

    hasTokensAvailable() {
        return this.usedTokens < this.maxTokens;
    }

    consumeToken() {
        if (this.hasTokensAvailable()) {
            this.usedTokens++;
            this.saveTokensToStorage();
            this.updateTokenDisplay();
            return true;
        }
        return false;
    }

    getRemainingTokens() {
        return Math.max(0, this.maxTokens - this.usedTokens);
    }

    updateTokenDisplay() {
        if (!document.getElementById('tokenCounter')) {
            this.addTokenCounter();
        }
        const tokenCounter = document.getElementById('tokenCounter');
        const remaining = this.getRemainingTokens();
        if (tokenCounter) {
            const colorClass = remaining <= 5 ? 'text-red-500' : remaining <= 15 ? 'text-yellow-500' : 'text-green-500';
            tokenCounter.innerHTML = `<span class="font-semibold ${colorClass}">🪙 ${remaining}/${this.maxTokens} consultas restantes</span>`;
        }
    }

    addTokenCounter() {
        const header = document.querySelector('header');
        if (header && !document.getElementById('tokenCounter')) {
            const tokenContainer = document.createElement('div');
            tokenContainer.id = 'tokenCounter';
            tokenContainer.className = 'text-center mt-2 text-sm';
            header.appendChild(tokenContainer);
        }
    }

    // Event binding
    bindEvents() {
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize content blocking first
            this.initializeContentBlocking();
            
            // Initialize Whiteboard first
            console.log('🚀 Initializing Whiteboard...');
            this.whiteboard = new Whiteboard('whiteboard', 'eraser-cursor');
            window.whiteboard = this.whiteboard;

            if (!this.whiteboard || !this.whiteboard.canvas) {
                console.error('❌ Failed to initialize Whiteboard!');
                return;
            }

            console.log('✅ Whiteboard initialized successfully');

            // Initialize pen tool as default
            setTimeout(() => {
                this.selectPenTool();
            }, 100);
            
            // Exercise input validation
            this.setupExerciseValidation();
            // Help buttons
            const helpToggle = document.getElementById('help-toggle');
            if (helpToggle) {
                helpToggle.addEventListener('click', this.toggleHelpMenu.bind(this));
            }

            for (let i = 1; i <= 6; i++) {
                const helpBtn = document.getElementById(`help-${i}`);
                if (helpBtn) {
                    helpBtn.addEventListener('click', () => this.getHelp(i));
                }
            }

            // Close help menu when clicking outside
            document.addEventListener('click', (e) => {
                const helpMenu = document.getElementById('help-menu');
                const helpToggle = document.getElementById('help-toggle');
                if (helpMenu && helpToggle && !helpToggle.contains(e.target) && !helpMenu.contains(e.target)) {
                    this.closeHelpMenu();
                }
            });

            // Canvas controls
            const clearCanvas = document.getElementById('clear-canvas');
            if (clearCanvas) {
                clearCanvas.addEventListener('click', this.clearCanvas.bind(this));
            }
            // Action buttons
            const clearAll = document.getElementById('clear-all');
            if (clearAll) {
                clearAll.addEventListener('click', this.clearAll.bind(this));
            }

            const undoAction = document.getElementById('undo-action');
            if (undoAction) {
                undoAction.addEventListener('click', this.undoAction.bind(this));
            }

            const redoAction = document.getElementById('redo-action');
            if (redoAction) {
                redoAction.addEventListener('click', this.redoAction.bind(this));
            }

            // Drawing tools
            const penTool = document.getElementById('pen-tool');
            if (penTool) {
                penTool.addEventListener('click', this.selectPenTool.bind(this));
            }

            const eraserTool = document.getElementById('eraser-tool');
            if (eraserTool) {
                eraserTool.addEventListener('click', this.selectEraserTool.bind(this));
            }

            // Eraser size control
            const eraserSize = document.getElementById('eraser-size');
            const eraserSizeDisplay = document.getElementById('eraser-size-display');
            if (eraserSize && eraserSizeDisplay) {
                eraserSize.addEventListener('input', (e) => {
                    const size = parseInt(e.target.value);
                    eraserSizeDisplay.textContent = `${size}px`;
                    if (window.whiteboard && window.whiteboard.mode === 'eraser') {
                        window.whiteboard.setBrushSize(size);
                        this.updateCanvasCursor('eraser', size);
                    }
                });
            }

            // Query functionality
            const sendQuery = document.getElementById('send-query');
            if (sendQuery) {
                sendQuery.addEventListener('click', this.sendQuery.bind(this));
            }

            const queryInput = document.getElementById('query-input');
            if (queryInput) {
                queryInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.sendQuery();
                    }
                });
            }

            // Output panel controls
            const minimizeOutput = document.getElementById('minimize-output');
            if (minimizeOutput) {
                minimizeOutput.addEventListener('click', this.minimizeOutputPanel.bind(this));
            }

            const closeOutput = document.getElementById('close-output');
            if (closeOutput) {
                closeOutput.addEventListener('click', this.closeOutputPanel.bind(this));
            }

            const minimizedOutput = document.getElementById('minimized-output');
            if (minimizedOutput) {
                minimizedOutput.addEventListener('click', this.showOutputPanel.bind(this));
            }
            // Exercise functionality
            const clearExercise = document.getElementById('clear-exercise');
            if (clearExercise) {
                clearExercise.addEventListener('click', this.clearExercise.bind(this));
            }

            this.setupExerciseImagePaste();
        });
    }

    // Help menu functions
    toggleHelpMenu() {
        const helpMenu = document.getElementById('help-menu');
        const helpArrow = document.getElementById('help-arrow');

        if (helpMenu && helpArrow) {
            const isHidden = helpMenu.classList.contains('hidden');
            if (isHidden) {
                helpMenu.classList.remove('hidden');
                helpArrow.style.transform = 'rotate(180deg)';
            } else {
                helpMenu.classList.add('hidden');
                helpArrow.style.transform = 'rotate(0deg)';
            }
        }
    }

    closeHelpMenu() {
        const helpMenu = document.getElementById('help-menu');
        const helpArrow = document.getElementById('help-arrow');

        if (helpMenu && helpArrow) {
            helpMenu.classList.add('hidden');
            helpArrow.style.transform = 'rotate(0deg)';
        }
    }

    // Main help function
    async getHelp(helpType) {
        try {
            // Check if content is blocked
            if (this.isContentBlocked) {
                this.showError('⚠️ Debes escribir un ejercicio o subir una imagen antes de solicitar ayuda. 📝');
                return;
            }

            if (!this.hasTokensAvailable()) {
                this.showError('Has agotado tus consultas diarias. Regresa mañana para más ayuda del tutor IA. 🪙');
                return;
            }

            this.showOutputPanel();

            const helpModes = {
                1: 'stuck', 2: 'hint', 3: 'clarify',
                4: 'next_step', 5: 'verify', 6: 'solution'
            };

            const mode = helpModes[helpType];
            if (!mode) {
                this.showError('Tipo de ayuda no válido.');
                return;
            }

            this.currentMode = mode;
            this.closeHelpMenu();

            // Comentado temporalmente para debug - siempre permitir envío
            // if (['stuck', 'hint', 'next_step', 'verify'].includes(mode)) {
            //     if (window.whiteboard && window.whiteboard.isEmpty()) {
            //         this.showError('Por favor, dibuja o escribe algo en la pizarra antes de solicitar este tipo de ayuda.');
            //         return;
            //     }
            // }

            if (!this.consumeToken()) {
                this.showError('Error al procesar la solicitud. Intenta de nuevo.');
                return;
            }

            this.showLoading(true);

            // Debug: Check whiteboard status
            console.log('🔍 Debug - Whiteboard exists:', !!window.whiteboard);
            if (window.whiteboard) {
                console.log('🔍 Debug - Canvas isEmpty:', window.whiteboard.isEmpty());
                console.log('🔍 Debug - Canvas element:', window.whiteboard.canvas);
            }

            // Siempre capturar la imagen para debug
            let imageData = null;
            try {
                imageData = window.whiteboard ? window.whiteboard.getCanvasImageData() : null;
                console.log('🔍 Debug - Image data captured:', !!imageData);
                console.log('🔍 Debug - Image data length:', imageData ? imageData.length : 0);
            } catch (error) {
                console.warn('⚠️ Error capturing image data:', error);
                imageData = null;
            }
            
            const exerciseText = document.getElementById('exercise-input')?.value || '';

            // PROMPT OPTIMIZATION - Track interaction start (temporarily disabled)
            // const startTime = Date.now();
            // const interactionContext = {
            //     mode: mode,
            //     hasDrawing: !!(window.whiteboard && !window.whiteboard.isEmpty()),
            //     exercisePresent: !!exerciseText.trim(),
            //     conversationLength: this.conversationHistory.length,
            //     attemptNumber: this.conversationHistory.filter(h => h.includes(`Modo: ${mode}`)).length + 1
            // };

            // Get optimized prompt with user context
            let contextualPrompt = this.getOptimizedPrompt(mode, exerciseText);

            if (this.conversationHistory.length > 0) {
                contextualPrompt += `\n\nCONTEXTO DE CONVERSACIÓN: Has tenido ${this.conversationHistory.length} interacciones previas. Historial reciente: ${this.conversationHistory.slice(-2).join('\n')}`;
            }
            
            // Add user profiling context
            if (this.userProfile.skillLevel !== 'unknown') {
                contextualPrompt += `\n\nPERFIL DEL ESTUDIANTE: Nivel estimado: ${this.userProfile.skillLevel}. Estilo preferido: ${this.userProfile.preferredStyle}.`;
            }

            const requestParts = [{ text: contextualPrompt }];

            // Debug: Check if image should be sent
            console.log('🔍 Debug - Mode:', mode);
            console.log('🔍 Debug - Should send image:', ['stuck', 'hint', 'next_step', 'verify'].includes(mode));
            console.log('🔍 Debug - Has imageData:', !!imageData);
            console.log('🔍 Debug - Canvas isEmpty:', window.whiteboard ? window.whiteboard.isEmpty() : 'No whiteboard');

            // Only include image if we have valid data and canvas is not empty
            const shouldIncludeImage = imageData && 
                                     imageData.length > 0 && 
                                     window.whiteboard && 
                                     !window.whiteboard.isEmpty() &&
                                     ['stuck', 'hint', 'next_step', 'verify'].includes(mode);

            if (shouldIncludeImage) {
                try {
                    requestParts.push({
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageData
                        }
                    });
                    console.log('🔍 Debug - Image added to request!');
                    console.log('🔍 Debug - Image data sample:', imageData.substring(0, 50) + '...');
                } catch (error) {
                    console.warn('⚠️ Error adding image to request:', error);
                }
            } else {
                console.log('🔍 Debug - Image NOT added to request');
                // Modify prompt to work without image for modes that typically need it
                if (['stuck', 'hint', 'next_step', 'verify'].includes(mode)) {
                    requestParts[0].text += "\n\nNOTA: El estudiante no ha dibujado nada aún en la pizarra. Proporciona orientación general sobre cómo abordar este tipo de problemas y cómo empezar a trabajar en la pizarra.";
                }
            }

            const exerciseImageData = this.getExerciseImageData();
            if (exerciseImageData) {
                requestParts.push({
                    inlineData: { mimeType: "image/jpeg", data: exerciseImageData }
                });
            }

            if (mode === 'clarify' && (!imageData || !window.whiteboard || window.whiteboard.isEmpty())) {
                requestParts[0].text += "\n\nProporciona ejemplos y explicaciones sobre tipos de problemas comunes.";
            }

            const requestBody = {
                contents: [{ parts: requestParts }],
                generationConfig: {
                    temperature: this.promptVariants.temperature[mode] || 0.7,
                    topK: 40, 
                    topP: 0.95, 
                    maxOutputTokens: this.promptVariants.maxOutputTokens[mode] || 1024
                }
            };

            // Debug: Log the complete request
            console.log('🔍 Debug - Request parts count:', requestParts.length);
            console.log('🔍 Debug - Request structure:', {
                partsCount: requestParts.length,
                hasText: requestParts.some(part => part.text),
                hasImage: requestParts.some(part => part.inlineData)
            });
            console.log('🔍 Debug - Full request body:', JSON.stringify(requestBody, null, 2));

            console.log('🔍 Debug - Sending request to API...');

            const response = await fetch(`/api/get-ai-response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            console.log('🔍 Debug - API Response status:', response.status);
            console.log('🔍 Debug - API Response ok:', response.ok);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.log('🔍 Debug - API Error data:', errorData);
                console.log('🔍 Debug - API Error details:', JSON.stringify(errorData, null, 2));
                throw new Error(this.getErrorMessage(response.status, errorData));
            }

            const data = await response.json();
            console.log('🔍 Debug - API Response data:', data);

            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const aiText = data.candidates[0].content.parts[0].text;

                this.conversationHistory.push(`Modo: ${mode} - Respuesta: ${aiText.substring(0, 100)}...`);
                if (this.conversationHistory.length > 5) {
                    this.conversationHistory.shift();
                }

                const typeLabels = {
                    stuck: '🚫 Apoyo', hint: '💡 Pista', clarify: '❓ Aclaración',
                    next_step: '👣 Siguiente Paso', verify: '✅ Verificación', solution: '📖 Solución'
                };

                this.showResponse(aiText, typeLabels[mode] || 'Ayuda');
                this.addToHistory(`Ayuda: ${typeLabels[mode]}`, aiText);
                
                // Add simple feedback buttons for prompt optimization
                this.addFeedbackButtons(mode);

                // PROMPT OPTIMIZATION - Track successful interaction (temporarily disabled)
                // const responseTime = Date.now() - startTime;
                // const interactionId = this.analytics.trackInteraction({
                //     type: mode,
                //     userQuery: `${typeLabels[mode]} request`,
                //     aiResponse: aiText,
                //     responseTime: responseTime,
                //     userAction: 'response_shown',
                //     hasDrawing: interactionContext.hasDrawing,
                //     drawingComplexity: imageData ? (imageData.length > 1000 ? 'complex' : 'simple') : 'none'
                // });

                // Show feedback form
                // setTimeout(() => {
                //     this.feedbackCollector.showFeedbackForm(interactionId);
                // }, 2000);

                // Track for experiments
                // this.experiments.trackResult(
                //     { mode, prompt: contextualPrompt, context: interactionContext },
                //     'success' // We'll update this later based on user feedback
                // );

                const remaining = this.getRemainingTokens();
                if (remaining <= 5 && remaining > 0) {
                    setTimeout(() => this.showTokenWarning(remaining), 2000);
                }
            } else {
                throw new Error('Respuesta inesperada de la API');
            }
        } catch (error) {
            console.error('Error getting help:', error);
            this.showError(`Error: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    async sendQuery() {
        // Check if content is blocked
        if (this.isContentBlocked) {
            this.showError('⚠️ Debes escribir un ejercicio o subir una imagen antes de hacer preguntas. 📝');
            return;
        }

        const queryInput = document.getElementById('query-input');
        const query = queryInput?.value?.trim();

        if (!query) {
            this.showError('Por favor, escribe una pregunta antes de enviar.');
            return;
        }

        try {
            this.showOutputPanel();
            this.showLoading(true);

            const imageData = window.whiteboard && !window.whiteboard.isEmpty() ? window.whiteboard.getCanvasImageData() : null;
            const exerciseText = document.getElementById('exercise-input')?.value || '';

            let contextPrompt = `Eres un tutor experto. Un estudiante pregunta: "${query}". `;
            if (exerciseText.trim()) {
                contextPrompt += `Contexto del ejercicio: ${exerciseText}. `;
            }
            contextPrompt += `Responde en español de manera útil sin dar la respuesta completa.`;

            const parts = [{ text: contextPrompt }];
            if (imageData) {
                parts.push({ inline_data: { mime_type: "image/png", data: imageData } });
            }

            const exerciseImageData = this.getExerciseImageData();
            if (exerciseImageData) {
                parts.push({ inline_data: { mime_type: "image/jpeg", data: exerciseImageData } });
            }

            const requestBody = {
                contents: [{ parts }],
                generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 }
            };

            const response = await fetch(`/api/get-ai-response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(this.getErrorMessage(response.status, errorData));
            }

            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const aiText = data.candidates[0].content.parts[0].text;
                this.showResponse(aiText, '❓ Consulta');
                this.addToHistory(query, aiText);
                if (queryInput) queryInput.value = '';
            } else {
                throw new Error('Respuesta inesperada de la API');
            }
        } catch (error) {
            console.error('Error sending query:', error);
            this.showError(`Error: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    // Prompt optimization methods
    getOptimizedPrompt(mode, exerciseText) {
        let basePrompt = this.tutorPrompts[mode];
        
        // Add exercise context if provided
        if (exerciseText.trim()) {
            basePrompt += `\n\nCONTEXTO DEL EJERCICIO PROPORCIONADO: "${exerciseText}"`;
        }
        
        // Adapt prompt based on user skill level
        if (this.userProfile.skillLevel === 'beginner') {
            basePrompt += `\n\nADAPTACIÓN: Este estudiante es principiante. Usa vocabulario simple, explica conceptos básicos y sé extra paciente.`;
        } else if (this.userProfile.skillLevel === 'advanced') {
            basePrompt += `\n\nADAPTACIÓN: Este estudiante es avanzado. Puedes usar terminología técnica y referir conceptos más sofisticados.`;
        }
        
        // Adapt based on preferred style
        if (this.userProfile.preferredStyle === 'direct') {
            basePrompt += `\n\nESTILO PREFERIDO: Este estudiante prefiere respuestas directas y concisas.`;
        } else if (this.userProfile.preferredStyle === 'socratic') {
            basePrompt += `\n\nESTILO PREFERIDO: Este estudiante responde bien a preguntas guía y descubrimiento dirigido.`;
        }
        
        return basePrompt;
    }
    
    updateUserProfile(mode, wasHelpful) {
        // Simple skill level assessment based on interaction patterns
        if (mode === 'solution' && this.conversationHistory.length < 3) {
            this.userProfile.skillLevel = 'beginner';
        } else if (mode === 'verify' && wasHelpful) {
            this.userProfile.skillLevel = 'intermediate';
        } else if (mode === 'next_step' && this.conversationHistory.length > 5) {
            this.userProfile.skillLevel = 'advanced';
        }
        
        // Track successful interaction patterns
        if (wasHelpful) {
            this.userProfile.successfulInteractions.push({
                mode: mode,
                timestamp: Date.now(),
                context: this.conversationHistory.length
            });
        }
        
        // Save profile to localStorage for persistence
        localStorage.setItem('tutorIA_userProfile', JSON.stringify(this.userProfile));
    }
    
    loadUserProfile() {
        const stored = localStorage.getItem('tutorIA_userProfile');
        if (stored) {
            try {
                this.userProfile = { ...this.userProfile, ...JSON.parse(stored) };
            } catch (e) {
                console.warn('Could not load user profile:', e);
            }
        }
    }
    
    addFeedbackButtons(mode) {
        const aiResponse = document.getElementById('ai-response');
        if (aiResponse) {
            const feedbackHtml = `
                <div class="feedback-container mt-2 p-2 bg-gray-50 rounded border text-center">
                    <div class="text-xs text-gray-600 mb-2">¿Te ayudó esta respuesta?</div>
                    <div class="flex justify-center space-x-2">
                        <button class="feedback-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs" 
                                onclick="window.tutorIA.recordFeedback('${mode}', true)">
                            👍 Útil
                        </button>
                        <button class="feedback-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs" 
                                onclick="window.tutorIA.recordFeedback('${mode}', false)">
                            👎 Confuso
                        </button>
                    </div>
                </div>
            `;
            
            // Add feedback to the last response
            const responses = aiResponse.querySelectorAll('.mb-3');
            if (responses.length > 0) {
                const lastResponse = responses[responses.length - 1];
                lastResponse.insertAdjacentHTML('beforeend', feedbackHtml);
            }
        }
    }
    
    recordFeedback(mode, wasHelpful) {
        // Update user profile based on feedback
        this.updateUserProfile(mode, wasHelpful);
        
        // Hide feedback buttons after selection
        const feedbackContainers = document.querySelectorAll('.feedback-container');
        feedbackContainers.forEach(container => {
            const selectedButton = container.querySelector('.feedback-btn');
            if (selectedButton) {
                container.innerHTML = `
                    <div class="text-xs text-gray-500">
                        ${wasHelpful ? '✅ Gracias por el feedback positivo' : '📝 Tomaré nota para mejorar'}
                    </div>
                `;
            }
        });
        
        // Log for development
        console.log('📊 Feedback recorded:', { mode, wasHelpful, userProfile: this.userProfile });
    }
    // Action functions
    clearAll() {
        if (confirm('¿Estás seguro de que quieres eliminar todo el contenido?')) {
            if (window.whiteboard) window.whiteboard.clearCanvas();
            this.clearExercise();

            const aiResponse = document.getElementById('ai-response');
            if (aiResponse) {
                aiResponse.innerHTML = '<p class="text-gray-500 italic">Las respuestas de la IA aparecerán aquí...</p>';
            }

            this.responseHistory = [];
            this.conversationHistory = [];
            this.showExerciseSuccess('🗑️ Todo el contenido ha sido eliminado');
        }
    }

    undoAction() {
        if (window.whiteboard && window.whiteboard.undo) {
            const success = window.whiteboard.undo();
            if (success) {
                this.showExerciseSuccess('↶ Acción deshecha');
            } else {
                this.showError('No hay acciones para deshacer.');
            }
        } else {
            this.showError('Función de deshacer no disponible en este momento.');
        }
    }

    redoAction() {
        if (window.whiteboard && window.whiteboard.redo) {
            const success = window.whiteboard.redo();
            if (success) {
                this.showExerciseSuccess('↷ Acción rehecha');
            } else {
                this.showError('No hay acciones para rehacer.');
            }
        } else {
            this.showError('Función de rehacer no disponible en este momento.');
        }
    }

    clearCanvas() {
        if (window.whiteboard) {
            window.whiteboard.clearCanvas();
            const aiResponse = document.getElementById('ai-response');
            if (aiResponse) {
                aiResponse.innerHTML = '<p class="text-gray-500 italic">Las respuestas de la IA aparecerán aquí...</p>';
            }
            this.responseHistory = [];
        }
    }

    clearExercise() {
        const exerciseInput = document.getElementById('exercise-input');
        const imageContainer = document.getElementById('exercise-image-container');
        const exerciseImage = document.getElementById('exercise-image');

        if (exerciseInput) {
            exerciseInput.value = '';
            exerciseInput.style.height = 'auto';
        }

        if (imageContainer && exerciseImage) {
            imageContainer.classList.add('hidden');
            exerciseImage.src = '';
            this.exerciseImageData = null;
        }

        this.showExerciseSuccess('🗑️ Ejercicio limpiado');
    }

    // Drawing tool functions
    selectPenTool() {
        if (window.whiteboard) {
            window.whiteboard.setMode('pen');
            this.updateToolButtons();
            this.hideEraserSizePanel();
            this.updateCanvasCursor('pen');
        }
    }

    selectEraserTool() {
        if (window.whiteboard) {
            window.whiteboard.setMode('eraser');
            this.updateToolButtons();
            this.showEraserSizePanel();

            const eraserSize = document.getElementById('eraser-size');
            const size = eraserSize ? parseInt(eraserSize.value) : 15;

            if (eraserSize) {
                window.whiteboard.setBrushSize(size);
            }

            this.updateCanvasCursor('eraser', size);
        }
    }
    updateToolButtons() {
        const penTool = document.getElementById('pen-tool');
        const eraserTool = document.getElementById('eraser-tool');

        if (penTool && eraserTool && window.whiteboard) {
            // Reset both buttons
            penTool.classList.remove('bg-blue-500', 'text-white');
            penTool.classList.add('bg-gray-300', 'text-gray-700');
            eraserTool.classList.remove('bg-orange-500', 'text-white');
            eraserTool.classList.add('bg-gray-300', 'text-gray-700');

            // Activate current tool
            if (window.whiteboard.mode === 'pen') {
                penTool.classList.remove('bg-gray-300', 'text-gray-700');
                penTool.classList.add('bg-blue-500', 'text-white');
            } else if (window.whiteboard.mode === 'eraser') {
                eraserTool.classList.remove('bg-gray-300', 'text-gray-700');
                eraserTool.classList.add('bg-orange-500', 'text-white');
            }
        }
    }

    showEraserSizePanel() {
        const eraserSizePanel = document.getElementById('eraser-size-panel');
        if (eraserSizePanel) eraserSizePanel.classList.remove('hidden');
    }

    hideEraserSizePanel() {
        const eraserSizePanel = document.getElementById('eraser-size-panel');
        if (eraserSizePanel) eraserSizePanel.classList.add('hidden');
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
            const encodedSvg = encodeURIComponent(cursorSvg);
            const cursorUrl = `data:image/svg+xml,${encodedSvg}`;
            canvas.style.cursor = `url("${cursorUrl}") ${cursorSize / 2} ${cursorSize / 2}, auto`;
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }

    // Output panel functions
    showOutputPanel() {
        const outputPanel = document.getElementById('output-panel');
        const minimizedOutput = document.getElementById('minimized-output');

        if (outputPanel && minimizedOutput) {
            outputPanel.classList.remove('hidden');
            minimizedOutput.classList.add('hidden');
        }
    }

    minimizeOutputPanel() {
        const outputPanel = document.getElementById('output-panel');
        const minimizedOutput = document.getElementById('minimized-output');

        if (outputPanel && minimizedOutput) {
            outputPanel.classList.add('hidden');
            minimizedOutput.classList.remove('hidden');

            const responseCount = document.querySelectorAll('#ai-response .mb-3').length;
            const countBadge = minimizedOutput.querySelector('.bg-blue-600');
            if (countBadge) {
                countBadge.textContent = responseCount > 0 ? responseCount : '1';
            }
        }
    }

    closeOutputPanel() {
        const outputPanel = document.getElementById('output-panel');
        const minimizedOutput = document.getElementById('minimized-output');

        if (outputPanel && minimizedOutput) {
            outputPanel.classList.add('hidden');
            minimizedOutput.classList.add('hidden');
        }
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const aiResponse = document.getElementById('ai-response');
        const sendQuery = document.getElementById('send-query');

        if (show) {
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');
            if (aiResponse) aiResponse.classList.add('hidden');
            if (sendQuery) {
                sendQuery.disabled = true;
                sendQuery.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (aiResponse) aiResponse.classList.remove('hidden');
            if (sendQuery) {
                sendQuery.disabled = false;
                sendQuery.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    showResponse(text, type = 'Respuesta') {
        const aiResponse = document.getElementById('ai-response');
        if (aiResponse) {
            const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const responseHtml = `
                <div class="mb-3 p-2 bg-white rounded border-l-4 border-blue-400">
                    <div class="text-xs text-gray-500 mb-1">${type} - ${timestamp}</div>
                    <div class="text-gray-800">${text}</div>
                </div>
            `;

            if (aiResponse.innerHTML.includes('Las respuestas de la IA aparecerán aquí')) {
                aiResponse.innerHTML = responseHtml;
            } else {
                aiResponse.innerHTML += responseHtml;
            }

            aiResponse.scrollTop = aiResponse.scrollHeight;
        }
    }

    showError(message) {
        const aiResponse = document.getElementById('ai-response');
        if (aiResponse) {
            const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const errorHtml = `
                <div class="mb-3 p-2 bg-red-50 rounded border-l-4 border-red-400">
                    <div class="text-xs text-red-500 mb-1">❌ Error - ${timestamp}</div>
                    <div class="text-red-700 font-medium">${message}</div>
                </div>
            `;

            if (aiResponse.innerHTML.includes('Las respuestas de la IA aparecerán aquí')) {
                aiResponse.innerHTML = errorHtml;
            } else {
                aiResponse.innerHTML += errorHtml;
            }

            aiResponse.scrollTop = aiResponse.scrollHeight;
        }
    }

    showTokenWarning(remaining) {
        const aiResponse = document.getElementById('ai-response');
        if (aiResponse) {
            const warningHtml = `
                <div class="mb-3 p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
                    <div class="text-xs text-yellow-600 mb-1">⚠️ Advertencia</div>
                    <div class="text-yellow-700 text-sm">Te quedan solo ${remaining} consultas. Úsalas sabiamente.</div>
                </div>
            `;
            aiResponse.innerHTML += warningHtml;
            aiResponse.scrollTop = aiResponse.scrollHeight;
        }
    }

    showExerciseSuccess(message) {
        const exerciseContent = document.getElementById('exercise-content');
        if (exerciseContent) {
            const successMsg = document.createElement('div');
            successMsg.className = 'text-xs text-green-600 mt-1';
            successMsg.textContent = message;

            exerciseContent.appendChild(successMsg);

            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.parentNode.removeChild(successMsg);
                }
            }, 3000);
        }
    }
    // Utility functions
    addToHistory(query, response) {
        this.responseHistory.push({
            timestamp: new Date(),
            query: query,
            response: response
        });

        if (this.responseHistory.length > 10) {
            this.responseHistory = this.responseHistory.slice(-10);
        }
    }

    getErrorMessage(status, errorData) {
        switch (status) {
            case 400: return 'Solicitud inválida. Verifica que hayas dibujado algo en la pizarra.';
            case 401: return 'Error de autenticación. El backend no pudo validar la solicitud.';
            case 403: return 'Acceso denegado. El backend no tiene permisos para acceder a la API.';
            case 429: return 'Has superado el límite de solicitudes. Intenta de nuevo en unos minutos.';
            case 500: return 'Error interno del servidor. Intenta de nuevo más tarde.';
            default:
                if (errorData.error && errorData.error.message) {
                    return errorData.error.message;
                }
                return 'No se pudo generar una respuesta. Intenta de nuevo.';
        }
    }

    getHistory() {
        return this.responseHistory;
    }

    // Exercise image functionality
    setupExerciseImagePaste() {
        const exerciseContent = document.getElementById('exercise-content');
        const exerciseInput = document.getElementById('exercise-input');

        if (!exerciseContent || !exerciseInput) return;

        exerciseContent.addEventListener('paste', (e) => {
            e.preventDefault();

            const items = e.clipboardData.items;
            let hasImage = false;

            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    hasImage = true;
                    const file = item.getAsFile();
                    this.handleExerciseImagePaste(file);
                    break;
                }
            }

            if (!hasImage) {
                const text = e.clipboardData.getData('text/plain');
                if (text) {
                    const start = exerciseInput.selectionStart;
                    const end = exerciseInput.selectionEnd;
                    const currentText = exerciseInput.value;

                    exerciseInput.value = currentText.substring(0, start) + text + currentText.substring(end);
                    exerciseInput.selectionStart = exerciseInput.selectionEnd = start + text.length;
                    exerciseInput.focus();
                }
            }
        });

        const removeImageBtn = document.getElementById('remove-exercise-image');
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => {
                this.removeExerciseImage();
            });
        }
    }
    handleExerciseImagePaste(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showError('Por favor, pega una imagen válida.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showError('La imagen es demasiado grande. Máximo 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageContainer = document.getElementById('exercise-image-container');
            const exerciseImage = document.getElementById('exercise-image');

            if (exerciseImage && imageContainer) {
                exerciseImage.src = e.target.result;
                imageContainer.classList.remove('hidden');
                this.exerciseImageData = e.target.result;
                this.showExerciseImageSuccess();
            }
        };

        reader.onerror = () => {
            this.showError('Error al cargar la imagen.');
        };

        reader.readAsDataURL(file);
    }

    removeExerciseImage() {
        const imageContainer = document.getElementById('exercise-image-container');
        const exerciseImage = document.getElementById('exercise-image');

        if (imageContainer && exerciseImage) {
            imageContainer.classList.add('hidden');
            exerciseImage.src = '';
            this.exerciseImageData = null;
        }
    }

    showExerciseImageSuccess() {
        const exerciseContent = document.getElementById('exercise-content');
        if (exerciseContent) {
            const successMsg = document.createElement('div');
            successMsg.className = 'text-xs text-green-600 mt-1';
            successMsg.textContent = '✅ Imagen pegada correctamente';

            exerciseContent.appendChild(successMsg);

            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.parentNode.removeChild(successMsg);
                }
            }, 3000);
        }
    }

    getExerciseImageData() {
        if (this.exerciseImageData) {
            return this.exerciseImageData.replace(/^data:image\/[a-z]+;base64,/, '');
        }
        return null;
    }

    // Content blocking system methods
    initializeContentBlocking() {
        console.log('🔒 Initializing content blocking system');
        this.updateContentBlockState();
    }

    setupExerciseValidation() {
        // Monitor text input
        const exerciseInput = document.getElementById('exercise-input');
        if (exerciseInput) {
            exerciseInput.addEventListener('input', () => {
                this.exerciseText = exerciseInput.value.trim();
                this.validateAndUpdateBlocking();
            });
        }

        // Monitor image uploads/paste
        const exerciseImageContainer = document.getElementById('exercise-image-container');
        if (exerciseImageContainer) {
            const observer = new MutationObserver(() => {
                const hasImage = !exerciseImageContainer.classList.contains('hidden');
                this.exerciseImage = hasImage;
                this.validateAndUpdateBlocking();
            });
            observer.observe(exerciseImageContainer, { attributes: true, attributeFilter: ['class'] });
        }

        // Monitor clear exercise button
        const clearExercise = document.getElementById('clear-exercise');
        if (clearExercise) {
            clearExercise.addEventListener('click', () => {
                setTimeout(() => {
                    this.exerciseText = '';
                    this.exerciseImage = null;
                    this.validateAndUpdateBlocking();
                }, 100);
            });
        }
    }

    validateAndUpdateBlocking() {
        const hasExerciseText = this.exerciseText.length > 0;
        const hasExerciseImage = this.exerciseImage;
        
        // Content is blocked if there's no exercise text AND no exercise image
        this.isContentBlocked = !hasExerciseText && !hasExerciseImage;
        
        console.log('📝 Exercise validation:', {
            hasText: hasExerciseText,
            hasImage: hasExerciseImage,
            isBlocked: this.isContentBlocked
        });

        this.updateContentBlockState();
    }

    updateContentBlockState() {
        // Update canvas blocking
        const canvasMain = document.getElementById('canvas-main');
        const canvasBlockOverlay = document.getElementById('canvas-block-overlay');
        
        if (canvasMain && canvasBlockOverlay) {
            if (this.isContentBlocked) {
                canvasMain.classList.add('canvas-blocked');
                canvasBlockOverlay.classList.add('active');
            } else {
                canvasMain.classList.remove('canvas-blocked');
                canvasBlockOverlay.classList.remove('active');
            }
        }

        // Update controls blocking
        const canvasControls = document.getElementById('canvas-controls');
        if (canvasControls) {
            if (this.isContentBlocked) {
                canvasControls.classList.add('controls-blocked');
            } else {
                canvasControls.classList.remove('controls-blocked');
            }
        }

        // Update help blocking
        const helpSection = document.getElementById('help-section');
        if (helpSection) {
            if (this.isContentBlocked) {
                helpSection.classList.add('help-blocked');
            } else {
                helpSection.classList.remove('help-blocked');
            }
        }

        // Disable whiteboard if blocked
        if (this.whiteboard) {
            if (this.isContentBlocked) {
                this.whiteboard.canvas.style.pointerEvents = 'none';
            } else {
                this.whiteboard.canvas.style.pointerEvents = 'auto';
            }
        }

        console.log('🔄 Content block state updated:', this.isContentBlocked ? 'BLOCKED' : 'UNBLOCKED');
    }
}

// Initialize TutorIA application
const tutorIA = new TutorIA();

// Make it globally available for debugging
window.tutorIA = tutorIA;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ TutorIA initialized successfully.');

    setTimeout(() => {
        const aiResponse = document.getElementById('ai-response');
        if (aiResponse && aiResponse.innerHTML.includes('Las respuestas de la IA aparecerán aquí')) {
            aiResponse.innerHTML = `
                <div class="text-green-600 text-xs mb-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                    <strong>✅ TutorIA Listo para Ayudar</strong><br>
                    Sistema de tutorías inteligente activado.
                </div>
                <div class="text-gray-600 text-xs">
                    <strong>Instrucciones:</strong><br>
                    1. Escribe tu ejercicio en el área de texto.<br>
                    2. Dibuja tu solución en la pizarra.<br>
                    3. Usa el botón "🆘 Ayuda" para obtener asistencia.<br>
                    4. Haz preguntas directas en el campo de consulta.
                </div>
            `;
        }
    }, 500);
});

console.log('✅ TutorIA application initialized successfully!');