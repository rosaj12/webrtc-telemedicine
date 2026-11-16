
// ============================================================
// TELEMED — COMUNICAÇÃO WEBRTC
// ETAPA 6: CONEXÃO PEER-TO-PEER
// ============================================================

import {
    getLocalStream
} from "./media.js";

import {
    sendSignalingMessage
} from "./signaling.js";


// ============================================================
// CONFIGURAÇÃO ICE
// ============================================================

/**
 * Configuração dos servidores ICE.
 *
 * STUN auxilia na descoberta de conectividade.
 *
 * TURN será configurado na Etapa 8 para permitir
 * comunicação em redes mais restritivas.
 *
 * @type {RTCConfiguration}
 */
const RTC_CONFIGURATION = {

    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ],

    iceCandidatePoolSize: 0

};


// ============================================================
// ESTADO DA CONEXÃO
// ============================================================

/**
 * Conexão WebRTC ativa.
 *
 * @type {RTCPeerConnection|null}
 */
let peerConnection = null;


/**
 * Candidatos ICE recebidos antes da configuração
 * da descrição remota.
 *
 * @type {RTCIceCandidateInit[]}
 */
let pendingCandidates = [];


/**
 * Fluxo multimídia remoto.
 *
 * @type {MediaStream|null}
 */
let remoteStream = null;


/**
 * Observadores dos eventos WebRTC.
 *
 * @type {Map<string, Set<Function>>}
 */
const listeners = new Map();


// ============================================================
// SISTEMA DE EVENTOS
// ============================================================

/**
 * Registra um observador para um evento WebRTC.
 *
 * @param {string} eventName
 * Nome do evento.
 *
 * @param {Function} callback
 * Função executada quando o evento ocorrer.
 *
 * @returns {Function}
 * Função para remover o observador.
 */
export function onWebRTCEvent(
    eventName,
    callback
) {

    if (!listeners.has(eventName)) {

        listeners.set(
            eventName,
            new Set()
        );
    }

    listeners.get(eventName).add(callback);

    return () => {

        listeners.get(eventName)?.delete(
            callback
        );
    };
}


/**
 * Notifica os observadores registrados.
 *
 * @param {string} eventName
 * @param {*} payload
 */
function emit(eventName, payload) {

    const callbacks = listeners.get(eventName);

    if (!callbacks) {
        return;
    }

    for (const callback of callbacks) {

        try {

            callback(payload);

        } catch (error) {

            console.error(
                "Erro em observador WebRTC:",
                error
            );
        }
    }
}


// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Verifica se uma conexão permanece ativa.
 *
 * @param {RTCPeerConnection} connection
 * @returns {boolean}
 */
function isConnectionActive(connection) {

    return (
        peerConnection === connection &&
        connection.signalingState !== "closed"
    );
}


/**
 * Retorna a conexão ativa.
 *
 * @returns {RTCPeerConnection|null}
 */
export function getPeerConnection() {

    if (
        peerConnection &&
        peerConnection.signalingState !== "closed"
    ) {
        return peerConnection;
    }

    return null;
}


// ============================================================
// CRIAÇÃO DA CONEXÃO
// ============================================================

/**
 * Cria uma conexão RTCPeerConnection.
 *
 * Responsabilidades:
 *
 * - Recuperar o fluxo multimídia local;
 * - Criar a conexão WebRTC;
 * - Adicionar trilhas de áudio e vídeo;
 * - Registrar eventos ICE;
 * - Receber trilhas remotas;
 * - Monitorar estados da conexão.
 *
 * @returns {RTCPeerConnection}
 */
export function createPeerConnection() {

    // --------------------------------------------------------
    // REUTILIZAÇÃO DA CONEXÃO
    // --------------------------------------------------------

    const existingConnection = getPeerConnection();

    if (existingConnection) {
        return existingConnection;
    }

    // --------------------------------------------------------
    // VERIFICAÇÃO DO FLUXO LOCAL
    // --------------------------------------------------------

    const localStream = getLocalStream();

    if (!localStream) {

        throw new Error(
            "Fluxo multimídia local não disponível."
        );
    }

    // --------------------------------------------------------
    // CRIAÇÃO DA CONEXÃO
    // --------------------------------------------------------

    const connection = new RTCPeerConnection(
        RTC_CONFIGURATION
    );

    peerConnection = connection;

    /*
     * IMPORTANTE:
     *
     * Não limpamos pendingCandidates aqui.
     *
     * Candidatos ICE podem chegar antes da
     * criação da RTCPeerConnection.
     *
     * Eles serão processados após a aplicação
     * da descrição remota.
     */

    remoteStream = new MediaStream();

    // --------------------------------------------------------
    // ADICIONAR TRILHAS LOCAIS
    // --------------------------------------------------------

    for (const track of localStream.getTracks()) {

        connection.addTrack(
            track,
            localStream
        );
    }

    // --------------------------------------------------------
    // RECEBER TRILHAS REMOTAS
    // --------------------------------------------------------

    connection.ontrack = (event) => {

        if (!isConnectionActive(connection)) {
            return;
        }

        const receivedTracks =
            event.streams[0]?.getTracks()
            ?? [event.track];

        for (const track of receivedTracks) {

            if (!remoteStream.getTrackById(track.id)) {

                remoteStream.addTrack(track);
            }
        }

        emit(
            "remote-stream",
            remoteStream
        );
    };

    // --------------------------------------------------------
    // ENVIAR CANDIDATOS ICE
    // --------------------------------------------------------

    connection.onicecandidate = (event) => {

        if (!isConnectionActive(connection)) {
            return;
        }

        // O candidato nulo indica o fim da coleta.
        if (!event.candidate) {
            return;
        }

        try {

            sendSignalingMessage({

                type: "ice-candidate",

                candidate: event.candidate.toJSON()

            });

        } catch (error) {

            emit("error", error);
        }
    };

    // --------------------------------------------------------
    // ESTADO GERAL DA CONEXÃO
    // --------------------------------------------------------

    connection.onconnectionstatechange = () => {

        if (!isConnectionActive(connection)) {
            return;
        }

        emit(
            "connection-state",
            connection.connectionState
        );
    };

    // --------------------------------------------------------
    // ESTADO ICE
    // --------------------------------------------------------

    connection.oniceconnectionstatechange = () => {

        if (!isConnectionActive(connection)) {
            return;
        }

        emit(
            "ice-state",
            connection.iceConnectionState
        );
    };

    console.log(
        "TeleMed: conexão WebRTC criada."
    );

    return connection;
}


// ============================================================
// CRIAÇÃO DA OFERTA SDP
// ============================================================

/**
 * Cria e envia uma oferta SDP.
 *
 * Executada pelo participante que já estava
 * presente quando o segundo entrou na sala.
 *
 * @returns {Promise<void>}
 */
export async function createOffer() {

    const connection = createPeerConnection();

    // A oferta inicial exige estado estável.
    if (connection.signalingState !== "stable") {
        return;
    }

    // --------------------------------------------------------
    // CRIAR OFERTA
    // --------------------------------------------------------

    const offer = await connection.createOffer();

    if (!isConnectionActive(connection)) {
        return;
    }

    // --------------------------------------------------------
    // CONFIGURAR DESCRIÇÃO LOCAL
    // --------------------------------------------------------

    await connection.setLocalDescription(offer);

    if (!isConnectionActive(connection)) {
        return;
    }

    // --------------------------------------------------------
    // ENVIAR OFERTA AO PARTICIPANTE REMOTO
    // --------------------------------------------------------

    sendSignalingMessage({

        type: "offer",

        sdp: {
            type: connection.localDescription.type,
            sdp: connection.localDescription.sdp
        }

    });

    console.log(
        "TeleMed: oferta SDP enviada."
    );
}


// ============================================================
// RECEBIMENTO DA OFERTA SDP
// ============================================================

/**
 * Processa uma oferta SDP recebida.
 *
 * Cria uma resposta e a encaminha ao participante
 * que iniciou a negociação.
 *
 * @param {RTCSessionDescriptionInit} offer
 * @returns {Promise<void>}
 */
export async function handleOffer(offer) {

    const connection = createPeerConnection();

    if (connection.signalingState !== "stable") {

        throw new Error(
            "Estado incompatível com oferta SDP."
        );
    }

    // --------------------------------------------------------
    // APLICAR DESCRIÇÃO REMOTA
    // --------------------------------------------------------

    await connection.setRemoteDescription(offer);

    if (!isConnectionActive(connection)) {
        return;
    }

    // --------------------------------------------------------
    // PROCESSAR CANDIDATOS PENDENTES
    // --------------------------------------------------------

    await flushPendingCandidates(connection);

    if (!isConnectionActive(connection)) {
        return;
    }

    // --------------------------------------------------------
    // CRIAR RESPOSTA
    // --------------------------------------------------------

    const answer = await connection.createAnswer();

    if (!isConnectionActive(connection)) {
        return;
    }

    // --------------------------------------------------------
    // CONFIGURAR DESCRIÇÃO LOCAL
    // --------------------------------------------------------

    await connection.setLocalDescription(answer);

    if (!isConnectionActive(connection)) {
        return;
    }

    // --------------------------------------------------------
    // ENVIAR RESPOSTA
    // --------------------------------------------------------

    sendSignalingMessage({

        type: "answer",

        sdp: {
            type: connection.localDescription.type,
            sdp: connection.localDescription.sdp
        }

    });

    console.log(
        "TeleMed: resposta SDP enviada."
    );
}


// ============================================================
// RECEBIMENTO DA RESPOSTA SDP
// ============================================================

/**
 * Processa uma resposta SDP recebida.
 *
 * @param {RTCSessionDescriptionInit} answer
 * @returns {Promise<void>}
 */
export async function handleAnswer(answer) {

    const connection = getPeerConnection();

    if (!connection) {

        throw new Error(
            "Conexão WebRTC não encontrada."
        );
    }

    if (
        connection.signalingState !== "have-local-offer"
    ) {

        throw new Error(
            "Resposta SDP recebida em estado inválido."
        );
    }

    // --------------------------------------------------------
    // CONFIGURAR DESCRIÇÃO REMOTA
    // --------------------------------------------------------

    await connection.setRemoteDescription(answer);

    if (!isConnectionActive(connection)) {
        return;
    }

    // --------------------------------------------------------
    // PROCESSAR CANDIDATOS PENDENTES
    // --------------------------------------------------------

    await flushPendingCandidates(connection);

    console.log(
        "TeleMed: resposta SDP processada."
    );
}


// ============================================================
// GERENCIAMENTO DOS CANDIDATOS ICE
// ============================================================

/**
 * Recebe um candidato ICE remoto.
 *
 * Caso a descrição remota ainda não esteja
 * disponível, o candidato será armazenado.
 *
 * @param {RTCIceCandidateInit} candidate
 * @returns {Promise<void>}
 */
export async function handleIceCandidate(candidate) {

    if (
        !candidate ||
        typeof candidate.candidate !== "string"
    ) {

        throw new Error(
            "Candidato ICE inválido."
        );
    }

    const connection = getPeerConnection();

    // --------------------------------------------------------
    // ARMAZENAR CANDIDATO ANTECIPADO
    // --------------------------------------------------------

    if (
        !connection ||
        !connection.remoteDescription
    ) {

        pendingCandidates.push(candidate);

        return;
    }

    // --------------------------------------------------------
    // ADICIONAR CANDIDATO À CONEXÃO
    // --------------------------------------------------------

    await connection.addIceCandidate(candidate);
}


/**
 * Processa candidatos ICE armazenados.
 *
 * @param {RTCPeerConnection} connection
 * @returns {Promise<void>}
 */
async function flushPendingCandidates(connection) {

    while (
        pendingCandidates.length > 0 &&
        isConnectionActive(connection)
    ) {

        const candidate = pendingCandidates.shift();

        try {

            await connection.addIceCandidate(
                candidate
            );

        } catch (error) {

            console.error(
                "Falha ao adicionar candidato ICE:",
                error
            );

            emit("error", error);
        }
    }
}


// ============================================================
// ENCERRAMENTO DA CONEXÃO
// ============================================================

/**
 * Encerra a conexão Peer-to-Peer.
 *
 * Responsabilidades:
 *
 * - Remover os manipuladores de eventos;
 * - Encerrar RTCPeerConnection;
 * - Limpar candidatos pendentes;
 * - Liberar referências ao fluxo remoto;
 * - Notificar a interface.
 *
 * Não interrompe a captura local.
 */
export function closePeerConnection() {

    const connection = peerConnection;

    // Invalida imediatamente a conexão atual.
    peerConnection = null;

    if (connection) {

        // ----------------------------------------------------
        // REMOVER EVENTOS
        // ----------------------------------------------------

        connection.ontrack = null;

        connection.onicecandidate = null;

        connection.onconnectionstatechange = null;

        connection.oniceconnectionstatechange = null;

        // ----------------------------------------------------
        // ENCERRAR CONEXÃO
        // ----------------------------------------------------

        if (connection.signalingState !== "closed") {

            connection.close();
        }
    }

    // --------------------------------------------------------
    // LIMPAR CANDIDATOS ICE
    // --------------------------------------------------------

    pendingCandidates = [];

    // --------------------------------------------------------
    // LIBERAR REFERÊNCIAS AO FLUXO REMOTO
    // --------------------------------------------------------

    if (remoteStream) {

        for (const track of remoteStream.getTracks()) {

            remoteStream.removeTrack(track);
        }

        remoteStream = null;
    }

    // --------------------------------------------------------
    // NOTIFICAR A INTERFACE
    // --------------------------------------------------------

    emit(
        "remote-stream",
        null
    );

    console.log(
        "TeleMed: conexão WebRTC encerrada."
    );
}
