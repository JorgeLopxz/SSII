let feedbackElement = null;
let activeUtterance = null;

export const initFeedback = () => {
    feedbackElement = document.getElementById('voz-feedback');
};

export const showFeedback = (message) => {
    if (!feedbackElement) {
        return;
    }

    feedbackElement.innerText = message;
};

export const speakFeedback = (message, onEnd) => {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
        if (typeof onEnd === 'function') {
            onEnd();
        }
        return;
    }

    const text = String(message || '').trim();
    if (!text) {
        if (typeof onEnd === 'function') {
            onEnd();
        }
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
        activeUtterance = null;
        if (typeof onEnd === 'function') {
            onEnd();
        }
    };

    utterance.onerror = () => {
        activeUtterance = null;
        if (typeof onEnd === 'function') {
            onEnd();
        }
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
};

export const cancelSpokenFeedback = () => {
    if (!('speechSynthesis' in window)) {
        return;
    }

    if (activeUtterance) {
        window.speechSynthesis.cancel();
        activeUtterance = null;
    }
};