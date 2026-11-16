
// ============================================================
// TELEMED — CONFIGURAÇÃO DO FRONTEND
// ETAPA 8.1: CONFIGURAÇÃO DE AMBIENTE
// ============================================================

/**
 * Identifica se a aplicação está sendo executada
 * em um endereço local de desenvolvimento.
 *
 * @returns {boolean}
 */
function isLocalEnvironment() {

    const hostname = window.location.hostname;

    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]"
    );
}


/**
 * Identifica se o documento utiliza HTTPS.
 *
 * @returns {boolean}
 */
function isSecureConnection() {

    return window.location.protocol === "https:";
}


/**
 * Determina o protocolo WebSocket.
 *
 * HTTPS utiliza WSS.
 * HTTP utiliza WS.
 *
 * @returns {string}
 */
function getWebSocketProtocol() {

    return isSecureConnection()
        ? "wss:"
        : "ws:";
}


/**
 * Define o endereço do servidor de sinalização.
 *
 * Durante o desenvolvimento, o backend
 * utiliza a porta 3000.
 *
 * Em uma implantação futura, o endpoint
 * poderá ser servido por um proxy HTTPS.
 *
 * @returns {string}
 */
function getSignalingUrl() {

    const protocol = getWebSocketProtocol();

    if (isLocalEnvironment()) {

        return `${protocol}//${window.location.hostname}:3000/signaling`;
    }

    return `${protocol}//${window.location.host}/signaling`;
}


/**
 * Configuração pública da aplicação.
 *
 * Não armazenar senhas, tokens privados
 * ou credenciais TURN neste objeto.
 */
export const APP_CONFIG = Object.freeze({

    applicationName: "TeleMed",

    environment: isLocalEnvironment()
        ? "development"
        : "production",

    signalingUrl: getSignalingUrl(),

    secureContext: window.isSecureContext,

    maxRoomIdLength: 64,

    maxParticipants: 2
});
