import { crearSocketMovil } from './movil/socket-modulo.js';
import { iniciarModuloSensores } from './movil/sensor-modulo.js';

const startButton = document.getElementById('start-btn');
const sensorDataContainer = document.getElementById('sensor-data');
const tiltValue = document.getElementById('tilt-value');
const statusText = document.getElementById('status');

const { socket, registrarRol } = crearSocketMovil();

const moduloSensores = iniciarModuloSensores({
    botonInicio: startButton,
    contenedorSensor: sensorDataContainer,
    valorInclinacion: tiltValue,
    textoEstado: statusText,
    onTilt: (tilt) => {
        socket.emit('mobile_tilt_data', { tilt });
    }
});

socket.on('connect', () => {
    registrarRol();
    if (moduloSensores.estanSensoresIniciados()) {
        statusText.innerText = 'Conectado. Enviando datos al PC...';
    }
});

socket.on('disconnect', () => {
    statusText.innerText = 'Sin conexion con el servidor. Reintentando...';
});

startButton.addEventListener('click', () => {
    moduloSensores.solicitarEIniciar();
});