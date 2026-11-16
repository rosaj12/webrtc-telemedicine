
// ============================================================
// TELEMED — GERENCIAMENTO MULTIMÍDIA
// ETAPA 3: CÂMERA E MICROFONE
// ============================================================

/**
 * Armazena o fluxo multimídia local.
 *
 * O fluxo contém as trilhas de áudio e vídeo
 * obtidas dos dispositivos do usuário.
 */
let localStream = null;


/**
 * Solicita acesso à câmera e ao microfone.
 *
 * @returns {Promise<MediaStream>}
 * Fluxo multimídia capturado.
 */
export async function startLocalMedia() {

    // Evita capturas duplicadas.
    if (localStream) {
        return localStream;
    }

    // Verifica a disponibilidade da API.
    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error(
            "Captura multimídia indisponível neste contexto."
        );
    }

    // Preferências de captura.
    const constraints = {

        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },

        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        }

    };

    try {

        // Solicita permissão e captura os dispositivos.
        localStream =
            await navigator.mediaDevices.getUserMedia(
                constraints
            );

        console.log(
            "TeleMed: captura multimídia iniciada."
        );

        return localStream;

    } catch (error) {

        console.error(
            "Erro ao iniciar captura:",
            error
        );

        throw error;
    }
}


/**
 * Retorna o fluxo multimídia ativo.
 *
 * @returns {MediaStream|null}
 */
export function getLocalStream() {
    return localStream;
}


/**
 * Ativa ou desativa o microfone.
 *
 * @returns {boolean}
 * Novo estado da trilha de áudio.
 */
export function toggleMicrophone() {

    if (!localStream) {
        return false;
    }

    const audioTrack =
        localStream.getAudioTracks()[0];

    if (!audioTrack) {
        return false;
    }

    audioTrack.enabled = !audioTrack.enabled;

    return audioTrack.enabled;
}


/**
 * Ativa ou desativa a câmera.
 *
 * @returns {boolean}
 * Novo estado da trilha de vídeo.
 */
export function toggleCamera() {

    if (!localStream) {
        return false;
    }

    const videoTrack =
        localStream.getVideoTracks()[0];

    if (!videoTrack) {
        return false;
    }

    videoTrack.enabled = !videoTrack.enabled;

    return videoTrack.enabled;
}


/**
 * Interrompe todas as trilhas multimídia.
 *
 * Libera os dispositivos utilizados.
 */
export function stopLocalMedia() {

    if (!localStream) {
        return;
    }

    // Interrompe câmera e microfone.
    localStream.getTracks().forEach(
        (track) => {
            track.stop();
        }
    );

    // Remove a referência ao fluxo.
    localStream = null;

    console.log(
        "TeleMed: captura multimídia encerrada."
    );
}
