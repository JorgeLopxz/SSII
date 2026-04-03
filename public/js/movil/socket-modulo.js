export const crearSocketMovil = () => {
    const socket = io();

    const registrarRol = () => {
        socket.emit('register_role', 'mobile');
    };

    return {
        socket,
        registrarRol
    };
};