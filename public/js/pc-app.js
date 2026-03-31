const socket = io();

const burbuja = document.getElementById('nivel-burbuja');
const texto = document.getElementById('nivel-texto');
const tubo = document.getElementById('nivel-tubo');

// Escuchamos el evento que envía el servidor
socket.on('update_pc_level', (data) => {
    let inclinacion = data.tilt;
    
    // Mostramos el texto en grande
    texto.innerText = `Inclinación: ${inclinacion}º`;

    // Lógica para mover la burbuja (Limitamos visualmente a +-45 grados)
    let limite = 45; 
    let porcentajeMovimiento = (inclinacion / limite) * 50; 
    
    // Evitamos que la burbuja se salga del tubo
    if(porcentajeMovimiento > 50) porcentajeMovimiento = 50;
    if(porcentajeMovimiento < -50) porcentajeMovimiento = -50;

    // Actualizamos la posición CSS de la burbuja
    burbuja.style.left = `calc(50% + ${porcentajeMovimiento}%)`;

    // LÓGICA DE NIVELACIÓN (Tolerancia de +- 2 grados)
    if (Math.abs(inclinacion) <= 2) {
        // Está nivelado: TODO VERDE
        burbuja.style.backgroundColor = '#00ff00';
        tubo.style.borderColor = '#00ff00';
        texto.style.color = '#00ff00';
        texto.innerText = `¡NIVELADO! (0º)`;
    } else {
        // No está nivelado: ROJO y BLANCO
        burbuja.style.backgroundColor = '#ff3333';
        tubo.style.borderColor = '#555';
        texto.style.color = 'white';
    }
});

// --- MÓDULO DE VOZ (Web Speech API) ---

const btnMicro = document.getElementById('btn-micro');
const btnStopMicro = document.getElementById('btn-stop-micro');
const textoEscuchado = document.getElementById('texto-escuchado');
const resultadoConversor = document.getElementById('resultado-conversor');

// Elementos del "Tutorial Ficticio"
const visorManual = document.getElementById('visor-manual');
const estadoManual = document.getElementById('estado-manual');
const visorVideo = document.getElementById('visor-video');

let pasoActual = 1;
const pasosTotales = 5;

// Comprobamos si el navegador soporta la API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES'; 
    recognition.continuous = true; 
    recognition.interimResults = false; 

    // --- Control de Botones ---
    btnMicro.addEventListener('click', () => {
        recognition.start();
        btnMicro.innerText = "🔴 Escuchando...";
        btnMicro.style.backgroundColor = "#ff3333";
        btnStopMicro.style.display = "inline-block"; // Mostramos el botón de parar
    });

    btnStopMicro.addEventListener('click', () => {
        recognition.stop();
        btnMicro.innerText = "Activar Micrófono";
        btnMicro.style.backgroundColor = "#007bff";
        btnStopMicro.style.display = "none"; // Ocultamos el botón de parar
        textoEscuchado.innerText = '"Micrófono apagado"';
    });

    // --- Procesar la Voz ---
    recognition.onresult = (event) => {
        const ultimaFraseIndex = event.results.length - 1;
        const transcripcion = event.results[ultimaFraseIndex][0].transcript.trim().toLowerCase();
        
        textoEscuchado.innerText = `"${transcripcion}"`;
        resultadoConversor.innerText = ""; // Limpiamos el conversor anterior

        // 1. LÓGICA DEL CONVERSOR DE MEDIDAS (Súper flexible)
        const comandosConversor = ["convierte", "pasa", "cambia", "cuánto es", "cuántos son", "cuantas son"];
        const esComandoConversor = comandosConversor.some(cmd => transcripcion.includes(cmd));

        if (esComandoConversor) {
            // Buscamos: (numero) (unidad_origen) a/en (unidad_destino)
            // Ejemplo: "pasa 5.5 kilos a libras"
            const regex = /(\d+(?:[.,]\d+)?)\s*([a-záéíóú]+)\s+(?:a|en)\s+([a-záéíóú]+)/i;
            const match = transcripcion.match(regex);

            if (match) {
                const valor = parseFloat(match[1].replace(',', '.'));
                
                // Función para normalizar lo que entiende el micro
                const normalizarUnidad = (u) => {
                    u = u.toLowerCase();
                    if (['cm', 'centímetro', 'centímetros', 'centimetro', 'centimetros'].includes(u)) return 'cm';
                    if (['m', 'metro', 'metros'].includes(u)) return 'm';
                    if (['pulgada', 'pulgadas', 'inch', 'in'].includes(u)) return 'in';
                    if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) return 'kg';
                    if (['libra', 'libras', 'lb', 'lbs'].includes(u)) return 'lb';
                    return u;
                };

                const uOrigen = normalizarUnidad(match[2]);
                const uDestino = normalizarUnidad(match[3]);
                let resultado = null;

                // Lógica de matemáticas puras
                if (uOrigen === 'cm' && uDestino === 'in') resultado = valor / 2.54;
                else if (uOrigen === 'in' && uDestino === 'cm') resultado = valor * 2.54;
                else if (uOrigen === 'm' && uDestino === 'cm') resultado = valor * 100;
                else if (uOrigen === 'cm' && uDestino === 'm') resultado = valor / 100;
                else if (uOrigen === 'm' && uDestino === 'in') resultado = valor * 39.3701;
                else if (uOrigen === 'in' && uDestino === 'm') resultado = valor / 39.3701;
                else if (uOrigen === 'kg' && uDestino === 'lb') resultado = valor * 2.20462;
                else if (uOrigen === 'lb' && uDestino === 'kg') resultado = valor / 2.20462;

                if (resultado !== null) {
                    resultadoConversor.innerText = `${valor} ${match[2]} = ${resultado.toFixed(2)} ${match[3]}`;
                } else {
                    resultadoConversor.innerText = `No sé pasar de ${match[2]} a ${match[3]}.`;
                }
            } else {
                resultadoConversor.innerText = "No te he entendido. Prueba con 'Pasa 5 metros a centímetros'.";
            }
        }

        // 2. LÓGICA DEL MANUAL (Paso a paso)
        if (transcripcion.includes("siguiente") || transcripcion.includes("avanza")) {
            if (pasoActual < pasosTotales) {
                pasoActual++;
                visorManual.innerText = `Paso ${pasoActual}: Acción de bricolaje`;
                estadoManual.innerText = `Página ${pasoActual} / ${pasosTotales}`;
                visorManual.style.backgroundColor = "#335533"; // Cambio de color para que se note
                setTimeout(() => visorManual.style.backgroundColor = "#111", 500);
            }
        }
        
        if (transcripcion.includes("atrás") || transcripcion.includes("retrocede")) {
            if (pasoActual > 1) {
                pasoActual--;
                visorManual.innerText = `Paso ${pasoActual}: Acción de bricolaje`;
                estadoManual.innerText = `Página ${pasoActual} / ${pasosTotales}`;
                visorManual.style.backgroundColor = "#553333";
                setTimeout(() => visorManual.style.backgroundColor = "#111", 500);
            }
        }

        // 3. LÓGICA DEL VÍDEO
        if (transcripcion.includes("reproduce") || transcripcion.includes("play") || transcripcion.includes("continúa")) {
            visorVideo.innerHTML = "▶️ REPRODUCIENDO...";
            visorVideo.style.borderColor = "#00ff00"; // Borde verde
        }
        
        if (transcripcion.includes("pausa") || transcripcion.includes("para")) {
            visorVideo.innerHTML = "⏸️ PAUSADO";
            visorVideo.style.borderColor = "#ff3333"; // Borde rojo
        }
    };

    // --- Manejo de errores o fin automático ---
    recognition.onerror = (event) => {
        console.error("Error de voz: ", event.error);
        btnMicro.innerText = "Error. Reiniciar Micro";
        btnMicro.style.backgroundColor = "#ffcc00";
    };
    
    // Si se detiene sola por inactividad
    recognition.onend = () => {
        btnMicro.innerText = "Activar Micrófono";
        btnMicro.style.backgroundColor = "#007bff";
        btnStopMicro.style.display = "none";
    };

} else {
    textoEscuchado.innerText = "Tu navegador no soporta reconocimiento de voz. Usa Chrome.";
    btnMicro.style.display = "none";
}