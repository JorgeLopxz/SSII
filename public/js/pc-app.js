import { inicializarRetroalimentacion } from './pc/retroalimentacion.js';
import { inicializarModuloNivel } from './pc/modulo-nivel.js';
import { crearModuloTutorial } from './pc/modulo-tutorial.js';
import { inicializarModuloVoz } from './pc/modulo-voz.js';

const bootstrap = async () => {
    const socket = io();

    inicializarRetroalimentacion();
    inicializarModuloNivel(socket);

    const apiTutorial = await crearModuloTutorial();
    inicializarModuloVoz(apiTutorial);
};

bootstrap();