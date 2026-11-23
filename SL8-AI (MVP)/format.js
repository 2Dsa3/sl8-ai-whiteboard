// Utilidades de texto para mostrar respuestas de la IA sin riesgo de inyectar HTML.

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Envuelve los tramos entre pares de `marker` (por ejemplo **negrita**). Un marcador sin pareja se deja tal cual.
function wrapPairs(text, marker, open, close) {
    const pieces = text.split(marker);
    if (pieces.length < 3) return text;
    let out = pieces[0];
    for (let i = 1; i < pieces.length; i++) {
        const opening = i % 2 === 1;
        if (opening && i === pieces.length - 1) {
            out += marker + pieces[i]; // eslint-disable-line security/detect-object-injection
        } else {
            out += (opening ? open : close) + pieces[i]; // eslint-disable-line security/detect-object-injection
        }
    }
    return out;
}

// Formato en línea: **negrita** y `código`. Se aplica sobre texto ya escapado.
function formatInline(text) {
    const withCode = wrapPairs(text, '`', '<code class="bg-gray-100 px-1 rounded">', '</code>');
    return wrapPairs(withCode, '**', '<strong>', '</strong>');
}

// Devuelve el resto de la línea si empieza con el prefijo indicado (sin regex con retroceso).
function stripPrefix(line, re) {
    const trimmed = line.trimStart();
    const match = re.exec(trimmed);
    return match ? trimmed.slice(match[0].length).trim() : null;
}
const BULLET_RE = /^[-*•] /;
const NUMBERED_RE = /^\d{1,3}[.)] /;
const HEADING_RE = /^#{1,6} /;

// Markdown mínimo (lo que suelen devolver los modelos) convertido a HTML seguro.
export function formatAIText(rawText) {
    const lines = escapeHtml(rawText).split(/\r?\n/);
    const html = [];
    let listType = null;

    const closeList = () => {
        if (listType) {
            html.push(listType === 'ul' ? '</ul>' : '</ol>');
            listType = null;
        }
    };
    const openList = (type) => {
        if (listType !== type) {
            closeList();
            html.push(type === 'ul' ? '<ul class="list-disc pl-5 my-1">' : '<ol class="list-decimal pl-5 my-1">');
            listType = type;
        }
    };

    for (const line of lines) {
        const bullet = stripPrefix(line, BULLET_RE);
        const numbered = bullet === null ? stripPrefix(line, NUMBERED_RE) : null;
        const heading = stripPrefix(line, HEADING_RE);

        if (bullet !== null) {
            openList('ul');
            html.push(`<li>${formatInline(bullet)}</li>`);
        } else if (numbered !== null) {
            openList('ol');
            html.push(`<li>${formatInline(numbered)}</li>`);
        } else if (heading !== null) {
            closeList();
            html.push(`<p class="font-semibold mt-2">${formatInline(heading)}</p>`);
        } else if (line.trim() === '') {
            closeList();
        } else {
            closeList();
            html.push(`<p class="my-1">${formatInline(line)}</p>`);
        }
    }
    closeList();
    return html.join('');
}
