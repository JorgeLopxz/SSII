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