export const createTutorialModule = async () => {
    const visorManual = document.getElementById('visor-manual');
    const estadoManual = document.getElementById('estado-manual');
    const manualPanel = document.getElementById('subpanel-manual');
    const manualImagesInput = document.getElementById('manual-images-input');
    const visorVideo = document.getElementById('visor-video');
    const videoUrlButton = document.getElementById('btn-video-url');
    const video = document.getElementById('video-demo');
    const estadoVideo = document.getElementById('estado-video');

    let manualSteps = [];
    let currentPage = 1;
    let manualImages = [];
    let manualImageUrls = [];

    let useEmbeddedPlayer = false;
    let embeddedHost = null;
    let youtubePlayer = null;
    let youtubeApiPromise = null;

    try {
        const response = await fetch('/data/manual.json', { cache: 'no-store' });
        if (response.ok) {
            const payload = await response.json();
            if (Array.isArray(payload.steps)) {
                manualSteps = payload.steps.map((step) => String(step));
            }
        }
    } catch (error) {
        console.warn('No se pudo cargar manual.json, se usa sin pasos de ejemplo.', error);
    }

    const getTotalPages = () => {
        return Math.max(manualImages.length, 1);
    };

    const renderManual = () => {
        const totalPages = getTotalPages();
        currentPage = Math.max(1, Math.min(currentPage, totalPages));

        const index = currentPage - 1;
        const stepText = manualImages.length > 0 ? (manualSteps[index] || '') : '';
        const imageSource = manualImages[index] || null;

        visorManual.innerHTML = '';

        if (imageSource) {
            const imageNode = document.createElement('img');
            imageNode.className = 'manual-step-image';
            imageNode.alt = `Foto del paso ${currentPage}`;
            imageNode.src = imageSource;
            visorManual.appendChild(imageNode);
        }

        if (stepText) {
            const textNode = document.createElement('p');
            textNode.className = 'manual-step-text';
            textNode.innerText = stepText;
            visorManual.appendChild(textNode);
        }

        if (!imageSource && !stepText) {
            const emptyNode = document.createElement('p');
            emptyNode.className = 'manual-empty-text';
            emptyNode.innerText = 'Adjunta fotos o contenido del manual para empezar.';
            visorManual.appendChild(emptyNode);
        }

        estadoManual.innerText = `Pagina ${currentPage}`;
    };

    const flashManual = (color) => {
        visorManual.style.backgroundColor = color;
        window.setTimeout(() => {
            visorManual.style.backgroundColor = '#fff3e0';
        }, 280);
    };

    const nextManualStep = () => {
        const totalPages = getTotalPages();
        if (manualImages.length === 0) {
            return { ok: false, message: 'No hay paginas cargadas en el manual.' };
        }

        if (currentPage < totalPages) {
            currentPage += 1;
            renderManual();
            flashManual('#d8f0cf');
            return { ok: true, message: 'He avanzado al siguiente paso del manual.' };
        }

        return { ok: false, message: 'Ya estas en la ultima pagina cargada.' };
    };

    const previousManualStep = () => {
        if (currentPage > 1) {
            currentPage -= 1;
            renderManual();
            flashManual('#f4d8d3');
            return { ok: true, message: 'He retrocedido al paso anterior del manual.' };
        }

        return { ok: false, message: 'Ya estas en la primera pagina.' };
    };

    const parseYouTubeUrl = (url) => {
        const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (shortMatch) return shortMatch[1];

        const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (longMatch) return longMatch[1];

        const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch) return embedMatch[1];

        return null;
    };

    const looksLikeDirectVideo = (url) => {
        const cleanUrl = url.split('?')[0].toLowerCase();
        return /\.(mp4|webm|ogg|m4v)$/i.test(cleanUrl);
    };

    const loadYouTubeApi = () => {
        if (window.YT && typeof window.YT.Player === 'function') {
            return Promise.resolve(window.YT);
        }

        if (youtubeApiPromise) {
            return youtubeApiPromise;
        }

        youtubeApiPromise = new Promise((resolve, reject) => {
            const previousReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof previousReady === 'function') {
                    previousReady();
                }
                resolve(window.YT);
            };

            const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
            if (!existingScript) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.async = true;
                script.onerror = () => reject(new Error('No se pudo cargar la API de YouTube'));
                document.head.appendChild(script);
            }

            window.setTimeout(() => {
                if (!(window.YT && typeof window.YT.Player === 'function')) {
                    reject(new Error('Timeout cargando API de YouTube'));
                }
            }, 8000);
        });

        return youtubeApiPromise;
    };

    const resetToHtml5Player = () => {
        useEmbeddedPlayer = false;

        if (youtubePlayer && typeof youtubePlayer.destroy === 'function') {
            youtubePlayer.destroy();
        }
        youtubePlayer = null;

        if (embeddedHost) {
            embeddedHost.remove();
            embeddedHost = null;
        }

        if (video) {
            video.classList.remove('is-hidden');
        }
    };

    const mountYouTubePlayer = async (youtubeId) => {
        await loadYouTubeApi();

        const host = document.createElement('div');
        host.className = 'video-embed-frame';
        visorVideo.appendChild(host);

        return new Promise((resolve) => {
            youtubePlayer = new window.YT.Player(host, {
                videoId: youtubeId,
                playerVars: {
                    playsinline: 1,
                    rel: 0,
                    modestbranding: 1
                },
                events: {
                    onReady: () => resolve(true),
                    onStateChange: (event) => {
                        if (!estadoVideo) {
                            return;
                        }

                        if (event.data === window.YT.PlayerState.PLAYING) {
                            estadoVideo.innerText = 'Reproduciendo';
                            visorVideo.style.borderColor = '#2e8b57';
                        }

                        if (event.data === window.YT.PlayerState.PAUSED) {
                            estadoVideo.innerText = 'Pausado';
                            visorVideo.style.borderColor = '#b64635';
                        }
                    }
                }
            });

            embeddedHost = host;
        });
    };

    const getDurationSeconds = () => {
        if (useEmbeddedPlayer) {
            if (!youtubePlayer || typeof youtubePlayer.getDuration !== 'function') {
                return null;
            }
            const duration = Number(youtubePlayer.getDuration() || 0);
            return duration > 0 ? duration : null;
        }

        if (!video || !Number.isFinite(video.duration)) {
            return null;
        }

        return video.duration;
    };

    const playVideo = async () => {
        if (useEmbeddedPlayer) {
            if (!youtubePlayer || typeof youtubePlayer.playVideo !== 'function') {
                return { ok: false, message: 'Reproductor embebido no listo todavia.' };
            }

            youtubePlayer.playVideo();
            visorVideo.style.borderColor = '#2e8b57';
            if (estadoVideo) estadoVideo.innerText = 'Reproduciendo';
            return { ok: true, message: 'Video en reproduccion.' };
        }

        if (!video) {
            return { ok: false, message: 'Video no disponible.' };
        }

        try {
            await video.play();
            visorVideo.style.borderColor = '#2e8b57';
            if (estadoVideo) estadoVideo.innerText = 'Reproduciendo';
            return { ok: true, message: 'Video en reproduccion.' };
        } catch (error) {
            console.warn('No se pudo reproducir el video:', error);
            return { ok: false, message: 'No se pudo reproducir el video.' };
        }
    };

    const pauseVideo = () => {
        if (useEmbeddedPlayer) {
            if (!youtubePlayer || typeof youtubePlayer.pauseVideo !== 'function') {
                return { ok: false, message: 'Reproductor embebido no listo todavia.' };
            }

            youtubePlayer.pauseVideo();
            visorVideo.style.borderColor = '#b64635';
            if (estadoVideo) estadoVideo.innerText = 'Pausado';
            return { ok: true, message: 'Video pausado.' };
        }

        if (!video) {
            return { ok: false, message: 'Video no disponible.' };
        }

        video.pause();
        visorVideo.style.borderColor = '#b64635';
        if (estadoVideo) estadoVideo.innerText = 'Pausado';
        return { ok: true, message: 'Video pausado.' };
    };

    const seekVideo = (seconds) => {
        if (useEmbeddedPlayer) {
            if (!youtubePlayer || typeof youtubePlayer.getCurrentTime !== 'function') {
                return { ok: false, message: 'Reproductor embebido no listo todavia.' };
            }

            const current = Number(youtubePlayer.getCurrentTime() || 0);
            const duration = Number(youtubePlayer.getDuration() || 0);
            let next = current + seconds;

            if (duration > 0) {
                next = Math.max(0, Math.min(duration, next));
            } else {
                next = Math.max(0, next);
            }

            youtubePlayer.seekTo(next, true);
            return {
                ok: true,
                message: seconds > 0 ? 'Video adelantado 10 segundos.' : 'Video retrocedido 10 segundos.'
            };
        }

        if (!video) {
            return { ok: false, message: 'Video no disponible.' };
        }

        const duration = Number.isFinite(video.duration) ? video.duration : null;
        const baseTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        let nextTime = baseTime + seconds;

        if (duration !== null) {
            nextTime = Math.max(0, Math.min(duration, nextTime));
        } else {
            nextTime = Math.max(0, nextTime);
        }

        video.currentTime = nextTime;
        return {
            ok: true,
            message: seconds > 0 ? 'Video adelantado 10 segundos.' : 'Video retrocedido 10 segundos.'
        };
    };

    const goToTime = (targetSeconds) => {
        if (!Number.isFinite(targetSeconds) || targetSeconds < 0) {
            return { ok: false, message: 'Tiempo no valido.' };
        }

        const duration = getDurationSeconds();
        if (duration !== null && targetSeconds > duration) {
            return { ok: false, message: 'Ese minuto/segundo no existe en este video.' };
        }

        if (useEmbeddedPlayer) {
            if (!youtubePlayer || typeof youtubePlayer.seekTo !== 'function') {
                return { ok: false, message: 'Reproductor embebido no listo todavia.' };
            }

            youtubePlayer.seekTo(targetSeconds, true);
            return { ok: true, message: `Moviendo video a ${Math.floor(targetSeconds)} segundos.` };
        }

        if (!video) {
            return { ok: false, message: 'Video no disponible.' };
        }

        video.currentTime = targetSeconds;
        return { ok: true, message: `Moviendo video a ${Math.floor(targetSeconds)} segundos.` };
    };

    const changeVolume = (delta) => {
        if (useEmbeddedPlayer) {
            if (!youtubePlayer || typeof youtubePlayer.getVolume !== 'function' || typeof youtubePlayer.setVolume !== 'function') {
                return { ok: false, message: 'Reproductor embebido no listo todavia.' };
            }

            const currentVolume = Number(youtubePlayer.getVolume() || 0);
            const nextVolume = Math.max(0, Math.min(100, currentVolume + Math.round(delta * 100)));
            youtubePlayer.setVolume(nextVolume);
            return { ok: true, message: `Volumen al ${nextVolume}%.` };
        }

        if (!video) {
            return { ok: false, message: 'Video no disponible.' };
        }

        const nextVolume = Math.max(0, Math.min(1, (video.volume || 0) + delta));
        video.volume = nextVolume;
        return { ok: true, message: `Volumen al ${Math.round(nextVolume * 100)}%.` };
    };

    const promptVideoUrl = async () => {
        if (!video) {
            return { ok: false, message: 'Video no disponible.' };
        }

        const currentValue = useEmbeddedPlayer
            ? (embeddedHost ? embeddedHost.id || 'youtube' : 'youtube')
            : (video.currentSrc || video.src || '');

        const nextUrl = window.prompt('Introduce la URL del video (MP4 o YouTube):', currentValue);
        if (nextUrl === null) {
            return { ok: false, message: 'Cambio de URL cancelado.' };
        }

        const sanitizedUrl = nextUrl.trim();
        if (!sanitizedUrl) {
            return { ok: false, message: 'URL vacia. No se aplicaron cambios.' };
        }

        const youtubeId = parseYouTubeUrl(sanitizedUrl);
        if (youtubeId) {
            resetToHtml5Player();
            useEmbeddedPlayer = true;

            if (video) {
                video.pause();
                video.classList.add('is-hidden');
            }

            try {
                await mountYouTubePlayer(youtubeId);
            } catch (error) {
                console.warn('No se pudo cargar YouTube embebido:', error);
                resetToHtml5Player();
                if (estadoVideo) {
                    estadoVideo.innerText = 'No se pudo cargar YouTube';
                }
                return { ok: false, message: 'No se pudo cargar el video de YouTube.' };
            }

            if (estadoVideo) {
                estadoVideo.innerText = 'YouTube cargado';
            }
            return { ok: true, message: 'URL de YouTube cargada en modo embebido.' };
        }

        if (!looksLikeDirectVideo(sanitizedUrl)) {
            return { ok: false, message: 'URL no valida para video directo. Usa MP4/WebM/Ogg o enlace de YouTube.' };
        }

        resetToHtml5Player();
        video.src = sanitizedUrl;
        video.load();
        if (estadoVideo) {
            estadoVideo.innerText = 'URL cargada. Listo para reproducir';
        }

        return { ok: true, message: 'URL de video actualizada correctamente.' };
    };

    const attachManualImages = () => {
        if (!manualImagesInput) {
            return { ok: false, message: 'No se encontro el selector de imagenes.' };
        }

        manualImagesInput.click();
        return { ok: true, message: 'Selecciona las fotos del manual fisico.' };
    };

    if (manualImagesInput) {
        manualImagesInput.addEventListener('change', (event) => {
            const fileList = event.target.files;
            if (!fileList || fileList.length === 0) {
                return;
            }

            manualImageUrls.forEach((url) => URL.revokeObjectURL(url));
            manualImageUrls = [];

            manualImages = Array.from(fileList)
                .filter((file) => file.type.startsWith('image/'))
                .map((file) => {
                    const objectUrl = URL.createObjectURL(file);
                    manualImageUrls.push(objectUrl);
                    return objectUrl;
                });

            currentPage = 1;
            renderManual();
        });
    }

    if (manualPanel) {
        manualPanel.addEventListener('click', (event) => {
            if (event.target.id === 'manual-images-input') {
                return;
            }
            attachManualImages();
        });
    }

    if (videoUrlButton) {
        videoUrlButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            await promptVideoUrl();
        });
    }

    if (video) {
        video.addEventListener('error', () => {
            if (estadoVideo) {
                estadoVideo.innerText = 'No se pudo cargar esa URL';
            }
        });

        video.addEventListener('play', () => {
            visorVideo.style.borderColor = '#2e8b57';
            if (estadoVideo) {
                estadoVideo.innerText = 'Reproduciendo';
            }
        });

        video.addEventListener('pause', () => {
            visorVideo.style.borderColor = '#b64635';
            if (estadoVideo) {
                estadoVideo.innerText = 'Pausado';
            }
        });
    }

    renderManual();

    return {
        nextManualStep,
        previousManualStep,
        playVideo,
        pauseVideo,
        seekVideo,
        goToTime,
        changeVolume,
        promptVideoUrl,
        attachManualImages
    };
};