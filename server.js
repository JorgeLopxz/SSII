const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir la carpeta 'public' estáticamente
app.use(express.static(path.join(__dirname, 'public')));

// Gestión de conexiones de Socket.IO
io.on('connection', (socket) => {
    console.log('Un dispositivo se ha conectado:', socket.id);

    // Recibir la inclinación del móvil y enviarla al PC
    socket.on('mobile_tilt_data', (data) => {
        socket.broadcast.emit('update_pc_level', data);
    });

    socket.on('disconnect', () => {
        console.log('Dispositivo desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n--- Servidor de Taller Activo ---`);
    console.log(`-> Vista de PC:    http://localhost:${PORT}/pc.html`);
    console.log(`-> Vista Móvil:    http://localhost:${PORT}/movil.html`);
});