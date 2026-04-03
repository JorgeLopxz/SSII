import { convertUnits, normalizeUnit } from './converter.js';
import { showFeedback } from './feedback.js';

const NUMBER_WORDS = {
    cero: 0,
    un: 1,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
    veinte: 20,
    veintiuno: 21,
    veintidos: 22,
    veintitres: 23,
    veinticuatro: 24,
    veinticinco: 25,
    veintiseis: 26,
    veintisiete: 27,
    veintiocho: 28,
    veintinueve: 29,
    treinta: 30,
    medio: 0.5,
    media: 0.5
};

const normalizeText = (text) => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

const includesAny = (text, options) => options.some((option) => text.includes(option));

const parseSpokenNumber = (rawNumberText) => {
    const text = normalizeText(rawNumberText);

    const withHalf = text.match(/^(.+)\s+y\s+medio$/);
    if (withHalf) {
        const base = parseSpokenNumber(withHalf[1]);
        if (Number.isFinite(base)) {
            return base + 0.5;
        }
    }

    if (/^\d+(?:[.,]\d+)?$/.test(text)) {
        return parseFloat(text.replace(',', '.'));
    }

    if (text.includes('coma')) {
        const parts = text.split(/\s+coma\s+/);
        if (parts.length === 2) {
            const integerPart = parseSpokenNumber(parts[0]);
            if (!Number.isFinite(integerPart)) {
                return Number.NaN;
            }

            const decimalText = parts[1].trim();
            let decimalNumber;

            if (/^\d+$/.test(decimalText)) {
                decimalNumber = parseInt(decimalText, 10);
            } else if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, decimalText)) {
                decimalNumber = NUMBER_WORDS[decimalText];
            } else {
                return Number.NaN;
            }

            const decimalString = String(decimalNumber).replace('.', '');
            return parseFloat(`${integerPart}.${decimalString}`);
        }
    }

    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, text)) {
        return NUMBER_WORDS[text];
    }

    return Number.NaN;
};

const removeConverterNoise = (text) => {
    return text
        .replace(/\b(eh|mmm|porfa|por\s+favor|vale|oye|me|puedes|podrias|porfis)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

export const initVoiceModule = (tutorialApi) => {
    const btnMicro = document.getElementById('btn-micro');
    const btnStopMicro = document.getElementById('btn-stop-micro');
    const heardText = document.getElementById('texto-escuchado');
    const converterResult = document.getElementById('resultado-conversor');
    const micStatus = document.getElementById('estado-micro');

    let micActive = false;
    let manualStop = false;
    let keepListening = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const updateMicStatus = (status, message) => {
        micStatus.className = `estado-micro estado-${status}`;
        micStatus.innerText = message;
    };

    if (!SpeechRecognition) {
        heardText.innerText = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome.';
        showFeedback('Reconocimiento de voz no disponible en este navegador.');
        updateMicStatus('error', 'No compatible');
        btnMicro.classList.add('is-hidden');
        btnStopMicro.classList.add('is-hidden');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = false;

    const stopMic = (message) => {
        if (!micActive) {
            updateMicStatus('idle', 'Microfono apagado');
            keepListening = false;
            return;
        }

        keepListening = false;
        manualStop = true;
        recognition.stop();
        heardText.innerText = '"Microfono apagado"';
        showFeedback(message);
    };

    btnMicro.addEventListener('click', () => {
        if (micActive) {
            showFeedback('El microfono ya esta activo.');
            return;
        }

        keepListening = true;
        try {
            recognition.start();
        } catch (error) {
            console.error('No se pudo iniciar el reconocimiento:', error);
            updateMicStatus('error', 'Error al iniciar');
            showFeedback('No se pudo activar el microfono. Intentalo de nuevo.');
        }
    });

    btnStopMicro.addEventListener('click', () => {
        stopMic('Microfono detenido por el usuario.');
    });

    recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const result = event.results[lastIndex];

        if (!result.isFinal) {
            return;
        }

        const originalTranscript = result[0].transcript.trim();
        const transcript = normalizeText(originalTranscript);

        heardText.innerText = `"${originalTranscript}"`;
        converterResult.innerText = '';
        updateMicStatus('processing', 'Procesando comando...');

        let recognizedCommand = false;

        if (includesAny(transcript, ['siguiente', 'avanza', 'continua'])) {
            const output = tutorialApi.nextManualStep();
            showFeedback(output.message);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['atras', 'retrocede', 'anterior'])) {
            const output = tutorialApi.previousManualStep();
            showFeedback(output.message);
            recognizedCommand = true;
        }

        if (includesAny(transcript, [
            'reproduce',
            'reproducir',
            'reproduce video',
            'reproducir video',
            'pon el video',
            'inicia video',
            'reanuda',
            'play'
        ])) {
            tutorialApi.playVideo().then((output) => {
                showFeedback(output.message);
            });
            recognizedCommand = true;
        }

        if (includesAny(transcript, [
            'pausa',
            'pausar',
            'pausar video',
            'pausa video',
            'deten video',
            'detener video',
            'para video',
            'parar video',
            'stop video'
        ])) {
            const output = tutorialApi.pauseVideo();
            showFeedback(output.message);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['adelanta 10', 'avanza 10', 'adelantar 10', 'mas 10 segundos', 'avance 10 segundos'])) {
            const output = tutorialApi.seekVideo(10);
            showFeedback(output.message);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['retrocede 10', 'atras 10', 'retroceder 10', 'retrasar 10', 'menos 10 segundos'])) {
            const output = tutorialApi.seekVideo(-10);
            showFeedback(output.message);
            recognizedCommand = true;
        }

        const minuteMatch = transcript.match(/(?:ve|ir|vete|salta|mueve)(?:\s+al?)?\s+minut(?:o|os)\s+([a-z0-9.,]+)/i);
        if (minuteMatch) {
            const minuteValue = parseSpokenNumber(minuteMatch[1]);
            if (Number.isFinite(minuteValue) && minuteValue >= 0) {
                const output = tutorialApi.goToTime(minuteValue * 60);
                showFeedback(output.message);
            } else {
                showFeedback('No he entendido el minuto indicado.');
            }
            recognizedCommand = true;
        }

        const secondMatch = transcript.match(/(?:ve|ir|vete|salta|mueve)(?:\s+al?)?\s+segund(?:o|os)\s+([a-z0-9.,]+)/i);
        if (secondMatch) {
            const secondValue = parseSpokenNumber(secondMatch[1]);
            if (Number.isFinite(secondValue) && secondValue >= 0) {
                const output = tutorialApi.goToTime(secondValue);
                showFeedback(output.message);
            } else {
                showFeedback('No he entendido el segundo indicado.');
            }
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['sube volumen', 'aumenta volumen', 'mas volumen'])) {
            const output = tutorialApi.changeVolume(0.1);
            showFeedback(output.message);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['baja volumen', 'disminuye volumen', 'menos volumen'])) {
            const output = tutorialApi.changeVolume(-0.1);
            showFeedback(output.message);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['silencio', 'apaga microfono', 'deten microfono', 'detener escucha', 'deja de escuchar'])) {
            stopMic('Microfono apagado por comando de voz.');
            recognizedCommand = true;
        }

        const converterCommands = ['convierte', 'pasa', 'cambia', 'cuanto es', 'cuantos son', 'cuantas son'];
        const isConverterCommand = includesAny(transcript, converterCommands);

        if (isConverterCommand) {
            const converterTranscript = removeConverterNoise(transcript);

            const regex = /(?:convierte|pasa|cambia|cuanto es|cuantos son|cuantas son)?\s*(?:de\s+)?([a-z0-9.,]+(?:\s+(?:coma|y)\s+[a-z0-9]+)?)\s+([a-z]+)(?:\s+y\s+medio)?\s+(?:a|en)\s+([a-z]+)/i;
            const regexNumberUnitAndHalf = /(?:convierte|pasa|cambia|cuanto es|cuantos son|cuantas son)?\s*(?:de\s+)?([a-z0-9.,]+)\s+([a-z]+)\s+y\s+medio\s+(?:a|en)\s+([a-z]+)/i;
            const regexUnitAndHalf = /(?:convierte|pasa|cambia|cuanto es|cuantos son|cuantas son)?\s*(?:de\s+)?([a-z]+)\s+y\s+medio\s+(?:a|en)\s+([a-z]+)/i;

            let match = converterTranscript.match(regex);
            let forcedValue = null;

            const matchNumberUnitAndHalf = converterTranscript.match(regexNumberUnitAndHalf);
            if (matchNumberUnitAndHalf) {
                const base = parseSpokenNumber(matchNumberUnitAndHalf[1]);
                if (Number.isFinite(base)) {
                    forcedValue = base + 0.5;
                    match = [
                        matchNumberUnitAndHalf[0],
                        matchNumberUnitAndHalf[1],
                        matchNumberUnitAndHalf[2],
                        matchNumberUnitAndHalf[3]
                    ];
                }
            }

            if (!match) {
                const matchUnitAndHalf = converterTranscript.match(regexUnitAndHalf);
                if (matchUnitAndHalf) {
                    forcedValue = 1.5;
                    match = [
                        matchUnitAndHalf[0],
                        'uno y medio',
                        matchUnitAndHalf[1],
                        matchUnitAndHalf[2]
                    ];
                }
            }

            if (match) {
                const value = forcedValue ?? parseSpokenNumber(match[1]);

                if (!Number.isFinite(value)) {
                    converterResult.innerText = "No he entendido el numero. Prueba con '1' o 'uno'.";
                    showFeedback('Numero no reconocido en el comando de conversion.');
                    recognizedCommand = true;
                    if (micActive) {
                        updateMicStatus('listening', 'Escuchando...');
                    }
                    return;
                }

                const fromUnit = normalizeUnit(match[2]);
                const toUnit = normalizeUnit(match[3]);
                const resultValue = convertUnits(value, fromUnit, toUnit);

                if (resultValue !== null) {
                    converterResult.innerText = `${value} ${match[2]} = ${resultValue.toFixed(2)} ${match[3]}`;
                    showFeedback('Conversion calculada correctamente.');
                } else {
                    converterResult.innerText = `No se convertir de ${match[2]} a ${match[3]}.`;
                    showFeedback('No reconozco esa conversion. Prueba otra combinacion.');
                }
            } else {
                converterResult.innerText = "No te he entendido. Prueba con: 'pasa 5 metros a centimetros'.";
                showFeedback('Formato de conversion no valido.');
            }

            recognizedCommand = true;
        }

        if (!recognizedCommand) {
            showFeedback('Comando no reconocido. Prueba: reproduce, pausa, adelanta 10, ve al minuto 2, sube volumen o convierte.');
        }

        if (micActive) {
            updateMicStatus('listening', 'Escuchando...');
        }
    };

    recognition.onerror = (event) => {
        console.error('Error de voz:', event.error);
        updateMicStatus('error', 'Error de reconocimiento');
        showFeedback(`Error de voz (${event.error}). Prueba a reiniciar el microfono.`);
    };

    recognition.onstart = () => {
        micActive = true;
        manualStop = false;
        btnMicro.innerText = 'Escuchando...';
        btnMicro.classList.add('is-listening');
        btnStopMicro.classList.remove('is-hidden');
        updateMicStatus('listening', 'Escuchando...');
        showFeedback('Microfono activo. Esperando comandos.');
    };

    recognition.onend = () => {
        micActive = false;

        if (keepListening && !manualStop) {
            window.setTimeout(() => {
                try {
                    recognition.start();
                } catch (error) {
                    console.warn('No se pudo reiniciar el microfono automaticamente:', error);
                }
            }, 180);
            updateMicStatus('listening', 'Escuchando...');
            showFeedback('Escucha continua activa.');
            return;
        }

        btnMicro.innerText = 'Activar Microfono';
        btnMicro.classList.remove('is-listening');
        btnStopMicro.classList.add('is-hidden');

        manualStop = false;
        updateMicStatus('idle', 'Microfono apagado');
    };
};