import { initFeedback } from './pc/feedback.js';
import { initLevelModule } from './pc/level-module.js';
import { createTutorialModule } from './pc/tutorial-module.js';
import { initVoiceModule } from './pc/voice-module.js';

const bootstrap = async () => {
    const socket = io();

    initFeedback();
    initLevelModule(socket);

    const tutorialApi = await createTutorialModule();
    initVoiceModule(tutorialApi);
};

bootstrap();