import { showFeedback } from './feedback.js';

const LIMIT_VISUAL = 45;
const LEVEL_TOLERANCE = 2;
const SMOOTHING_FACTOR = 0.25;
const NO_DATA_TIMEOUT_MS = 3000;

export const initLevelModule = (socket) => {
    const bubble = document.getElementById('nivel-burbuja');
    const text = document.getElementById('nivel-texto');
    const tube = document.getElementById('nivel-tubo');
    const sensorStatus = document.getElementById('estado-sensores');
    const calibrateButton = document.getElementById('btn-calibrar');
    const resetCalibrateButton = document.getElementById('btn-reset-calibracion');

    let lastRawTilt = null;
    let smoothTilt = null;
    let calibrationOffset = 0;
    let lastDataTimestamp = 0;

    const updateSensorStatus = (status, message) => {
        sensorStatus.className = `estado-sensores estado-sensor-${status}`;
        sensorStatus.innerText = message;
    };

    const resetLevelVisual = (message) => {
        text.innerText = message;
        text.style.color = '#6b5744';
        bubble.style.left = '50%';
        bubble.style.filter = 'saturate(0.9)';
        tube.style.borderColor = 'rgba(138, 90, 45, 0.52)';
    };

    const renderLevel = (tilt) => {
        let movementPercent = (tilt / LIMIT_VISUAL) * 50;

        if (movementPercent > 50) movementPercent = 50;
        if (movementPercent < -50) movementPercent = -50;

        bubble.style.left = `calc(50% + ${movementPercent}%)`;

        if (Math.abs(tilt) <= LEVEL_TOLERANCE) {
            bubble.style.filter = 'hue-rotate(60deg) saturate(1.4)';
            tube.style.borderColor = '#2e8b57';
            text.style.color = '#2e8b57';
            text.innerText = 'NIVELADO (0deg)';
            return;
        }

        bubble.style.filter = 'hue-rotate(-18deg) saturate(1.2)';
        tube.style.borderColor = 'rgba(138, 90, 45, 0.52)';
        text.style.color = '#35261a';
        text.innerText = `Inclinacion: ${tilt.toFixed(1)}deg`;
    };

    socket.on('connect', () => {
        socket.emit('register_role', 'pc');
        updateSensorStatus('warn', 'PC conectado. Esperando movil...');
    });

    socket.on('disconnect', () => {
        updateSensorStatus('error', 'Sin conexion con el servidor');
        resetLevelVisual('Sin conexion de red.');
    });

    socket.on('sensor_status', (info) => {
        if (!info || !info.state) {
            return;
        }

        if (info.state === 'streaming') {
            updateSensorStatus('ok', 'Movil activo enviando datos');
            return;
        }

        if (info.state === 'connected') {
            updateSensorStatus('warn', 'Movil conectado (sin datos aun)');
            return;
        }

        if (info.state === 'disconnected') {
            updateSensorStatus('offline', 'Sin sensores');
            resetLevelVisual('Esperando datos del movil...');
        }
    });

    socket.on('update_pc_level', (data) => {
        if (!data || typeof data.tilt !== 'number') {
            return;
        }

        lastRawTilt = data.tilt;
        lastDataTimestamp = Date.now();
        updateSensorStatus('ok', 'Movil activo enviando datos');

        const calibratedTilt = lastRawTilt - calibrationOffset;
        if (smoothTilt === null) {
            smoothTilt = calibratedTilt;
        } else {
            smoothTilt = (smoothTilt * (1 - SMOOTHING_FACTOR)) + (calibratedTilt * SMOOTHING_FACTOR);
        }

        renderLevel(smoothTilt);
    });

    window.setInterval(() => {
        if (lastDataTimestamp === 0) {
            return;
        }

        const noData = Date.now() - lastDataTimestamp > NO_DATA_TIMEOUT_MS;
        if (!noData) {
            return;
        }

        updateSensorStatus('offline', 'Sin sensores (sin datos recientes)');
        resetLevelVisual('Sin datos del movil. Revisa la conexion.');
        lastDataTimestamp = 0;
        smoothTilt = null;
    }, 1000);

    calibrateButton.addEventListener('click', () => {
        if (lastRawTilt === null) {
            return;
        }

        calibrationOffset = lastRawTilt;
        smoothTilt = 0;
        renderLevel(0);
        showFeedback(`Calibracion aplicada. Offset: ${calibrationOffset.toFixed(1)}deg`);
    });

    resetCalibrateButton.addEventListener('click', () => {
        calibrationOffset = 0;
        smoothTilt = null;
        showFeedback('Calibracion reiniciada.');
    });
};