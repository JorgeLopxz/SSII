import { convertUnits, normalizeUnit } from './conversor.js';
import { cancelarRetroalimentacionHablada, mostrarRetroalimentacion, hablarRetroalimentacion } from './retroalimentacion.js';

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

export const inicializarModuloVoz = (tutorialApi, moduloGestos) => {
    const btnMicro = document.getElementById('btn-microfono');
    const btnStopMicro = document.getElementById('btn-detener-microfono');
    const heardText = document.getElementById('texto-escuchado');
    const converterResult = document.getElementById('resultado-conversor');
    const micStatus = document.getElementById('estado-microfono');

    let micActive = false;
    let manualStop = false;
    let keepListening = false;
    let isSpeakingFeedback = false;
    let lastError = null;
    let restartTimeout = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const updateMicStatus = (status, message) => {
        micStatus.className = `estado-microfono estado-${status}`;
        micStatus.innerText = message;
    };

    const respond = (message, shouldSpeak = true) => {
        mostrarRetroalimentacion(message);

        if (!shouldSpeak) {
            return;
        }

        isSpeakingFeedback = true;
        hablarRetroalimentacion(message, () => {
            isSpeakingFeedback = false;
        });
    };

    if (!SpeechRecognition) {
        heardText.innerText = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome.';
        mostrarRetroalimentacion('Reconocimiento de voz no disponible en este navegador.');
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
        if (!micActive && !keepListening) {
            updateMicStatus('idle', 'Desactivado');
            keepListening = false;
            if (moduloGestos && moduloGestos.estaActivo()) {
                moduloGestos.desactivarGestos();
            }
            return;
        }

        keepListening = false;
        manualStop = true;
        lastError = null;
        
        if (restartTimeout) {
            clearTimeout(restartTimeout);
            restartTimeout = null;
        }
        
        try {
            recognition.stop();
        } catch (error) {
            console.warn('Error deteniendo reconocimiento:', error);
        }
        
        cancelarRetroalimentacionHablada();
        isSpeakingFeedback = false;
        heardText.innerText = '"Asistente detenido"';
        respond(message, true);
        
        if (moduloGestos && moduloGestos.estaActivo()) {
            moduloGestos.desactivarGestos();
        }
    };

    btnMicro.addEventListener('click', () => {
        if (micActive || keepListening) {
            respond('El asistente ya esta activo.', false);
            return;
        }

        keepListening = true;
        manualStop = false;
        lastError = null;
        
        if (moduloGestos) {
            moduloGestos.activarGestos();
        }
        
        try {
            recognition.start();
        } catch (error) {
            console.error('No se pudo iniciar el reconocimiento:', error);
            updateMicStatus('error', 'Error al iniciar');
            keepListening = false;
            respond('No se pudo activar el asistente. Intentalo de nuevo.', false);
        }
    });

    btnStopMicro.addEventListener('click', () => {
        stopMic('Micrófono detenido por el usuario.');
    });

    recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const result = event.results[lastIndex];

        if (!result.isFinal) {
            return;
        }

        if (isSpeakingFeedback) {
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
            respond(output.message, true);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['atras', 'retrocede', 'anterior'])) {
            const output = tutorialApi.previousManualStep();
            respond(output.message, true);
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
                respond(output.message, true);
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
            respond(output.message, true);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['adelanta 10', 'avanza 10', 'adelantar 10', 'mas 10 segundos', 'avance 10 segundos'])) {
            const output = tutorialApi.seekVideo(10);
            respond(output.message, true);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['retrocede 10', 'atras 10', 'retroceder 10', 'retrasar 10', 'menos 10 segundos'])) {
            const output = tutorialApi.seekVideo(-10);
            respond(output.message, true);
            recognizedCommand = true;
        }

        const minuteMatch = transcript.match(/(?:ve|ir|vete|salta|mueve)(?:\s+al?)?\s+minut(?:o|os)\s+([a-z0-9.,]+)/i);
        if (minuteMatch) {
            const minuteValue = parseSpokenNumber(minuteMatch[1]);
            if (Number.isFinite(minuteValue) && minuteValue >= 0) {
                const output = tutorialApi.goToTime(minuteValue * 60);
                respond(output.message, true);
            } else {
                respond('No he entendido el minuto indicado.', true);
            }
            recognizedCommand = true;
        }

        const secondMatch = transcript.match(/(?:ve|ir|vete|salta|mueve)(?:\s+al?)?\s+segund(?:o|os)\s+([a-z0-9.,]+)/i);
        if (secondMatch) {
            const secondValue = parseSpokenNumber(secondMatch[1]);
            if (Number.isFinite(secondValue) && secondValue >= 0) {
                const output = tutorialApi.goToTime(secondValue);
                respond(output.message, true);
            } else {
                respond('No he entendido el segundo indicado.', true);
            }
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['sube volumen', 'aumenta volumen', 'mas volumen'])) {
            const output = tutorialApi.changeVolume(0.1);
            respond(output.message, true);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['baja volumen', 'disminuye volumen', 'menos volumen'])) {
            const output = tutorialApi.changeVolume(-0.1);
            respond(output.message, true);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['fijar nivel', 'confirmar paso', 'confirmar', 'paso confirmado', 'siguiente paso'])) {
            const visorManual = document.getElementById('visor-manual');
            if (visorManual) {
                visorManual.style.backgroundColor = '#4caf50';
                window.setTimeout(() => {
                    visorManual.style.backgroundColor = '#fff3e0';
                }, 280);
            }
            respond('Paso confirmado. Puedes continuar.', true);
            recognizedCommand = true;
        }

        if (includesAny(transcript, ['toma una foto', 'captura el progreso', 'captura una foto', 'toma foto', 'captura foto', 'foto'])) {
            if (moduloGestos && typeof moduloGestos.tomarFoto === 'function') {
                const exito = moduloGestos.tomarFoto();
                if (exito) {
                    respond('Foto capturada. Se ha guardado el progreso.', true);
                } else {
                    respond('No se pudo capturar la foto. Asegúrate que la cámara esté activa.', true);
                }
            } else {
                respond('La función de captura no está disponible en este momento.', true);
            }
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
                    respond('Numero no reconocido en el comando de conversion.', true);
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
                    respond(`${value} ${match[2]} son ${resultValue.toFixed(2)} ${match[3]}.`, true);
                } else {
                    converterResult.innerText = `No se convertir de ${match[2]} a ${match[3]}.`;
                    respond('No reconozco esa conversion. Prueba otra combinacion.', true);
                }
            } else {
                converterResult.innerText = "No te he entendido. Prueba con: 'pasa 5 metros a centimetros'.";
                respond('Formato de conversion no valido.', true);
            }

            recognizedCommand = true;
        }

        if (!recognizedCommand) {
            respond('Comando no reconocido. Prueba: reproduce, pausa, adelanta 10, ve al minuto 2, sube volumen, convierte, o di "silencio" para detener el micrófono.', false);
        }

        if (micActive) {
            updateMicStatus('listening', 'Escuchando...');
        }
    };

    recognition.onerror = (event) => {
        console.error('Error de voz:', event.error);
        
        // Ignorar errores no graves o esperados
        if (event.error === 'no-speech' || event.error === 'aborted') {
            return; // Sin voz detectada o sesión abortada internamente, ignorar
        }
        
        // Guardar el error para saber si reintentar en onend
        lastError = event.error;
        console.warn(`Error grave: ${event.error}`);
        updateMicStatus('error', `Error: ${event.error}`);
    };

    recognition.onstart = () => {
        console.log('Reconocimiento iniciado');
        micActive = true;
        manualStop = false;
        lastError = null;
        
        if (restartTimeout) {
            clearTimeout(restartTimeout);
            restartTimeout = null;
        }
        
        btnMicro.innerText = 'Asistente activo...';
        btnMicro.classList.add('is-listening');
        btnStopMicro.classList.remove('is-hidden');
        updateMicStatus('listening', 'Activo (Voz + Gestos)');
        respond('Asistente multimodal activo. Puedes usar voz o gestos.', false);
    };

    recognition.onend = () => {
        console.log(`onend: micActive=${micActive}, keepListening=${keepListening}, lastError=${lastError}`);
        micActive = false;

        // Si se detuvo manualmente, finalizar completamente
        if (manualStop || !keepListening) {
            console.log('Parando: detenido manualmente');
            lastError = null;
            btnMicro.innerText = 'Activar Asistente (Voz + Gestos)';
            btnMicro.classList.remove('is-listening');
            btnStopMicro.classList.add('is-hidden');
            updateMicStatus('idle', 'Micrófono apagado');
            return;
        }

        // Si hay error previo grave, reintentar con delay y mostrar aviso
        if (lastError) {
            console.log(`Reintentando tras error: ${lastError}`);
            updateMicStatus('processing', 'Reconectando...');
            
            if (restartTimeout) clearTimeout(restartTimeout);
            
            restartTimeout = window.setTimeout(() => {
                if (keepListening && !manualStop) {
                    try {
                        recognition.start();
                    } catch (error) {
                        console.error('Error al reintentar:', error);
                        lastError = null;
                    }
                }
                restartTimeout = null;
            }, 1500);
            return;
        }

        // Sin error = timeout natural del navegador → reiniciar inmediatamente y en silencio
        console.log('Reinicio silencioso por timeout natural');
        if (restartTimeout) clearTimeout(restartTimeout);
        
        // Reinicio casi inmediato (50ms) para que no haya gap perceptible
        restartTimeout = window.setTimeout(() => {
            if (keepListening && !manualStop) {
                try {
                    recognition.start();
                } catch (error) {
                    console.warn('Error en reinicio silencioso:', error);
                }
            }
            restartTimeout = null;
        }, 50);
};}