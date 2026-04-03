let feedbackElement = null;

export const initFeedback = () => {
    feedbackElement = document.getElementById('voz-feedback');
};

export const showFeedback = (message) => {
    if (!feedbackElement) {
        return;
    }

    feedbackElement.innerText = message;
};