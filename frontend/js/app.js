
// ============================================================
// TELEMED — CONTROLADOR PRINCIPAL
// ETAPA 7: CONTROLES AVANÇADOS DA CONSULTA
// PARTE 1 DE 2
// ============================================================


// ============================================================
// 1. IMPORTAÇÃO DOS MÓDULOS
// ============================================================

/**
 * Gerenciamento dos dispositivos multimídia.
 *
 * Responsável pela captura, interrupção e controle
 * das trilhas locais de áudio e vídeo.
 */
import {
    startLocalMedia,
    getLocalStream,
    toggleMicrophone,
    toggleCamera,
    stopLocalMedia
} from "./media.js";


/**
 * Gerenciamento da interface gráfica.
 *
 * Centraliza os elementos visuais utilizados
 * pelo controlador principal.
 */
import {
    getUIElements,
    displayLocalStream,
    clearLocalVideo,
    updateConnectionStatus,
    updateMediaButtons,
    updateControls
} from "./ui.js";


/**
 * Comunicação com o servidor WebSocket.
 *
 * Responsável pela entrada nas salas e pelo
 * encaminhamento das mensagens de sinalização.
 */
import {
    connectSignaling,
    joinSignalingRoom,
    disconnectSignaling,
    onSignalingEvent
} from "./signaling.js";


/**
 * Comunicação WebRTC Peer-to-Peer.
 *
 * Implementa a negociação SDP, candidatos ICE
 * e gerenciamento da conexão audiovisual.
 */
import {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeerConnection,
    onWebRTCEvent
} from "./webrtc.js";


/**
 * Gerenciamento do temporizador da consulta.
 *
 * Implementado na Etapa 7.
 */
import {
    startConsultationTimer,
    stopConsultationTimer
} from "./consultation.js";


// ============================================================
// 2. ESTADO GLOBAL DA APLICAÇÃO
// ============================================================

/**
 * Indica se o participante entrou na sala.
 *
 * Não significa necessariamente que a conexão
 * audiovisual já foi estabelecida.
 */
let sessionActive = false;


/**
 * Indica que existe uma tentativa de entrada
 * em andamento.
 */
let isJoining = false;


/**
 * Indica que a aplicação está encerrando
 * uma sessão.
 */
let isLeaving = false;


/**
 * Identificador da geração atual da sessão.
 *
 * Permite invalidar operações assíncronas
 * pertencentes a sessões anteriores.
 */
let sessionGeneration = 0;


/**
 * Fila de operações de sinalização.
 *
 * Utilizada para executar negociações SDP e
 * processamento ICE sequencialmente.
 */
let signalingQueue = Promise.resolve();


/**
 * Indica se a comunicação audiovisual
 * está efetivamente estabelecida.
 */
let peerConnected = false;


// ============================================================
// 3. CONFIGURAÇÕES DA SALA
// ============================================================

/**
 * Bloqueia ou libera os campos da sala.
 *
 * @param {boolean} disabled
 * Indica se os campos devem ficar bloqueados.
 */
function setRoomSettingsDisabled(disabled) {

    const roomInput = document.getElementById(
        "room-input"
    );

    const participantRole = document.getElementById(
        "participant-role"
    );

    if (roomInput) {
        roomInput.disabled = disabled;
    }

    if (participantRole) {
        participantRole.disabled = disabled;
    }
}


// ============================================================
// 4. CONTROLES DA INTERFACE
// ============================================================

/**
 * Atualiza os botões de entrada, saída
 * e controle multimídia.
 */
function updateSessionControls() {

    updateControls(sessionActive);

    const {
        joinButton,
        leaveButton
    } = getUIElements();

    // --------------------------------------------------------
    // TEXTOS DOS BOTÕES
    // --------------------------------------------------------

    joinButton.textContent = "Entrar na sala";

    leaveButton.textContent = "Sair da sala";

    // --------------------------------------------------------
    // CONTROLE DE ENTRADA
    // --------------------------------------------------------

    joinButton.disabled = (
        sessionActive ||
        isJoining ||
        isLeaving
    );

    // --------------------------------------------------------
    // CONTROLE DE SAÍDA
    // --------------------------------------------------------

    leaveButton.disabled = (
        (!sessionActive && !isJoining) ||
        isLeaving
    );
}


// ============================================================
// 5. ESTADO VISUAL DA CONSULTA
// ============================================================

/**
 * Atualiza o indicador audiovisual da consulta.
 *
 * Estados disponíveis:
 *
 * - Padrão;
 * - active;
 * - interrupted;
 * - error.
 *
 * @param {string} message
 * Mensagem apresentada ao usuário.
 *
 * @param {string} state
 * Classe visual aplicada ao indicador.
 */
function updateSessionState(
    message,
    state = ""
) {

    const element = document.getElementById(
        "session-state"
    );

    if (!element) {
        return;
    }

    element.textContent = message;

    element.className = [
        "session-state",
        state
    ].filter(Boolean).join(" ");
}


// ============================================================
// 6. TEMPORIZADOR DA CONSULTA
// ============================================================

/**
 * Atualiza a duração apresentada na interface.
 *
 * O formato esperado é HH:MM:SS.
 *
 * @param {string} duration
 * Duração formatada.
 */
function updateConsultationTimer(duration) {

    const element = document.getElementById(
        "consultation-timer"
    );

    if (!element) {
        return;
    }

    element.textContent = duration;

    // --------------------------------------------------------
    // CONVERTER DURAÇÃO PARA VALORES NUMÉRICOS
    // --------------------------------------------------------

    const [
        hours,
        minutes,
        seconds
    ] = duration.split(":").map(Number);

    // --------------------------------------------------------
    // ATUALIZAR REPRESENTAÇÃO SEMÂNTICA
    // --------------------------------------------------------

    element.dateTime = (
        `PT${hours}H${minutes}M${seconds}S`
    );
}


/**
 * Restaura o temporizador para seu estado inicial.
 */
function resetConsultationTimer() {

    stopConsultationTimer();

    updateConsultationTimer(
        "00:00:00"
    );
}


// ============================================================
// 7. GERENCIAMENTO DOS VÍDEOS
// ============================================================

/**
 * Remove o fluxo multimídia remoto.
 *
 * Não interfere na captura da câmera local.
 */
function clearRemoteVideo() {

    const {
        remoteVideo
    } = getUIElements();

    if (!remoteVideo) {
        return;
    }

    remoteVideo.pause();

    remoteVideo.srcObject = null;
}


// ============================================================
// 8. CONTROLES MULTIMÍDIA AVANÇADOS
// ============================================================

/**
 * Atualiza a aparência dos botões de
 * microfone e câmera.
 *
 * A classe media-disabled indica que
 * o dispositivo correspondente está desligado.
 */
function refreshAdvancedMediaControls() {

    const stream = getLocalStream();

    const {
        microphoneButton,
        cameraButton
    } = getUIElements();

    const microphoneEnabled = (
        stream?.getAudioTracks()[0]?.enabled ?? false
    );

    const cameraEnabled = (
        stream?.getVideoTracks()[0]?.enabled ?? false
    );

    // --------------------------------------------------------
    // ESTADO VISUAL DO MICROFONE
    // --------------------------------------------------------

    microphoneButton.classList.toggle(
        "media-disabled",
        !microphoneEnabled
    );

    // --------------------------------------------------------
    // ESTADO VISUAL DA CÂMERA
    // --------------------------------------------------------

    cameraButton.classList.toggle(
        "media-disabled",
        !cameraEnabled
    );
}


/**
 * Sincroniza o estado das trilhas multimídia
 * com os botões da interface.
 */
function refreshMediaButtons() {

    const stream = getLocalStream();

    const microphoneEnabled = (
        stream?.getAudioTracks()[0]?.enabled ?? false
    );

    const cameraEnabled = (
        stream?.getVideoTracks()[0]?.enabled ?? false
    );

    updateMediaButtons(
        microphoneEnabled,
        cameraEnabled
    );

    refreshAdvancedMediaControls();
}


// ============================================================
// 9. RESTAURAÇÃO DA SESSÃO
// ============================================================

/**
 * Libera os recursos utilizados pela sessão.
 *
 * Responsabilidades:
 *
 * - Encerrar o temporizador;
 * - Encerrar a conexão WebRTC;
 * - Interromper os dispositivos locais;
 * - Limpar os vídeos;
 * - Restaurar os indicadores;
 * - Liberar a configuração da sala.
 *
 * Esta função não envia mensagens ao servidor.
 */
function resetSessionInterface() {

    // --------------------------------------------------------
    // ENCERRAR TEMPORIZADOR
    // --------------------------------------------------------

    resetConsultationTimer();

    // --------------------------------------------------------
    // ENCERRAR WEBRTC
    // --------------------------------------------------------

    closePeerConnection();

    peerConnected = false;

    // --------------------------------------------------------
    // LIBERAR DISPOSITIVOS
    // --------------------------------------------------------

    stopLocalMedia();

    clearLocalVideo();

    clearRemoteVideo();

    // --------------------------------------------------------
    // RESTAURAR ESTADO
    // --------------------------------------------------------

    sessionActive = false;

    // --------------------------------------------------------
    // RESTAURAR INDICADORES
    // --------------------------------------------------------

    updateSessionState(
        "Consulta encerrada"
    );

    refreshMediaButtons();

    // --------------------------------------------------------
    // LIBERAR CAMPOS DA SALA
    // --------------------------------------------------------

    setRoomSettingsDisabled(false);

    updateSessionControls();
}


// ============================================================
// 10. PROCESSAMENTO SERIALIZADO DA SINALIZAÇÃO
// ============================================================

/**
 * Adiciona uma operação à fila de sinalização.
 *
 * Isso impede que operações SDP e ICE sejam
 * processadas simultaneamente.
 *
 * @param {Function} operation
 * Operação assíncrona que será executada.
 */
function enqueueSignalingOperation(operation) {

    const generation = sessionGeneration;

    signalingQueue = signalingQueue
        .catch(() => {})
        .then(async () => {

            // ------------------------------------------------
            // VALIDAR SESSÃO
            // ------------------------------------------------

            if (
                generation !== sessionGeneration ||
                !sessionActive
            ) {
                return;
            }

            // ------------------------------------------------
            // EXECUTAR OPERAÇÃO
            // ------------------------------------------------

            await operation();
        })
        .catch((error) => {

            console.error(
                "Erro na negociação WebRTC:",
                error
            );

            if (generation !== sessionGeneration) {
                return;
            }

            updateConnectionStatus(
                "Falha na negociação WebRTC",
                "disconnected"
            );

            updateSessionState(
                "Falha na negociação",
                "error"
            );
        });
}


// ============================================================
// 11. ENTRADA NA SALA
// ============================================================

/**
 * Inicia o processo de entrada na consulta.
 *
 * Fluxo:
 *
 * 1. Validar o identificador da sala;
 * 2. Bloquear a interface;
 * 3. Capturar áudio e vídeo;
 * 4. Conectar ao servidor WebSocket;
 * 5. Solicitar entrada na sala;
 * 6. Aguardar confirmação do servidor.
 */
async function handleJoinCall() {

    if (
        sessionActive ||
        isJoining ||
        isLeaving
    ) {
        return;
    }

    // --------------------------------------------------------
    // RECUPERAR CONFIGURAÇÕES
    // --------------------------------------------------------

    const roomId = document.getElementById(
        "room-input"
    ).value.trim();

    const role = document.getElementById(
        "participant-role"
    ).value;

    // --------------------------------------------------------
    // VALIDAR IDENTIFICADOR DA SALA
    // --------------------------------------------------------

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomId)) {

        updateConnectionStatus(
            "Identificador de sala inválido",
            "disconnected"
        );

        updateSessionState(
            "Sala inválida",
            "error"
        );

        return;
    }

    // --------------------------------------------------------
    // INICIAR NOVA GERAÇÃO DE SESSÃO
    // --------------------------------------------------------

    const generation = ++sessionGeneration;

    isJoining = true;

    peerConnected = false;

    setRoomSettingsDisabled(true);

    updateSessionControls();

    updateSessionState(
        "Preparando consulta"
    );

    try {

        // ----------------------------------------------------
        // CAPTURAR CÂMERA E MICROFONE
        // ----------------------------------------------------

        updateConnectionStatus(
            "Preparando câmera e microfone...",
            "waiting"
        );

        const stream = await startLocalMedia();

        if (generation !== sessionGeneration) {

            // A sessão foi cancelada durante a captura.
            stopLocalMedia();

            return;
        }

        displayLocalStream(stream);

        refreshMediaButtons();

        // ----------------------------------------------------
        // CONECTAR AO SERVIDOR
        // ----------------------------------------------------

        updateConnectionStatus(
            "Conectando ao servidor...",
            "waiting"
        );

        updateSessionState(
            "Conectando ao servidor"
        );

        await connectSignaling();

        if (generation !== sessionGeneration) {

            disconnectSignaling();

            return;
        }

        // ----------------------------------------------------
        // SOLICITAR ENTRADA NA SALA
        // ----------------------------------------------------

        joinSignalingRoom(roomId);

        document.getElementById(
            "room-id"
        ).textContent = roomId;

        console.log(
            `TeleMed: papel selecionado — ${role}`
        );

        updateConnectionStatus(
            "Aguardando confirmação da sala...",
            "waiting"
        );

        updateSessionState(
            "Aguardando confirmação"
        );

    } catch (error) {

        if (generation !== sessionGeneration) {
            return;
        }

        console.error(
            "Falha ao entrar na sala:",
            error
        );

        // Invalida operações pendentes.
        ++sessionGeneration;

        disconnectSignaling();

        resetSessionInterface();

        isJoining = false;

        updateSessionControls();

        updateConnectionStatus(
            error instanceof Error
                ? error.message
                : "Falha ao entrar na sala",
            "disconnected"
        );

        updateSessionState(
            "Falha ao iniciar consulta",
            "error"
        );
    }

    /*
     * isJoining permanece true até o recebimento
     * do evento "joined" ou até uma falha.
     *
     * Isso evita liberar prematuramente o botão
     * de entrada na sala.
     */
}


// ============================================================
// 12. SAÍDA DA SALA
// ============================================================

/**
 * Encerra a participação na consulta.
 *
 * Invalida operações pendentes, desconecta
 * o WebSocket e libera os recursos locais.
 */
function handleLeaveCall() {

    if (isLeaving) {
        return;
    }

    isLeaving = true;

    isJoining = false;

    // Invalida operações assíncronas anteriores.
    ++sessionGeneration;

    // Solicita saída da sala e fecha o WebSocket.
    disconnectSignaling();

    // Libera os recursos locais.
    resetSessionInterface();

    updateConnectionStatus(
        "Sessão encerrada",
        "disconnected"
    );

    updateSessionState(
        "Consulta encerrada"
    );

    isLeaving = false;

    updateSessionControls();
}


// ============================================================
// 13. CONTROLES DE MICROFONE E CÂMERA
// ============================================================

/**
 * Alterna o estado do microfone.
 *
 * O controle somente funciona quando o
 * participante está dentro da sala.
 */
function handleToggleMicrophone() {

    if (
        !sessionActive ||
        !getLocalStream()
    ) {
        return;
    }

    toggleMicrophone();

    refreshMediaButtons();
}


/**
 * Alterna o estado da câmera.
 *
 * A desativação da câmera não encerra
 * a conexão WebRTC.
 */
function handleToggleCamera() {

    if (
        !sessionActive ||
        !getLocalStream()
    ) {
        return;
    }

    toggleCamera();

    refreshMediaButtons();
}


// ============================================================
// FIM DA PARTE 1 DE 2
//
// CONTINUAÇÃO:
// 14. EVENTOS DE SINALIZAÇÃO
// 15. EVENTOS WEBRTC
// 16. INICIALIZAÇÃO
// 17. ENCERRAMENTO DA PÁGINA
// ============================================================


// ============================================================
// TELEMED — CONTROLADOR PRINCIPAL
// ETAPA 7: CONTROLES AVANÇADOS DA CONSULTA
// PARTE 2 DE 2
// ============================================================


// ============================================================
// 14. EVENTOS DE SINALIZAÇÃO WEBSOCKET
// ============================================================

/**
 * Registra os eventos recebidos do servidor.
 *
 * Responsabilidades:
 *
 * - Confirmar entrada na sala;
 * - Identificar a chegada de participantes;
 * - Processar ofertas e respostas SDP;
 * - Receber candidatos ICE;
 * - Identificar a saída de participantes;
 * - Tratar erros e desconexões.
 */
function registerSignalingEvents() {

    // --------------------------------------------------------
    // 14.1. ENTRADA CONFIRMADA NA SALA
    // --------------------------------------------------------

    onSignalingEvent("joined", (message) => {

        // Ignora confirmações de sessões canceladas.
        if (
            isLeaving ||
            !isJoining ||
            !getLocalStream()
        ) {
            return;
        }

        sessionActive = true;

        isJoining = false;

        updateSessionControls();

        refreshMediaButtons();

        // ----------------------------------------------------
        // VERIFICAR QUANTIDADE DE PARTICIPANTES
        // ----------------------------------------------------

        if (message.participants === 2) {

            updateConnectionStatus(
                "Preparando conexão WebRTC...",
                "waiting"
            );

            updateSessionState(
                "Conectando participantes"
            );

        } else {

            updateConnectionStatus(
                "Aguardando outro participante...",
                "waiting"
            );

            updateSessionState(
                "Aguardando participante"
            );
        }

        console.log(
            "TeleMed: entrada na sala confirmada."
        );
    });


    // --------------------------------------------------------
    // 14.2. OUTRO PARTICIPANTE ENTROU
    // --------------------------------------------------------

    onSignalingEvent("peer-joined", () => {

        if (
            !sessionActive ||
            isLeaving
        ) {
            return;
        }

        updateConnectionStatus(
            "Negociando conexão WebRTC...",
            "waiting"
        );

        updateSessionState(
            "Negociando conexão"
        );

        // ----------------------------------------------------
        // INICIAR NEGOCIAÇÃO SDP
        // ----------------------------------------------------

        /*
         * O participante que já estava na sala
         * cria a oferta WebRTC.
         *
         * O participante recém-chegado aguarda
         * a oferta e envia uma resposta.
         */

        enqueueSignalingOperation(
            () => createOffer()
        );
    });


    // --------------------------------------------------------
    // 14.3. OFERTA SDP RECEBIDA
    // --------------------------------------------------------

    onSignalingEvent("offer", (message) => {

        if (!sessionActive || isLeaving) {
            return;
        }

        updateSessionState(
            "Recebendo proposta de conexão"
        );

        enqueueSignalingOperation(
            () => handleOffer(message.sdp)
        );
    });


    // --------------------------------------------------------
    // 14.4. RESPOSTA SDP RECEBIDA
    // --------------------------------------------------------

    onSignalingEvent("answer", (message) => {

        if (!sessionActive || isLeaving) {
            return;
        }

        enqueueSignalingOperation(
            () => handleAnswer(message.sdp)
        );
    });


    // --------------------------------------------------------
    // 14.5. CANDIDATO ICE RECEBIDO
    // --------------------------------------------------------

    onSignalingEvent("ice-candidate", (message) => {

        if (!sessionActive || isLeaving) {
            return;
        }

        /*
         * O módulo webrtc.js verifica se a
         * descrição remota já foi configurada.
         *
         * Caso contrário, armazena o candidato
         * para processamento posterior.
         */

        enqueueSignalingOperation(
            () => handleIceCandidate(
                message.candidate
            )
        );
    });


    // --------------------------------------------------------
    // 14.6. PARTICIPANTE REMOTO SAIU
    // --------------------------------------------------------

    onSignalingEvent("peer-left", () => {

        if (!sessionActive || isLeaving) {
            return;
        }

        // ----------------------------------------------------
        // INVALIDAR OPERAÇÕES ANTERIORES
        // ----------------------------------------------------

        ++sessionGeneration;

        // ----------------------------------------------------
        // ENCERRAR CONEXÃO WEBRTC
        // ----------------------------------------------------

        closePeerConnection();

        clearRemoteVideo();

        peerConnected = false;

        // ----------------------------------------------------
        // INTERROMPER TEMPORIZADOR
        // ----------------------------------------------------

        stopConsultationTimer();

        /*
         * O último tempo permanece visível.
         *
         * A captura local continua ativa,
         * permitindo que outro participante
         * entre na mesma sala.
         */

        // ----------------------------------------------------
        // ATUALIZAR INTERFACE
        // ----------------------------------------------------

        updateConnectionStatus(
            "Outro participante saiu. Aguardando...",
            "waiting"
        );

        updateSessionState(
            "Aguardando outro participante"
        );

        console.log(
            "TeleMed: participante remoto saiu."
        );
    });


    // --------------------------------------------------------
    // 14.7. ERRO DE SINALIZAÇÃO
    // --------------------------------------------------------

    onSignalingEvent("error", (message) => {

        console.error(
            "Erro de sinalização:",
            message.message
        );

        // ----------------------------------------------------
        // FALHA DURANTE A ENTRADA
        // ----------------------------------------------------

        if (!sessionActive) {

            ++sessionGeneration;

            isJoining = false;

            disconnectSignaling();

            resetSessionInterface();

            updateSessionControls();
        }

        // ----------------------------------------------------
        // EXIBIR ERRO
        // ----------------------------------------------------

        updateConnectionStatus(
            message.message ?? "Erro de sinalização",
            "disconnected"
        );

        updateSessionState(
            "Erro de sinalização",
            "error"
        );
    });


    // --------------------------------------------------------
    // 14.8. SERVIDOR DESCONECTADO
    // --------------------------------------------------------

    onSignalingEvent("disconnected", () => {

        if (isLeaving) {
            return;
        }

        /*
         * Uma desconexão inesperada invalida
         * a sessão atual.
         */

        ++sessionGeneration;

        isJoining = false;

        // ----------------------------------------------------
        // LIBERAR RECURSOS
        // ----------------------------------------------------

        resetSessionInterface();

        updateSessionControls();

        // ----------------------------------------------------
        // ATUALIZAR INDICADORES
        // ----------------------------------------------------

        updateConnectionStatus(
            "Servidor desconectado",
            "disconnected"
        );

        updateSessionState(
            "Conexão com servidor perdida",
            "error"
        );

        console.warn(
            "TeleMed: conexão WebSocket encerrada."
        );
    });
}


// ============================================================
// 15. EVENTOS DA CONEXÃO WEBRTC
// ============================================================

/**
 * Registra os eventos da conexão Peer-to-Peer.
 *
 * Responsabilidades:
 *
 * - Exibir o fluxo remoto;
 * - Monitorar o estado da conexão;
 * - Iniciar o temporizador;
 * - Identificar interrupções;
 * - Registrar o estado ICE;
 * - Tratar erros internos.
 */
function registerWebRTCEvents() {

    // --------------------------------------------------------
    // 15.1. RECEBIMENTO DO FLUXO REMOTO
    // --------------------------------------------------------

    onWebRTCEvent("remote-stream", (stream) => {

        const {
            remoteVideo
        } = getUIElements();

        // ----------------------------------------------------
        // REMOVER FLUXO ANTERIOR
        // ----------------------------------------------------

        if (!stream) {

            clearRemoteVideo();

            return;
        }

        // ----------------------------------------------------
        // CONFIGURAR FLUXO REMOTO
        // ----------------------------------------------------

        remoteVideo.srcObject = stream;

        // ----------------------------------------------------
        // INICIAR REPRODUÇÃO
        // ----------------------------------------------------

        remoteVideo.play().catch((error) => {

            console.warn(
                "Reprodução remota bloqueada:",
                error
            );

            /*
             * Alguns navegadores, especialmente
             * Safari, podem exigir interação do
             * usuário para reproduzir áudio.
             */
        });
    });


    // --------------------------------------------------------
    // 15.2. ESTADO GERAL DA CONEXÃO
    // --------------------------------------------------------

    onWebRTCEvent("connection-state", (state) => {

        console.log(
            "Estado WebRTC:",
            state
        );

        /*
         * Evita atualizar a interface quando
         * não existe uma sessão ativa.
         */

        if (!sessionActive || isLeaving) {
            return;
        }

        switch (state) {

            // =================================================
            // CONEXÃO ESTABELECIDA
            // =================================================

            case "connected":

                peerConnected = true;

                updateConnectionStatus(
                    "Consulta conectada",
                    "connected"
                );

                updateSessionState(
                    "Consulta em andamento",
                    "active"
                );

                // --------------------------------------------
                // INICIAR TEMPORIZADOR
                // --------------------------------------------

                startConsultationTimer(
                    updateConsultationTimer
                );

                console.log(
                    "TeleMed: consulta audiovisual iniciada."
                );

                break;


            // =================================================
            // CONEXÃO EM ESTABELECIMENTO
            // =================================================

            case "connecting":

                peerConnected = false;

                updateConnectionStatus(
                    "Estabelecendo conexão...",
                    "waiting"
                );

                updateSessionState(
                    "Conectando participantes"
                );

                break;


            // =================================================
            // CONEXÃO TEMPORARIAMENTE INTERROMPIDA
            // =================================================

            case "disconnected":

                peerConnected = false;

                updateConnectionStatus(
                    "Conexão temporariamente interrompida",
                    "waiting"
                );

                updateSessionState(
                    "Conexão interrompida",
                    "interrupted"
                );

                /*
                 * Não interrompemos o temporizador
                 * imediatamente.
                 *
                 * A conexão pode se recuperar
                 * automaticamente.
                 */

                break;


            // =================================================
            // FALHA NA CONEXÃO
            // =================================================

            case "failed":

                peerConnected = false;

                updateConnectionStatus(
                    "Falha na conexão WebRTC",
                    "disconnected"
                );

                updateSessionState(
                    "Falha na comunicação",
                    "error"
                );

                // --------------------------------------------
                // INTERROMPER TEMPORIZADOR
                // --------------------------------------------

                stopConsultationTimer();

                console.error(
                    "TeleMed: falha na conexão audiovisual."
                );

                break;


            // =================================================
            // CONEXÃO ENCERRADA
            // =================================================

            case "closed":

                peerConnected = false;

                stopConsultationTimer();

                updateSessionState(
                    "Conexão encerrada"
                );

                break;
        }
    });


    // --------------------------------------------------------
    // 15.3. ESTADO DA CONECTIVIDADE ICE
    // --------------------------------------------------------

    onWebRTCEvent("ice-state", (state) => {

        console.log(
            "Estado ICE:",
            state
        );

        /*
         * Estados possíveis:
         *
         * new
         * checking
         * connected
         * completed
         * disconnected
         * failed
         * closed
         *
         * O indicador principal utiliza
         * connectionState para evitar
         * atualizações conflitantes.
         */
    });


    // --------------------------------------------------------
    // 15.4. ERROS INTERNOS DO WEBRTC
    // --------------------------------------------------------

    onWebRTCEvent("error", (error) => {

        console.error(
            "Erro WebRTC:",
            error
        );

        if (!sessionActive || isLeaving) {
            return;
        }

        /*
         * Um erro isolado de candidato ICE
         * não significa necessariamente que
         * a conexão audiovisual falhou.
         *
         * Por isso, registramos o erro sem
         * encerrar automaticamente a sessão.
         */
    });
}


// ============================================================
// 16. INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================

/**
 * Inicializa os componentes da aplicação.
 *
 * Responsabilidades:
 *
 * - Recuperar elementos da interface;
 * - Registrar eventos WebSocket;
 * - Registrar eventos WebRTC;
 * - Configurar botões;
 * - Inicializar indicadores;
 * - Restaurar o temporizador.
 */
function initializeApplication() {

    // --------------------------------------------------------
    // RECUPERAR ELEMENTOS DA INTERFACE
    // --------------------------------------------------------

    const {
        joinButton,
        leaveButton,
        microphoneButton,
        cameraButton
    } = getUIElements();

    // --------------------------------------------------------
    // REGISTRAR EVENTOS
    // --------------------------------------------------------

    registerSignalingEvents();

    registerWebRTCEvents();

    // --------------------------------------------------------
    // BOTÃO DE ENTRADA
    // --------------------------------------------------------

    joinButton.addEventListener(
        "click",
        handleJoinCall
    );

    // --------------------------------------------------------
    // BOTÃO DE SAÍDA
    // --------------------------------------------------------

    leaveButton.addEventListener(
        "click",
        handleLeaveCall
    );

    // --------------------------------------------------------
    // CONTROLE DO MICROFONE
    // --------------------------------------------------------

    microphoneButton.addEventListener(
        "click",
        handleToggleMicrophone
    );

    // --------------------------------------------------------
    // CONTROLE DA CÂMERA
    // --------------------------------------------------------

    cameraButton.addEventListener(
        "click",
        handleToggleCamera
    );

    // --------------------------------------------------------
    // ESTADO INICIAL DOS CONTROLES
    // --------------------------------------------------------

    updateSessionControls();

    refreshMediaButtons();

    // --------------------------------------------------------
    // ESTADO INICIAL DA CONSULTA
    // --------------------------------------------------------

    updateConnectionStatus(
        "Pronto para entrar na sala",
        "waiting"
    );

    updateSessionState(
        "Aguardando consulta"
    );

    // --------------------------------------------------------
    // TEMPORIZADOR INICIAL
    // --------------------------------------------------------

    resetConsultationTimer();

    console.log(
        "TeleMed: aplicação inicializada."
    );

    console.log(
        "TeleMed: controles avançados disponíveis."
    );
}


// ============================================================
// 17. ENCERRAMENTO DA PÁGINA
// ============================================================

/**
 * Libera os recursos quando o navegador
 * abandona a página.
 *
 * O evento pagehide também pode ocorrer
 * durante a navegação ou atualização.
 */
window.addEventListener("pagehide", () => {

    // --------------------------------------------------------
    // INVALIDAR OPERAÇÕES PENDENTES
    // --------------------------------------------------------

    ++sessionGeneration;

    isJoining = false;

    isLeaving = true;

    // --------------------------------------------------------
    // INTERROMPER TEMPORIZADOR
    // --------------------------------------------------------

    stopConsultationTimer();

    // --------------------------------------------------------
    // ENCERRAR CONEXÃO WEBRTC
    // --------------------------------------------------------

    closePeerConnection();

    peerConnected = false;

    // --------------------------------------------------------
    // ENCERRAR SINALIZAÇÃO
    // --------------------------------------------------------

    disconnectSignaling();

    // --------------------------------------------------------
    // LIBERAR DISPOSITIVOS
    // --------------------------------------------------------

    stopLocalMedia();

    console.log(
        "TeleMed: recursos da página liberados."
    );
});


// ============================================================
// 18. INICIALIZAÇÃO PELO DOM
// ============================================================

/**
 * Aguarda a construção do documento HTML
 * antes de registrar os controles da interface.
 */
if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApplication,
        { once: true }
    );

} else {

    initializeApplication();
}


// ============================================================
// FIM DO ARQUIVO
// TELEMED — ETAPA 7
// ============================================================

