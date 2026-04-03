import { createMobileSocket } from './movil/socket-module.js';
import { initSensorModule } from './movil/sensor-module.js';

const startButton = document.getElementById('start-btn');
const sensorDataContainer = document.getElementById('sensor-data');
const tiltValue = document.getElementById('tilt-value');
const statusText = document.getElementById('status');

const { socket, registerRole } = createMobileSocket();

const sensorModule = initSensorModule({
    startButton,
    sensorDataContainer,
    tiltValue,
    statusText,
    onTilt: (tilt) => {
        socket.emit('mobile_tilt_data', { tilt });
    }
});

socket.on('connect', () => {
    registerRole();
    if (sensorModule.areSensorsStarted()) {
        statusText.innerText = 'Conectado. Enviando datos al PC...';
    }
});

socket.on('disconnect', () => {
    statusText.innerText = 'Sin conexion con el servidor. Reintentando...';
});

startButton.addEventListener('click', () => {
    sensorModule.requestAndStart();
});