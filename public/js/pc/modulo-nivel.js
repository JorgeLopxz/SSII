import { mostrarRetroalimentacion } from './retroalimentacion.js';

const LIMITE_VISUAL = 45;
const TOLERANCIA_NIVEL = 2;
const FACTOR_SUAVIZADO = 0.25;
const TIEMPO_ESPERA_SIN_DATOS_MS = 3000;

export const inicializarModuloNivel = (socket) => {
    const burbuja = document.getElementById('burbuja-nivel');
    const texto = document.getElementById('texto-nivel');
    const tubo = document.getElementById('tubo-nivel');
    const estadoSensor = document.getElementById('estado-sensor');
    const botonCalibrar = document.getElementById('btn-calibrar');
    const botonReiniciarCalibracion = document.getElementById('btn-reset-calibracion');

    let ultimaInclinacionBruta = null;
    let inclinacionSuavizada = null;
    let offsetCalibracion = 0;
    let ultimoMomentoDato = 0;

    const actualizarEstadoSensor = (estado, mensaje) => {
        estadoSensor.className = `estado-sensor estado-sensor-${estado}`;
        estadoSensor.innerText = mensaje;
    };

    const restablecerVistaNivel = (mensaje) => {
        texto.innerText = mensaje;
        texto.style.color = '#6b5744';
        burbuja.style.left = '50%';
        burbuja.style.filter = 'saturate(0.9)';
        tubo.style.borderColor = 'rgba(138, 90, 45, 0.52)';
    };

    const dibujarNivel = (inclinacion) => {
        let desplazamiento = (inclinacion / LIMITE_VISUAL) * 50;

        if (desplazamiento > 50) desplazamiento = 50;
        if (desplazamiento < -50) desplazamiento = -50;

        burbuja.style.left = `calc(50% + ${desplazamiento}%)`;

        if (Math.abs(inclinacion) <= TOLERANCIA_NIVEL) {
            burbuja.style.filter = 'hue-rotate(60deg) saturate(1.4)';
            tubo.style.borderColor = '#2e8b57';
            texto.style.color = '#2e8b57';
            texto.innerText = 'NIVELADO (0deg)';
            return;
        }

        burbuja.style.filter = 'hue-rotate(-18deg) saturate(1.2)';
        tubo.style.borderColor = 'rgba(138, 90, 45, 0.52)';
        texto.style.color = '#35261a';
        texto.innerText = `Inclinacion: ${inclinacion.toFixed(1)}deg`;
    };

    socket.on('connect', () => {
        socket.emit('register_role', 'pc');
        actualizarEstadoSensor('warn', 'PC conectado. Esperando movil...');
    });

    socket.on('disconnect', () => {
        actualizarEstadoSensor('error', 'Sin conexion con el servidor');
        restablecerVistaNivel('Sin conexion de red.');
    });

    socket.on('sensor_status', (info) => {
        if (!info || !info.state) {
            return;
        }

        if (info.state === 'streaming') {
            actualizarEstadoSensor('ok', 'Movil activo enviando datos');
            return;
        }

        if (info.state === 'connected') {
            actualizarEstadoSensor('warn', 'Movil conectado (sin datos aun)');
            return;
        }

        if (info.state === 'disconnected') {
            actualizarEstadoSensor('offline', 'Sin sensores');
            restablecerVistaNivel('Esperando datos del movil...');
        }
    });

    socket.on('update_pc_level', (data) => {
        if (!data || typeof data.tilt !== 'number') {
            return;
        }

        ultimaInclinacionBruta = data.tilt;
        ultimoMomentoDato = Date.now();
        actualizarEstadoSensor('ok', 'Movil activo enviando datos');

        const inclinacionCalibrada = ultimaInclinacionBruta - offsetCalibracion;
        if (inclinacionSuavizada === null) {
            inclinacionSuavizada = inclinacionCalibrada;
        } else {
            inclinacionSuavizada = (inclinacionSuavizada * (1 - FACTOR_SUAVIZADO)) + (inclinacionCalibrada * FACTOR_SUAVIZADO);
        }

        dibujarNivel(inclinacionSuavizada);
    });

    window.setInterval(() => {
        if (ultimoMomentoDato === 0) {
            return;
        }

        const sinDatos = Date.now() - ultimoMomentoDato > TIEMPO_ESPERA_SIN_DATOS_MS;
        if (!sinDatos) {
            return;
        }

        actualizarEstadoSensor('offline', 'Sin sensores (sin datos recientes)');
        restablecerVistaNivel('Sin datos del movil. Revisa la conexion.');
        ultimoMomentoDato = 0;
        inclinacionSuavizada = null;
    }, 1000);

    const aplicarCalibracion = () => {
        if (ultimaInclinacionBruta === null) {
            mostrarRetroalimentacion('No hay datos del movil para calibrar.');
            return;
        }

        offsetCalibracion = ultimaInclinacionBruta;
        inclinacionSuavizada = 0;
        dibujarNivel(0);
        mostrarRetroalimentacion(`Calibracion aplicada. Offset: ${offsetCalibracion.toFixed(1)}deg`);
    };

    const reiniciarCalibracion = () => {
        offsetCalibracion = 0;
        inclinacionSuavizada = null;
        mostrarRetroalimentacion('Calibracion reiniciada.');
    };

    botonCalibrar.addEventListener('click', aplicarCalibracion);
    botonReiniciarCalibracion.addEventListener('click', reiniciarCalibracion);

    // Permite calibrar y reiniciar desde comandos de voz
    document.addEventListener('calibrar-nivel', aplicarCalibracion);
    document.addEventListener('reiniciar-calibracion', reiniciarCalibracion);
};