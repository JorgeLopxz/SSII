export const iniciarModuloSensores = ({
    botonInicio,
    contenedorSensor,
    valorInclinacion,
    textoEstado,
    onTilt
}) => {
    let sensoresIniciados = false;

    const manejarOrientacion = (event) => {
        if (event.beta === null) {
            textoEstado.innerText = 'No se reciben datos del giroscopio.';
            return;
        }

        const inclinacion = Math.round(event.beta);
        valorInclinacion.innerText = inclinacion;
        onTilt(inclinacion);
    };

    const iniciarSensores = () => {
        if (sensoresIniciados) {
            return;
        }

        sensoresIniciados = true;
        botonInicio.classList.add('is-hidden');
        contenedorSensor.classList.remove('is-hidden');
        textoEstado.innerText = 'Sensores activos. Enviando datos al PC...';

        window.addEventListener('deviceorientation', manejarOrientacion);
    };

    const solicitarEIniciar = () => {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then((estadoPermiso) => {
                    if (estadoPermiso === 'granted') {
                        iniciarSensores();
                    } else {
                        alert('Necesitamos permiso para leer la inclinacion.');
                    }
                })
                .catch(console.error);
            return;
        }

        iniciarSensores();
    };

    return {
        solicitarEIniciar,
        estanSensoresIniciados: () => sensoresIniciados
    };
};