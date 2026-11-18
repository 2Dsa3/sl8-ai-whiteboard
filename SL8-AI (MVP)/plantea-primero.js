// Pizarra IA – flujo "plantea primero"
//
// Paso 1: el estudiante carga el ejercicio (foto con la cámara, imagen de la galería o texto).
// Paso 2: escribe o dibuja su propio planteamiento.
// Paso 3: recién ahí se habilita la ayuda de la IA.

const MIN_APPROACH_CHARS = 10;

function getApproachText() {
    return document.getElementById('approach-input')?.value.trim() || '';
}

function hasDrawing() {
    const wb = window.whiteboard;
    return !!(wb && Array.isArray(wb.history) && wb.history.length > 1);
}

// ¿El estudiante ya planteó algo por su cuenta?
export function hasApproach() {
    return getApproachText().length >= MIN_APPROACH_CHARS || hasDrawing();
}

// Texto que se agrega al prompt para que la IA parta del razonamiento del estudiante.
export function getApproachPrompt() {
    const text = getApproachText();
    if (!text) return '';
    return `\n\nPLANTEAMIENTO ESCRITO DEL ESTUDIANTE: "${text}". Parte de este razonamiento: ` +
        'reconoce lo que va bien y guía desde ahí, sin resolver el ejercicio por él.';
}

export const APPROACH_REQUIRED_MESSAGE =
    '✏️ Primero plantea cómo empezarías: dibuja en la pizarra o escribe tu idea en el Paso 2. Después podrás pedir ayuda.';

export function updateApproachStatus() {
    const status = document.getElementById('approach-status');
    if (!status) return;

    const ready = hasApproach();
    status.textContent = ready
        ? '✅ Planteamiento listo: ya puedes pedir ayuda (paso 3).'
        : '⏳ Dibuja o escribe tu planteamiento para habilitar la ayuda.';
    status.classList.toggle('text-green-700', ready);
    status.classList.toggle('text-gray-500', !ready);

    document.getElementById('help-section')?.classList.toggle('help-waiting', !ready);
}

export function resetApproach() {
    const input = document.getElementById('approach-input');
    if (input) input.value = '';
    updateApproachStatus();
}

export function setupPlanteaPrimero(tutor) {
    // Paso 1: tomar foto (abre la cámara trasera en el celular) o subir desde la galería.
    const bindFileInput = (inputId) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (file) tutor.handleExerciseImagePaste(file);
            input.value = ''; // permite volver a elegir la misma foto
        });
    };
    bindFileInput('exercise-camera-input');
    bindFileInput('exercise-file-input');

    document.getElementById('take-photo-btn')?.addEventListener('click', () => {
        document.getElementById('exercise-camera-input')?.click();
    });
    document.getElementById('upload-photo-btn')?.addEventListener('click', () => {
        document.getElementById('exercise-file-input')?.click();
    });

    // Paso 2: cualquier texto o trazo actualiza el estado.
    document.getElementById('approach-input')?.addEventListener('input', updateApproachStatus);
    const canvas = window.whiteboard?.canvas || document.getElementById('whiteboard');
    canvas?.addEventListener('pointerup', () => setTimeout(updateApproachStatus, 0));

    // Limpiar ejercicio, limpiar pizarra o deshacer también pueden cambiar el estado.
    ['clear-exercise', 'clear-all', 'undo-action', 'redo-action'].forEach((id) => {
        document.getElementById(id)?.addEventListener('click', () => {
            if (id === 'clear-exercise' || id === 'clear-all') resetApproach();
            setTimeout(updateApproachStatus, 50);
        });
    });

    updateApproachStatus();
}
