export const createMobileSocket = () => {
    const socket = io();

    const registerRole = () => {
        socket.emit('register_role', 'mobile');
    };

    return {
        socket,
        registerRole
    };
};