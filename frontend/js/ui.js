
// ============================================================
// TELEMED — GERENCIAMENTO DA INTERFACE
// ETAPA 3: CONTROLES MULTIMÍDIA
// ============================================================

/**
 * Retorna os elementos utilizados pela interface.
 *
 * @returns {Object}
 */
export function getUIElements() {

    return {

        localVideo: document.getElementById(
            "local-video"
        ),

        remoteVideo: document.getElementById(
            "remote-video"
        ),

        connectionStatus: document.getElementById(
            "connection-status"
        ),

        microphoneButton: document.getElementById(
            "toggle-microphone"
        ),

        cameraButton: document.getElementById(
            "toggle-camera"
        ),

        joinButton: document.getElementById(
            "join-call"
        ),

        leaveButton: document.getElementById(
            "leave-call"
        )

    };
}


/**
 * Exibe o fluxo capturado no vídeo local.
 *
 * @param {MediaStream} stream
 */
export function displayLocalStream(stream) {

    const { localVideo } = getUIElements();

    if (!localVideo) {
        return;
    }

    localVideo.srcObject = stream;

    // O vídeo local permanece sem reprodução de áudio.
    localVideo.muted = true;

    // Solicita reprodução e trata eventuais bloqueios.
    localVideo.play().catch((error) => {

        console.warn(
            "Reprodução local não iniciada:",
            error
        );

    });
}


/**
 * Remove o fluxo exibido no vídeo local.
 */
export function clearLocalVideo() {

    const { localVideo } = getUIElements();

    if (localVideo) {
        localVideo.srcObject = null;
    }
}


/**
 * Atualiza o estado visual da conexão.
 *
 * @param {string} message
 * @param {string} status
 */
export function updateConnectionStatus(
    message,
    status = "waiting"
) {

    const { connectionStatus } = getUIElements();

    if (!connectionStatus) {
        return;
    }

    connectionStatus.textContent = message;

    connectionStatus.className =
        `status status-${status}`;
}


/**
 * Atualiza os botões de câmera e microfone.
 *
 * @param {boolean} microphoneEnabled
 * @param {boolean} cameraEnabled
 */
export function updateMediaButtons(
    microphoneEnabled,
    cameraEnabled
) {

    const {
        microphoneButton,
        cameraButton
    } = getUIElements();

    if (microphoneButton) {

        microphoneButton.textContent =
            microphoneEnabled
                ? "Desativar microfone"
                : "Ativar microfone";

        microphoneButton.setAttribute(
            "aria-pressed",
            String(microphoneEnabled)
        );
    }

    if (cameraButton) {

        cameraButton.textContent =
            cameraEnabled
                ? "Desativar câmera"
                : "Ativar câmera";

        cameraButton.setAttribute(
            "aria-pressed",
            String(cameraEnabled)
        );
    }
}


/**
 * Habilita ou desabilita os controles.
 *
 * @param {boolean} mediaActive
 */
export function updateControls(mediaActive) {

    const {
        microphoneButton,
        cameraButton,
        joinButton,
        leaveButton
    } = getUIElements();

    microphoneButton.disabled = !mediaActive;
    cameraButton.disabled = !mediaActive;

    // Nesta etapa, o botão Entrar inicia a prévia local.
    joinButton.disabled = mediaActive;

    // O botão Encerrar interrompe a captura.
    leaveButton.disabled = !mediaActive;

    joinButton.textContent = mediaActive
        ? "Prévia iniciada"
        : "Iniciar prévia";

    leaveButton.textContent = "Encerrar prévia";
}
