// Conectamos con el servidor Socket.IO
const socket = io();

const startBtn = document.getElementById('start-btn');
const sensorDataDiv = document.getElementById('sensor-data');
const tiltValueSpan = document.getElementById('tilt-value');
const statusText = document.getElementById('status');
let sensoresIniciados = false;

socket.on('connect', () => {
    socket.emit('register_role', 'mobile');
    if (sensoresIniciados) {
        statusText.innerText = 'Conectado. Enviando datos al PC...';
    }
});

socket.on('disconnect', () => {
    statusText.innerText = 'Sin conexión con el servidor. Reintentando...';
});

// Pedimos permiso al usuario al hacer clic en el botón
startBtn.addEventListener('click', () => {
    // Para dispositivos iOS 13+ que piden permiso explícito
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    iniciarSensores();
                } else {
                    alert("Necesitamos permiso para leer la inclinación.");
                }
            })
            .catch(console.error);
    } else {
        // Dispositivos Android o antiguos
        iniciarSensores();
    }
});

function iniciarSensores() {
    if (sensoresIniciados) {
        return;
    }

    sensoresIniciados = true;
    startBtn.style.display = 'none';
    sensorDataDiv.style.display = 'block';
    statusText.innerText = 'Sensores activos. Enviando datos al PC...';

    // Escuchamos los cambios del giroscopio del móvil
    window.addEventListener('deviceorientation', (event) => {
        if (event.beta === null) {
            statusText.innerText = 'No se reciben datos del giroscopio.';
            return;
        }

        // 'beta' nos da la inclinación de adelante hacia atrás [-180, 180]
        // Dependiendo de cómo apoyéis el móvil, quizá necesitemos usar 'gamma' (izquierda-derecha)
        let inclinacion = Math.round(event.beta); 
        
        // Lo mostramos en la pantalla del móvil
        tiltValueSpan.innerText = inclinacion;

        // ¡MAGIA! Lo enviamos al servidor en tiempo real
        socket.emit('mobile_tilt_data', { tilt: inclinacion });
    });
}