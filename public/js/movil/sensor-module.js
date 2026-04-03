export const initSensorModule = ({
    startButton,
    sensorDataContainer,
    tiltValue,
    statusText,
    onTilt
}) => {
    let sensorsStarted = false;

    const handleOrientation = (event) => {
        if (event.beta === null) {
            statusText.innerText = 'No se reciben datos del giroscopio.';
            return;
        }

        const tilt = Math.round(event.beta);
        tiltValue.innerText = tilt;
        onTilt(tilt);
    };

    const startSensors = () => {
        if (sensorsStarted) {
            return;
        }

        sensorsStarted = true;
        startButton.classList.add('is-hidden');
        sensorDataContainer.classList.remove('is-hidden');
        statusText.innerText = 'Sensores activos. Enviando datos al PC...';

        window.addEventListener('deviceorientation', handleOrientation);
    };

    const requestAndStart = () => {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then((permissionState) => {
                    if (permissionState === 'granted') {
                        startSensors();
                    } else {
                        alert('Necesitamos permiso para leer la inclinacion.');
                    }
                })
                .catch(console.error);
            return;
        }

        startSensors();
    };

    return {
        requestAndStart,
        areSensorsStarted: () => sensorsStarted
    };
};