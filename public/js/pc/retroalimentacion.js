let elementoRetroalimentacion = null;
let mensajeActivo = null;

export const inicializarRetroalimentacion = () => {
    elementoRetroalimentacion = document.getElementById('voz-feedback');
};

export const mostrarRetroalimentacion = (mensaje) => {
    if (!elementoRetroalimentacion) {
        return;
    }

    elementoRetroalimentacion.innerText = mensaje;
};

export const hablarRetroalimentacion = (mensaje, alFinalizar) => {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
        if (typeof alFinalizar === 'function') {
            alFinalizar();
        }
        return;
    }

    const texto = String(mensaje || '').trim();
    if (!texto) {
        if (typeof alFinalizar === 'function') {
            alFinalizar();
        }
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
        mensajeActivo = null;
        if (typeof alFinalizar === 'function') {
            alFinalizar();
        }
    };

    utterance.onerror = () => {
        mensajeActivo = null;
        if (typeof alFinalizar === 'function') {
            alFinalizar();
        }
    };

    mensajeActivo = utterance;
    window.speechSynthesis.speak(utterance);
};

export const cancelarRetroalimentacionHablada = () => {
    if (!('speechSynthesis' in window)) {
        return;
    }

    if (mensajeActivo) {
        window.speechSynthesis.cancel();
        mensajeActivo = null;
    }
};