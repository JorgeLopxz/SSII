const socket = io();

const burbuja = document.getElementById('nivel-burbuja');
const texto = document.getElementById('nivel-texto');
const tubo = document.getElementById('nivel-tubo');
const estadoSensores = document.getElementById('estado-sensores');
const btnCalibrar = document.getElementById('btn-calibrar');
const btnResetCalibracion = document.getElementById('btn-reset-calibracion');

const LIMITE_VISUAL = 45;
const TOLERANCIA_NIVEL = 2;
const FACTOR_SUAVIZADO = 0.25;
const TIMEOUT_SIN_DATOS_MS = 3000;

let ultimaInclinacionRaw = null;
let inclinacionSuavizada = null;
let offsetCalibracion = 0;
let ultimoDatoTimestamp = 0;

const actualizarEstadoSensores = (estado, mensaje) => {
    estadoSensores.className = `estado-sensores estado-sensor-${estado}`;
    estadoSensores.innerText = mensaje;
};

const resetVisualNivel = (mensaje) => {
    texto.innerText = mensaje;
    texto.style.color = '#6b5744';
    burbuja.style.left = '50%';
    burbuja.style.filter = 'saturate(0.9)';
    tubo.style.borderColor = 'rgba(138, 90, 45, 0.52)';
};

const renderizarNivel = (inclinacion) => {
    let porcentajeMovimiento = (inclinacion / LIMITE_VISUAL) * 50;

    if (porcentajeMovimiento > 50) porcentajeMovimiento = 50;
    if (porcentajeMovimiento < -50) porcentajeMovimiento = -50;

    burbuja.style.left = `calc(50% + ${porcentajeMovimiento}%)`;

    if (Math.abs(inclinacion) <= TOLERANCIA_NIVEL) {
        burbuja.style.filter = 'hue-rotate(60deg) saturate(1.4)';
        tubo.style.borderColor = '#2e8b57';
        texto.style.color = '#2e8b57';
        texto.innerText = '¡NIVELADO! (0º)';
        return;
    }

    burbuja.style.filter = 'hue-rotate(-18deg) saturate(1.2)';
    tubo.style.borderColor = 'rgba(138, 90, 45, 0.52)';
    texto.style.color = '#35261a';
    texto.innerText = `Inclinación: ${inclinacion.toFixed(1)}º`;
};

socket.on('connect', () => {
    socket.emit('register_role', 'pc');
    actualizarEstadoSensores('warn', 'PC conectado. Esperando móvil...');
});

socket.on('disconnect', () => {
    actualizarEstadoSensores('error', 'Sin conexión con el servidor');
    resetVisualNivel('Sin conexión de red.');
});

socket.on('sensor_status', (info) => {
    if (!info || !info.state) {
        return;
    }

    if (info.state === 'streaming') {
        actualizarEstadoSensores('ok', 'Móvil activo enviando datos');
        return;
    }

    if (info.state === 'connected') {
        actualizarEstadoSensores('warn', 'Móvil conectado (sin datos aún)');
        return;
    }

    if (info.state === 'disconnected') {
        actualizarEstadoSensores('offline', 'Sin sensores');
        resetVisualNivel('Esperando datos del móvil...');
    }
});

// Escuchamos el evento que envía el servidor
socket.on('update_pc_level', (data) => {
    if (!data || typeof data.tilt !== 'number') {
        return;
    }

    ultimaInclinacionRaw = data.tilt;
    ultimoDatoTimestamp = Date.now();
    actualizarEstadoSensores('ok', 'Móvil activo enviando datos');

    const inclinacionCalibrada = ultimaInclinacionRaw - offsetCalibracion;
    if (inclinacionSuavizada === null) {
        inclinacionSuavizada = inclinacionCalibrada;
    } else {
        inclinacionSuavizada = (inclinacionSuavizada * (1 - FACTOR_SUAVIZADO)) + (inclinacionCalibrada * FACTOR_SUAVIZADO);
    }

    renderizarNivel(inclinacionSuavizada);
});

setInterval(() => {
    if (ultimoDatoTimestamp === 0) {
        return;
    }

    const sinDatos = Date.now() - ultimoDatoTimestamp > TIMEOUT_SIN_DATOS_MS;
    if (!sinDatos) {
        return;
    }

    actualizarEstadoSensores('offline', 'Sin sensores (sin datos recientes)');
    resetVisualNivel('Sin datos del móvil. Revisa la conexión.');
    ultimoDatoTimestamp = 0;
    inclinacionSuavizada = null;
}, 1000);

btnCalibrar.addEventListener('click', () => {
    if (ultimaInclinacionRaw === null) {
        return;
    }

    offsetCalibracion = ultimaInclinacionRaw;
    inclinacionSuavizada = 0;
    renderizarNivel(0);
    if (typeof mostrarFeedback === 'function') {
        mostrarFeedback(`Calibración aplicada. Offset: ${offsetCalibracion.toFixed(1)}º`);
    }
});

btnResetCalibracion.addEventListener('click', () => {
    offsetCalibracion = 0;
    inclinacionSuavizada = null;
    if (typeof mostrarFeedback === 'function') {
        mostrarFeedback('Calibración reiniciada.');
    }
});

// --- MÓDULO DE VOZ (Web Speech API) ---

const btnMicro = document.getElementById('btn-micro');
const btnStopMicro = document.getElementById('btn-stop-micro');
const textoEscuchado = document.getElementById('texto-escuchado');
const resultadoConversor = document.getElementById('resultado-conversor');
const estadoMicro = document.getElementById('estado-micro');
const vozFeedback = document.getElementById('voz-feedback');

// Elementos del "Tutorial Ficticio"
const visorManual = document.getElementById('visor-manual');
const estadoManual = document.getElementById('estado-manual');
const visorVideo = document.getElementById('visor-video');

let pasoActual = 1;
const pasosTotales = 5;
let microActivo = false;
let paradaManual = false;

// Comprobamos si el navegador soporta la API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const normalizarTexto = (texto) => {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

const incluyeCualquiera = (texto, opciones) => opciones.some((opcion) => texto.includes(opcion));

const actualizarEstadoMicro = (estado, mensaje) => {
    estadoMicro.className = `estado-micro estado-${estado}`;
    estadoMicro.innerText = mensaje;
};

const mostrarFeedback = (mensaje) => {
    vozFeedback.innerText = mensaje;
};

const normalizarUnidad = (unidad) => {
    if (['cm', 'centimetro', 'centimetros'].includes(unidad)) return 'cm';
    if (['m', 'metro', 'metros'].includes(unidad)) return 'm';
    if (['pulgada', 'pulgadas', 'inch', 'in'].includes(unidad)) return 'in';
    if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(unidad)) return 'kg';
    if (['libra', 'libras', 'lb', 'lbs'].includes(unidad)) return 'lb';
    return unidad;
};

const convertirMedidas = (valor, unidadOrigen, unidadDestino) => {
    if (unidadOrigen === 'cm' && unidadDestino === 'in') return valor / 2.54;
    if (unidadOrigen === 'in' && unidadDestino === 'cm') return valor * 2.54;
    if (unidadOrigen === 'm' && unidadDestino === 'cm') return valor * 100;
    if (unidadOrigen === 'cm' && unidadDestino === 'm') return valor / 100;
    if (unidadOrigen === 'm' && unidadDestino === 'in') return valor * 39.3701;
    if (unidadOrigen === 'in' && unidadDestino === 'm') return valor / 39.3701;
    if (unidadOrigen === 'kg' && unidadDestino === 'lb') return valor * 2.20462;
    if (unidadOrigen === 'lb' && unidadDestino === 'kg') return valor / 2.20462;
    return null;
};

const numerosPalabra = {
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

const parsearNumeroVoz = (numeroTexto) => {
    const texto = normalizarTexto(numeroTexto);

    const matchYMedio = texto.match(/^(.+)\s+y\s+medio$/);
    if (matchYMedio) {
        const base = parsearNumeroVoz(matchYMedio[1]);
        if (Number.isFinite(base)) {
            return base + 0.5;
        }
    }

    if (/^\d+(?:[.,]\d+)?$/.test(texto)) {
        return parseFloat(texto.replace(',', '.'));
    }

    if (texto.includes('coma')) {
        const partes = texto.split(/\s+coma\s+/);
        if (partes.length === 2) {
            const entero = parsearNumeroVoz(partes[0]);
            if (!Number.isFinite(entero)) {
                return NaN;
            }

            const decTexto = partes[1].trim();
            let decNumero;

            if (/^\d+$/.test(decTexto)) {
                decNumero = parseInt(decTexto, 10);
            } else if (Object.prototype.hasOwnProperty.call(numerosPalabra, decTexto)) {
                decNumero = numerosPalabra[decTexto];
            } else {
                return NaN;
            }

            const decCadena = String(decNumero).replace('.', '');
            return parseFloat(`${entero}.${decCadena}`);
        }
    }

    if (Object.prototype.hasOwnProperty.call(numerosPalabra, texto)) {
        return numerosPalabra[texto];
    }

    return NaN;
};

const limpiarRuidoConversor = (texto) => {
    return texto
        .replace(/\b(eh|mmm|porfa|por\s+favor|vale|oye|me|puedes|podrias|porfis)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const siguientePasoManual = () => {
    if (pasoActual < pasosTotales) {
        pasoActual++;
        visorManual.innerText = `Paso ${pasoActual}: Acción de bricolaje`;
        estadoManual.innerText = `Página ${pasoActual} / ${pasosTotales}`;
        visorManual.style.backgroundColor = '#335533';
        setTimeout(() => {
            visorManual.style.backgroundColor = '#111';
        }, 500);
        mostrarFeedback('He avanzado al siguiente paso del manual.');
    } else {
        mostrarFeedback('Ya estás en el último paso del manual.');
    }
};

const pasoAnteriorManual = () => {
    if (pasoActual > 1) {
        pasoActual--;
        visorManual.innerText = `Paso ${pasoActual}: Acción de bricolaje`;
        estadoManual.innerText = `Página ${pasoActual} / ${pasosTotales}`;
        visorManual.style.backgroundColor = '#553333';
        setTimeout(() => {
            visorManual.style.backgroundColor = '#111';
        }, 500);
        mostrarFeedback('He retrocedido al paso anterior del manual.');
    } else {
        mostrarFeedback('Ya estás en la primera página del manual.');
    }
};

const reproducirVideo = () => {
    visorVideo.innerHTML = '▶️ REPRODUCIENDO...';
    visorVideo.style.borderColor = '#00ff00';
    mostrarFeedback('Vídeo en reproducción.');
};

const pausarVideo = () => {
    visorVideo.innerHTML = '⏸️ PAUSADO';
    visorVideo.style.borderColor = '#ff3333';
    mostrarFeedback('Vídeo pausado.');
};

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES'; 
    recognition.continuous = true; 
    recognition.interimResults = false; 

    const detenerMicrofono = (mensaje) => {
        if (!microActivo) {
            actualizarEstadoMicro('idle', 'Micrófono apagado');
            return;
        }

        paradaManual = true;
        recognition.stop();
        textoEscuchado.innerText = '"Micrófono apagado"';
        mostrarFeedback(mensaje);
    };

    // --- Control de Botones ---
    btnMicro.addEventListener('click', () => {
        if (microActivo) {
            mostrarFeedback('El micrófono ya está activo.');
            return;
        }

        try {
            recognition.start();
        } catch (error) {
            console.error('No se pudo iniciar el reconocimiento:', error);
            actualizarEstadoMicro('error', 'Error al iniciar');
            mostrarFeedback('No se pudo activar el micrófono. Inténtalo de nuevo.');
        }
    });

    btnStopMicro.addEventListener('click', () => {
        detenerMicrofono('Micrófono detenido por el usuario.');
    });

    // --- Procesar la Voz ---
    recognition.onresult = (event) => {
        const ultimaFraseIndex = event.results.length - 1;
        const resultado = event.results[ultimaFraseIndex];

        if (!resultado.isFinal) {
            return;
        }

        const transcripcionOriginal = resultado[0].transcript.trim();
        const transcripcion = normalizarTexto(transcripcionOriginal);
        
        textoEscuchado.innerText = `"${transcripcionOriginal}"`;
        resultadoConversor.innerText = '';
        actualizarEstadoMicro('processing', 'Procesando comando...');

        let comandoReconocido = false;

        if (incluyeCualquiera(transcripcion, ['siguiente', 'avanza', 'continua'])) {
            siguientePasoManual();
            comandoReconocido = true;
        }

        if (incluyeCualquiera(transcripcion, ['atras', 'retrocede', 'anterior'])) {
            pasoAnteriorManual();
            comandoReconocido = true;
        }

        if (incluyeCualquiera(transcripcion, ['reproduce', 'play', 'reanuda'])) {
            reproducirVideo();
            comandoReconocido = true;
        }

        if (incluyeCualquiera(transcripcion, ['pausa', 'deten video', 'para video'])) {
            pausarVideo();
            comandoReconocido = true;
        }

        if (incluyeCualquiera(transcripcion, ['silencio', 'apaga microfono', 'deten microfono'])) {
            detenerMicrofono('Micrófono apagado por comando de voz.');
            comandoReconocido = true;
        }

        const comandosConversor = ['convierte', 'pasa', 'cambia', 'cuanto es', 'cuantos son', 'cuantas son'];
        const esComandoConversor = incluyeCualquiera(transcripcion, comandosConversor);

        if (esComandoConversor) {
            const transcripcionConversor = limpiarRuidoConversor(transcripcion);

            // Permite frases como:
            // "pasa 1 metro a pulgadas", "pasa de un metro a pulgadas", "convierte uno coma cinco m a cm"
            const regex = /(?:convierte|pasa|cambia|cuanto es|cuantos son|cuantas son)?\s*(?:de\s+)?([a-z0-9.,]+(?:\s+(?:coma|y)\s+[a-z0-9]+)?)\s+([a-z]+)(?:\s+y\s+medio)?\s+(?:a|en)\s+([a-z]+)/i;
            const regexNumeroUnidadYMedio = /(?:convierte|pasa|cambia|cuanto es|cuantos son|cuantas son)?\s*(?:de\s+)?([a-z0-9.,]+)\s+([a-z]+)\s+y\s+medio\s+(?:a|en)\s+([a-z]+)/i;
            const regexUnidadYMedio = /(?:convierte|pasa|cambia|cuanto es|cuantos son|cuantas son)?\s*(?:de\s+)?([a-z]+)\s+y\s+medio\s+(?:a|en)\s+([a-z]+)/i;

            let match = transcripcionConversor.match(regex);
            let valorForzado = null;

            const matchNumeroUnidadYMedio = transcripcionConversor.match(regexNumeroUnidadYMedio);
            if (matchNumeroUnidadYMedio) {
                const base = parsearNumeroVoz(matchNumeroUnidadYMedio[1]);
                if (Number.isFinite(base)) {
                    valorForzado = base + 0.5;
                    match = [
                        matchNumeroUnidadYMedio[0],
                        matchNumeroUnidadYMedio[1],
                        matchNumeroUnidadYMedio[2],
                        matchNumeroUnidadYMedio[3]
                    ];
                }
            }

            if (!match) {
                const matchUnidadYMedio = transcripcionConversor.match(regexUnidadYMedio);
                if (matchUnidadYMedio) {
                    // Caso: "pasa metro y medio a pulgadas"
                    valorForzado = 1.5;
                    match = [
                        matchUnidadYMedio[0],
                        'uno y medio',
                        matchUnidadYMedio[1],
                        matchUnidadYMedio[2]
                    ];
                }
            }

            if (match) {
                const valor = valorForzado ?? parsearNumeroVoz(match[1]);

                if (!Number.isFinite(valor)) {
                    resultadoConversor.innerText = "No he entendido el número. Prueba con '1' o 'uno'.";
                    mostrarFeedback('Número no reconocido en el comando de conversión.');
                    comandoReconocido = true;
                    if (microActivo) {
                        actualizarEstadoMicro('listening', 'Escuchando...');
                    }
                    return;
                }

                const uOrigen = normalizarUnidad(match[2]);
                const uDestino = normalizarUnidad(match[3]);
                const resultado = convertirMedidas(valor, uOrigen, uDestino);

                if (resultado !== null) {
                    resultadoConversor.innerText = `${valor} ${match[2]} = ${resultado.toFixed(2)} ${match[3]}`;
                    mostrarFeedback('Conversión calculada correctamente.');
                } else {
                    resultadoConversor.innerText = `No sé pasar de ${match[2]} a ${match[3]}.`;
                    mostrarFeedback('No reconozco esa conversión. Prueba otra combinación.');
                }
            } else {
                resultadoConversor.innerText = "No te he entendido. Prueba con: 'pasa 5 metros a centímetros'.";
                mostrarFeedback('Formato de conversión no válido.');
            }

            comandoReconocido = true;
        }

        if (!comandoReconocido) {
            mostrarFeedback('Comando no reconocido. Usa siguiente, atrás, reproduce, pausa o convierte.');
        }

        if (microActivo) {
            actualizarEstadoMicro('listening', 'Escuchando...');
        }
    };

    // --- Manejo de errores o fin automático ---
    recognition.onerror = (event) => {
        console.error('Error de voz: ', event.error);
        actualizarEstadoMicro('error', 'Error de reconocimiento');
        mostrarFeedback(`Error de voz (${event.error}). Prueba a reiniciar el micrófono.`);
    };

    recognition.onstart = () => {
        microActivo = true;
        paradaManual = false;
        btnMicro.innerText = '🔴 Escuchando...';
        btnMicro.style.backgroundColor = '#ff3333';
        btnStopMicro.style.display = 'inline-block';
        actualizarEstadoMicro('listening', 'Escuchando...');
        mostrarFeedback('Micrófono activo. Esperando comandos.');
    };
    
    // Si se detiene sola por inactividad
    recognition.onend = () => {
        microActivo = false;
        btnMicro.innerText = 'Activar Micrófono';
        btnMicro.style.backgroundColor = '#007bff';
        btnStopMicro.style.display = 'none';

        if (!paradaManual) {
            mostrarFeedback('El micrófono se ha detenido por inactividad. Pulsa Activar Micrófono para continuar.');
        }

        paradaManual = false;
        actualizarEstadoMicro('idle', 'Micrófono apagado');
    };

} else {
    textoEscuchado.innerText = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome.';
    mostrarFeedback('Reconocimiento de voz no disponible en este navegador.');
    actualizarEstadoMicro('error', 'No compatible');
    btnMicro.style.display = 'none';
    btnStopMicro.style.display = 'none';
}