// Foto del ejercicio: tomar con la cámara o elegir de la galería.
// Las fotos de celular suelen pesar 3–10 MB, así que se reducen y se pasan a JPEG
// antes de guardarlas. Así la solicitud a /api es liviana y siempre es image/jpeg.

const MAX_SIDE = 1600;     // px del lado más largo
const JPEG_QUALITY = 0.8;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export function readImageFileAsJpeg(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('El archivo no es una imagen. Elige una foto del ejercicio.'));
            return;
        }
        if (file.size > MAX_INPUT_BYTES) {
            reject(new Error('La imagen es demasiado grande (máximo 25 MB).'));
            return;
        }

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            } catch (error) {
                reject(error);
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo leer la imagen. Prueba con otra foto.'));
        };
        img.src = url;
    });
}

// Conecta los dos inputs (cámara y galería) a un callback que recibe el File.
export function setupPhotoInputs(inputIds, onFile) {
    for (const id of inputIds) {
        const input = document.getElementById(id);
        if (!input) continue;
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (file) onFile(file);
            input.value = ''; // permite volver a elegir la misma foto
        });
    }
}
