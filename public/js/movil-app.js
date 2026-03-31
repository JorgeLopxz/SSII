// Conectamos con el servidor Socket.IO
const socket = io();

const startBtn = document.getElementById('start-btn');
const sensorDataDiv = document.getElementById('sensor-data');
const tiltValueSpan = document.getElementById('tilt-value');

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
    startBtn.style.display = 'none';
    sensorDataDiv.style.display = 'block';

    // Escuchamos los cambios del giroscopio del móvil
    window.addEventListener('deviceorientation', (event) => {
        // 'beta' nos da la inclinación de adelante hacia atrás [-180, 180]
        // Dependiendo de cómo apoyéis el móvil, quizá necesitemos usar 'gamma' (izquierda-derecha)
        let inclinacion = Math.round(event.beta); 
        
        // Lo mostramos en la pantalla del móvil
        tiltValueSpan.innerText = inclinacion;

        // ¡MAGIA! Lo enviamos al servidor en tiempo real
        socket.emit('mobile_tilt_data', { tilt: inclinacion });
    });
}