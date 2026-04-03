import { crearSocketMovil } from './movil/socket-modulo.js';
import { iniciarModuloSensores } from './movil/sensor-modulo.js';

const botonIniciarSensores = document.getElementById('btn-iniciar-sensores');
const contenedorDatosSensor = document.getElementById('datos-sensor');
const valorInclinacion = document.getElementById('valor-inclinacion');
const estadoInclinacion = document.getElementById('estado-inclinacion');

const { socket, registrarRol } = crearSocketMovil();

const moduloSensores = iniciarModuloSensores({
    botonInicio: botonIniciarSensores,
    contenedorSensor: contenedorDatosSensor,
    valorInclinacion,
    textoEstado: estadoInclinacion,
    onTilt: (tilt) => {
        socket.emit('mobile_tilt_data', { tilt });
    }
});

socket.on('connect', () => {
    registrarRol();
    if (moduloSensores.estanSensoresIniciados()) {
        estadoInclinacion.innerText = 'Conectado. Enviando datos al PC...';
    }
});

socket.on('disconnect', () => {
    estadoInclinacion.innerText = 'Sin conexion con el servidor. Reintentando...';
});

botonIniciarSensores.addEventListener('click', () => {
    moduloSensores.solicitarEIniciar();
});