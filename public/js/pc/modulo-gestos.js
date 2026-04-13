export const crearModuloGestos = (tutorialApi) => {
    const videoElement = document.getElementById('camara-gestos');
    const canvasElement = document.getElementById('canvas-gestos');
    const estadoGestos = document.getElementById('estado-gestos');
    const helpText = document.querySelector('.ayuda-gestos');
    const debugLabel = document.getElementById('texto-deteccion-gestos');
    const contextoCanvas = canvasElement ? canvasElement.getContext('2d') : null;

    const loadScript = (src) => new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(script);
    });

    let gestosActivos = false;
    let preparado = false;
    let hands = null;
    let streamCamara = null;
    let rafId = null;
    let procesandoFrame = false;
    let ultimoGestoTiempo = 0;
    let ultimoGesto = null;
    let repeticionesGesto = 0;
    let ultimoCentroMano = null;
    let ultimoTiempoMano = 0;

    const UMBRAL_GESTO_MS = 800;
    const UMBRAL_ESTABILIDAD_GESTO = 3;
    const UMBRAL_SEEK_MS = 700;
    const UMBRAL_SEEK_MOV = 0.14;

    const actualizarEstado = (texto, tipo = 'idle') => {
        estadoGestos.className = `estado-gestos estado-${tipo}`;
        estadoGestos.innerText = texto;
    };

    const cargarLibrerias = async () => {
        if (preparado) {
            return true;
        }

        try {
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');

            if (!window.Hands) {
                throw new Error('MediaPipe Hands no disponible');
            }

            hands = new window.Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.65,
                minTrackingConfidence: 0.65
            });

            hands.onResults(procesarResultadosMano);

            preparado = true;
            return true;
        } catch (error) {
            console.error('No se pudieron cargar las librerías de gestos:', error);
            actualizarEstado('Error cargando el detector de gestos', 'error');
            return false;
        }
    };

    const solicitarCamara = async () => {
        try {
            streamCamara = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            videoElement.srcObject = streamCamara;
            videoElement.setAttribute('playsinline', 'true');
            videoElement.setAttribute('autoplay', 'true');
            videoElement.muted = true;

            await videoElement.play();
            return true;
        } catch (error) {
            console.error('No se pudo acceder a la cámara:', error);
            actualizarEstado('Sin acceso a la cámara', 'error');
            return false;
        }
    };

    const detenerCamara = () => {
        if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }

        if (streamCamara) {
            streamCamara.getTracks().forEach((track) => track.stop());
            streamCamara = null;
        }

        videoElement.srcObject = null;
    };

    const puntoVisible = (landmarks, idx) => landmarks[idx] && Number.isFinite(landmarks[idx].x) && Number.isFinite(landmarks[idx].y);

    const calcularEscalaMano = (landmarks) => {
        if (!puntoVisible(landmarks, 0) || !puntoVisible(landmarks, 5) || !puntoVisible(landmarks, 9) || !puntoVisible(landmarks, 17)) {
            return 1;
        }

        const palmaVertical = Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y);
        const palmaHorizontal = Math.hypot(landmarks[17].x - landmarks[5].x, landmarks[17].y - landmarks[5].y);
        const referencia = palmaVertical + palmaHorizontal;
        const escala = referencia / 0.42;
        return Math.min(1.2, Math.max(0.55, escala));
    };

    const dedoVerticalExtendido = (landmarks, tip, pip) => {
        if (!puntoVisible(landmarks, tip) || !puntoVisible(landmarks, pip)) {
            return false;
        }

        return landmarks[tip].y < landmarks[pip].y - 0.08;
    };

    const dedoHorizontalExtendido = (landmarks, tip, mcp, direccion) => {
        if (!puntoVisible(landmarks, tip) || !puntoVisible(landmarks, mcp)) {
            return false;
        }

        return direccion === 'derecha'
            ? landmarks[tip].x > landmarks[mcp].x + 0.08
            : landmarks[tip].x < landmarks[mcp].x - 0.08;
    };

    const pulgarArriba = (landmarks) => {
        if (!puntoVisible(landmarks, 4) || !puntoVisible(landmarks, 2) || !puntoVisible(landmarks, 3)) {
            return false;
        }

        return landmarks[4].y < landmarks[3].y - 0.08 && landmarks[4].y < landmarks[2].y - 0.05;
    };

    const pulgarAbajo = (landmarks) => {
        if (!puntoVisible(landmarks, 4) || !puntoVisible(landmarks, 2) || !puntoVisible(landmarks, 3)) {
            return false;
        }

        return landmarks[4].y > landmarks[3].y + 0.08 && landmarks[4].y > landmarks[2].y + 0.05;
    };

    const pulgarLateral = (landmarks) => {
        if (!puntoVisible(landmarks, 4) || !puntoVisible(landmarks, 2)) {
            return false;
        }

        return Math.abs(landmarks[4].x - landmarks[2].x) > 0.1;
    };

    const dedoExtendidoGeneral = (landmarks, tip, mcp, umbral = 0.19) => {
        if (!puntoVisible(landmarks, tip) || !puntoVisible(landmarks, mcp)) {
            return false;
        }

        const distancia = Math.hypot(landmarks[tip].x - landmarks[mcp].x, landmarks[tip].y - landmarks[mcp].y);
        return distancia > umbral;
    };

    const manoAbierta = (landmarks) => {
        const dedosAbiertos = [
            dedoVerticalExtendido(landmarks, 8, 6),
            dedoVerticalExtendido(landmarks, 12, 10),
            dedoVerticalExtendido(landmarks, 16, 14),
            dedoVerticalExtendido(landmarks, 20, 18)
        ];

        const separacion = puntoVisible(landmarks, 8) && puntoVisible(landmarks, 20)
            ? Math.abs(landmarks[8].x - landmarks[20].x)
            : 0;

        return dedosAbiertos.every(Boolean) && separacion > 0.22 && pulgarLateral(landmarks);
    };

    const dibujarCanvasDepuracion = (results, gesto, detalleDedos = '') => {
        if (!canvasElement || !contextoCanvas || !videoElement.videoWidth || !videoElement.videoHeight) {
            return;
        }

        if (canvasElement.width !== videoElement.videoWidth) {
            canvasElement.width = videoElement.videoWidth;
        }

        if (canvasElement.height !== videoElement.videoHeight) {
            canvasElement.height = videoElement.videoHeight;
        }

        contextoCanvas.save();
        contextoCanvas.clearRect(0, 0, canvasElement.width, canvasElement.height);
        contextoCanvas.translate(canvasElement.width, 0);
        contextoCanvas.scale(-1, 1);
        contextoCanvas.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        const manos = results.multiHandLandmarks || [];
        const etiqueta = (results.multiHandedness && results.multiHandedness[0] && results.multiHandedness[0].label) || 'Desconocida';

        manos.forEach((landmarks) => {
            if (window.drawConnectors && window.drawLandmarks) {
                window.drawConnectors(contextoCanvas, landmarks, window.HAND_CONNECTIONS, {
                    color: '#00e676',
                    lineWidth: 4
                });
                window.drawLandmarks(contextoCanvas, landmarks, {
                    color: '#ff9800',
                    lineWidth: 2,
                    radius: 4
                });
            } else {
                contextoCanvas.fillStyle = '#ff9800';
                landmarks.forEach((point) => {
                    contextoCanvas.beginPath();
                    contextoCanvas.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, Math.PI * 2);
                    contextoCanvas.fill();
                });
            }
        });

        contextoCanvas.restore();

        contextoCanvas.fillStyle = 'rgba(0, 0, 0, 0.55)';
        contextoCanvas.fillRect(16, 16, Math.min(canvasElement.width - 32, 560), 72);
        contextoCanvas.fillStyle = '#ffffff';
        contextoCanvas.font = 'bold 24px sans-serif';
        contextoCanvas.fillText(`Mano: ${etiqueta}`, 28, 46);
        contextoCanvas.font = '18px sans-serif';
        contextoCanvas.fillText(`Gesto: ${gesto || 'ninguno'}`, 28, 68);

        if (debugLabel) {
            const detalle = detalleDedos ? ` | ${detalleDedos}` : '';
            debugLabel.innerText = `Mano: ${etiqueta} | Gesto detectado: ${gesto || 'ninguno'}${detalle}`;
        }
    };

    const puñoCerrado = (landmarks) => {
        const dx8 = Math.abs(landmarks[8].x - landmarks[0].x);
        const dy8 = Math.abs(landmarks[8].y - landmarks[0].y);
        const dx12 = Math.abs(landmarks[12].x - landmarks[0].x);
        const dy12 = Math.abs(landmarks[12].y - landmarks[0].y);
        const dx16 = Math.abs(landmarks[16].x - landmarks[0].x);
        const dy16 = Math.abs(landmarks[16].y - landmarks[0].y);
        const dx20 = Math.abs(landmarks[20].x - landmarks[0].x);
        const dy20 = Math.abs(landmarks[20].y - landmarks[0].y);

        const compacto = (dx8 + dy8 + dx12 + dy12 + dx16 + dy16 + dx20 + dy20) < 1.75;
        return compacto && !pulgarArriba(landmarks);
    };

    const detectarGesto = (landmarks) => {
        const escalaMano = calcularEscalaMano(landmarks);
        const indiceExt = dedoExtendidoGeneral(landmarks, 8, 5, 0.2 * escalaMano);
        const medioExt = dedoExtendidoGeneral(landmarks, 12, 9, 0.2 * escalaMano);
        const anularExt = dedoExtendidoGeneral(landmarks, 16, 13, 0.19 * escalaMano);
        const meñiqueExt = dedoExtendidoGeneral(landmarks, 20, 17, 0.18 * escalaMano);
        const pulgarUp = pulgarArriba(landmarks);
        const pulgarDown = pulgarAbajo(landmarks);

        const soloPulgar = pulgarUp && !indiceExt && !medioExt && !anularExt && !meñiqueExt;
        const indiceSolo = indiceExt && !medioExt && !anularExt && !meñiqueExt;
        const gestoV = indiceExt && medioExt && !anularExt && !meñiqueExt;
        const dedosLevantados = [indiceExt, medioExt, anularExt, meñiqueExt].filter(Boolean).length;

        const distIndice = Math.hypot(landmarks[8].x - landmarks[0].x, landmarks[8].y - landmarks[0].y);
        const distMedio = Math.hypot(landmarks[12].x - landmarks[0].x, landmarks[12].y - landmarks[0].y);

        const usaIndice = distIndice >= distMedio;
        const tipIdx = usaIndice ? 8 : 12;
        const baseIdx = usaIndice ? 5 : 9;
        const tipWristDx = landmarks[tipIdx].x - landmarks[0].x;
        const tipWristDy = landmarks[tipIdx].y - landmarks[0].y;
        const distDominante = Math.hypot(tipWristDx, tipWristDy);

        const horizontalDominante = Math.abs(tipWristDx) > Math.abs(tipWristDy) * 0.9 && Math.abs(tipWristDx) > (0.13 * escalaMano);
        const verticalDominante = Math.abs(tipWristDy) > Math.abs(tipWristDx) * 0.9 && Math.abs(tipWristDy) > (0.13 * escalaMano);

        const apuntarArriba = verticalDominante && tipWristDy < (-0.07 * escalaMano);
        const apuntarAbajo = verticalDominante && tipWristDy > (0.07 * escalaMano);
        // Vista espejada en canvas: izquierda usuario equivale a dx positivo.
        const apuntarIzquierdaUsuario = horizontalDominante && tipWristDx > 0.07;
        const apuntarDerechaUsuario = horizontalDominante && tipWristDx < -0.07;

        const indiceDx = landmarks[8].x - landmarks[0].x;
        const indiceDy = landmarks[8].y - landmarks[0].y;
        const indiceHorizontalDominante = Math.abs(indiceDx) > Math.abs(indiceDy) * 0.9 && Math.abs(indiceDx) > (0.12 * escalaMano);

        const vDx = ((landmarks[8].x + landmarks[12].x) / 2) - landmarks[0].x;
        const vDy = ((landmarks[8].y + landmarks[12].y) / 2) - landmarks[0].y;
        const vHorizontalDominante = Math.abs(vDx) > Math.abs(vDy) * 0.9 && Math.abs(vDx) > (0.11 * escalaMano);
        const separacionV = Math.abs(landmarks[8].x - landmarks[12].x);

        const dominanteValido = distDominante > (0.18 * escalaMano);
        const gestoVolumenValido = (indiceExt || medioExt) && !soloPulgar && !manoAbierta(landmarks) && dominanteValido;

        const detalle = `Dedos:${dedosLevantados} | Esc:${escalaMano.toFixed(2)} | Dom:${usaIndice ? 'indice' : 'medio'} | dirX:${tipWristDx.toFixed(2)} dirY:${tipWristDy.toFixed(2)} | idxX:${indiceDx.toFixed(2)} vX:${vDx.toFixed(2)} sepV:${separacionV.toFixed(2)} | Pulgar:${pulgarUp ? 'arriba' : (pulgarDown ? 'abajo' : 'neutral')}`;

        if (manoAbierta(landmarks)) {
            return { gesto: 'pausar-video', detalle };
        }

        if (soloPulgar) {
            return { gesto: 'reproducir-video', detalle };
        }

        // Gesto de +/-10s: V lateral (indice + medio).
        if (gestoV && vHorizontalDominante && separacionV > (0.045 * escalaMano)) {
            if (vDx < (-0.08 * escalaMano)) {
                return { gesto: 'avanzar-10', detalle };
            }

            if (vDx > (0.08 * escalaMano)) {
                return { gesto: 'retroceder-10', detalle };
            }
        }

        // Páginas: solo indice apuntando lateral (sin medio).
        if (indiceSolo && indiceHorizontalDominante) {
            if (indiceDx > (0.07 * escalaMano)) {
                return { gesto: 'pagina-anterior', detalle };
            }

            if (indiceDx < (-0.07 * escalaMano)) {
                return { gesto: 'pagina-siguiente', detalle };
            }
        }

        if (gestoVolumenValido) {
            if (apuntarArriba) {
                return { gesto: 'volumen-arriba', detalle };
            }

            if (apuntarAbajo) {
                return { gesto: 'volumen-abajo', detalle };
            }
        }

        return { gesto: null, detalle };
    };

    const esGestoSeekPorMano = () => false;

    const dispararAccion = (gesto) => {
        const ahora = Date.now();

        if (ahora - ultimoGestoTiempo < UMBRAL_GESTO_MS) {
            return;
        }

        ultimoGestoTiempo = ahora;

        switch (gesto) {
            case 'pausar-video':
                tutorialApi.pauseVideo();
                actualizarEstado('✋ Mano abierta → Vídeo pausado', 'idle');
                break;
            case 'reproducir-video':
                tutorialApi.playVideo();
                actualizarEstado('👍 Pulgar arriba → Reproduciendo', 'ok');
                break;
            case 'pagina-siguiente':
                tutorialApi.nextManualStep();
                actualizarEstado('👉 Señalar derecha → Siguiente página', 'ok');
                break;
            case 'pagina-anterior':
                tutorialApi.previousManualStep();
                actualizarEstado('👈 Señalar izquierda → Página anterior', 'ok');
                break;
            case 'volumen-arriba':
                tutorialApi.changeVolume(0.1);
                actualizarEstado('📣 Señalar arriba → Subir volumen', 'ok');
                break;
            case 'volumen-abajo':
                tutorialApi.changeVolume(-0.1);
                actualizarEstado('🔉 Señalar abajo → Bajar volumen', 'ok');
                break;
            case 'avanzar-10':
                tutorialApi.seekVideo(10);
                actualizarEstado('➡ V lateral → Avanzar 10 segundos', 'ok');
                break;
            case 'retroceder-10':
                tutorialApi.seekVideo(-10);
                actualizarEstado('⬅ V lateral → Retroceder 10 segundos', 'ok');
                break;
        }
    };

    const procesarResultadosMano = (results) => {
        if (!gestosActivos) {
            return;
        }

        const manos = results.multiHandLandmarks || [];
        if (manos.length === 0) {
            ultimoGesto = null;
            repeticionesGesto = 0;
            ultimoCentroMano = null;
            ultimoTiempoMano = 0;
            dibujarCanvasDepuracion(results, null);
            return;
        }

        const landmarks = manos[0];
        const { gesto, detalle } = detectarGesto(landmarks);

        if (!gesto) {
            ultimoGesto = null;
            repeticionesGesto = 0;
        } else {
            if (gesto === ultimoGesto) {
                repeticionesGesto += 1;
            } else {
                ultimoGesto = gesto;
                repeticionesGesto = 1;
            }

            if (repeticionesGesto >= UMBRAL_ESTABILIDAD_GESTO) {
                dispararAccion(gesto);
                ultimoGesto = null;
                repeticionesGesto = 0;
            }
        }

        evaluarMovimientoManoParaSeek(landmarks);
        dibujarCanvasDepuracion(results, gesto, detalle);
    };

    const evaluarMovimientoManoParaSeek = (landmarks) => {
        const activaSeekPorMano = esGestoSeekPorMano(landmarks);

        if (!activaSeekPorMano) {
            ultimoCentroMano = null;
            ultimoTiempoMano = 0;
            return;
        }

        const ahora = performance.now();
        const centroX = landmarks[0].x;

        if (ultimoCentroMano) {
            const deltaX = centroX - ultimoCentroMano.x;
            const deltaT = ahora - ultimoTiempoMano;

            if (deltaT <= UMBRAL_SEEK_MS && Math.abs(deltaX) >= UMBRAL_SEEK_MOV) {
                // Nota: invertimos signo por la vista espejada del canvas.
                dispararAccion(deltaX > 0 ? 'retroceder-10' : 'avanzar-10');
                ultimoCentroMano = { x: centroX };
                ultimoTiempoMano = ahora;
                return;
            }
        }

        ultimoCentroMano = { x: centroX };
        ultimoTiempoMano = ahora;
    };

    const ciclo = async () => {
        if (!gestosActivos) {
            return;
        }

        if (procesandoFrame) {
            rafId = window.requestAnimationFrame(ciclo);
            return;
        }

        procesandoFrame = true;

        try {
            if (hands && videoElement.readyState >= 2) {
                await hands.send({ image: videoElement });
            }
        } catch (error) {
            console.warn('Error en el ciclo de gestos:', error);
        } finally {
            procesandoFrame = false;
        }

        rafId = window.requestAnimationFrame(ciclo);
    };

    const activarGestos = async () => {
        if (gestosActivos) {
            return;
        }

        actualizarEstado('Preparando cámara...', 'processing');

        const libreriasOk = await cargarLibrerias();
        if (!libreriasOk) {
            return;
        }

        const camaraOk = await solicitarCamara();
        if (!camaraOk) {
            return;
        }

        gestosActivos = true;
        ultimoGesto = null;
        repeticionesGesto = 0;
        ultimoGestoTiempo = 0;
        ultimoCentroMano = null;
        ultimoTiempoMano = 0;

        if (videoElement) {
            videoElement.classList.add('is-hidden');
        }

        if (canvasElement) {
            canvasElement.classList.remove('is-hidden');
        }
        if (helpText) {
            helpText.innerHTML = '<strong>Mapa de gestos (fijo):</strong><br>👋 Palma abierta → Pausar vídeo<br>👍 Pulgar arriba → Reproducir vídeo<br>👈 Solo índice lateral hacia tu izquierda → Página anterior<br>👉 Solo índice lateral hacia tu derecha → Siguiente página<br>📣 Índice o medio arriba → Subir volumen<br>🔉 Índice o medio abajo → Bajar volumen<br>✌️ V lateral hacia tu derecha → Avanzar 10 s<br>✌️ V lateral hacia tu izquierda → Retroceder 10 s<br><strong>Depuración:</strong> usa el texto de abajo para ver el gesto interpretado.';
        }

        actualizarEstado('Gestos activos. Mantén el gesto un momento para confirmar.', 'ok');
        ciclo();
    };

    const desactivarGestos = () => {
        gestosActivos = false;
        ultimoGesto = null;
        repeticionesGesto = 0;
        ultimoGestoTiempo = 0;
        ultimoCentroMano = null;
        ultimoTiempoMano = 0;

        if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }

        detenerCamara();
        if (canvasElement) {
            canvasElement.classList.add('is-hidden');
        }

        videoElement.classList.add('is-hidden');
        actualizarEstado('Gestos desactivados', 'idle');
    };

    const tomarFoto = () => {
        try {
            const canvasTemp = document.createElement('canvas');
            canvasTemp.width = videoElement.videoWidth || 640;
            canvasTemp.height = videoElement.videoHeight || 480;
            const ctxTemp = canvasTemp.getContext('2d');

            // Espejo: voltea horizontalmente para mostrar lo opuesto a como lo ve MediaPipe
            ctxTemp.translate(canvasTemp.width, 0);
            ctxTemp.scale(-1, 1);
            ctxTemp.drawImage(videoElement, 0, 0, canvasTemp.width, canvasTemp.height);

            const imagenBase64 = canvasTemp.toDataURL('image/png');

            const contenedor = document.getElementById('galeria-fotos');
            if (!contenedor) {
                console.warn('Contenedor de fotos no encontrado');
                return false;
            }

            const imgElement = document.createElement('img');
            imgElement.src = imagenBase64;
            imgElement.className = 'foto-capturada';
            imgElement.alt = `Foto capturada ${new Date().toLocaleTimeString()}`;
            imgElement.title = `Capturada a las ${new Date().toLocaleTimeString()}`;

            contenedor.appendChild(imgElement);
            return true;
        } catch (error) {
            console.error('Error al capturar foto:', error);
            return false;
        }
    };

    return {
        activarGestos,
        desactivarGestos,
        estaActivo: () => gestosActivos,
        tomarFoto
    };
};
