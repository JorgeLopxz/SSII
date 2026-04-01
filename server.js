const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const mobileSockets = new Set();

// Servir la carpeta 'public' estáticamente
app.use(express.static(path.join(__dirname, 'public')));

// Gestión de conexiones de Socket.IO
io.on('connection', (socket) => {
    console.log('Un dispositivo se ha conectado:', socket.id);

    socket.data.role = 'unknown';

    socket.on('register_role', (role) => {
        if (role === 'mobile') {
            socket.data.role = 'mobile';
            mobileSockets.add(socket.id);
            io.emit('sensor_status', {
                state: 'connected',
                mobileCount: mobileSockets.size,
                socketId: socket.id
            });
            console.log('Móvil registrado:', socket.id);
            return;
        }

        if (role === 'pc') {
            socket.data.role = 'pc';
            socket.emit('sensor_status', {
                state: mobileSockets.size > 0 ? 'connected' : 'disconnected',
                mobileCount: mobileSockets.size
            });
            console.log('PC registrado:', socket.id);
        }
    });

    // Recibir la inclinación del móvil y enviarla al PC
    socket.on('mobile_tilt_data', (data) => {
        if (socket.data.role !== 'mobile') {
            return;
        }

        socket.broadcast.emit('update_pc_level', data);
        socket.broadcast.emit('sensor_status', {
            state: 'streaming',
            mobileCount: mobileSockets.size,
            socketId: socket.id
        });
    });

    socket.on('disconnect', () => {
        if (socket.data.role === 'mobile') {
            mobileSockets.delete(socket.id);
            io.emit('sensor_status', {
                state: mobileSockets.size > 0 ? 'connected' : 'disconnected',
                mobileCount: mobileSockets.size,
                socketId: socket.id
            });
        }

        console.log('Dispositivo desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n--- Servidor de Taller Activo ---`);
    console.log(`-> Vista de PC:    http://localhost:${PORT}/pc.html`);
    console.log(`-> Vista Móvil:    http://localhost:${PORT}/movil.html`);
});