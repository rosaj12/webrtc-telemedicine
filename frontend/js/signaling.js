
// ============================================================
// TELEMED — CLIENTE DE SINALIZAÇÃO
// ETAPA 8.1.2: CONFIGURAÇÃO DE AMBIENTE
// ============================================================


// ============================================================
// 1. IMPORTAÇÃO DAS CONFIGURAÇÕES
// ============================================================

/**
 * Importa as configurações públicas da aplicação.
 *
 * O endereço WebSocket é definido de acordo
 * com o ambiente de execução.
 */
import {
    APP_CONFIG
} from "./config.js";


/**
 * Endereço do servidor de sinalização.
 *
 * Desenvolvimento local:
 * ws://localhost:3000/signaling
 *
 * Implantação HTTPS:
 * wss://dominio-da-aplicacao/signaling
 *
 * O uso de WSS exige um servidor ou proxy
 * configurado para conexões seguras.
 */
const SIGNALING_URL = APP_CONFIG.signalingUrl;


// ============================================================
// 2. ESTADO DA CONEXÃO
// ============================================================

/**
 * Conexão WebSocket ativa.
 *
 * @type {WebSocket|null}
 */
let socket = null;


/**
 * Identificador da sala atual.
 *
 * @type {string|null}
 */
let currentRoomId = null;


/**
 * Indica se o servidor confirmou a entrada
 * do participante na sala.
 *
 * @type {boolean}
 */
let joined = false;


/**
 * Armazena os observadores registrados
 * para cada evento de sinalização.
 *
 * @type {Map<string, Set<Function>>}
 */
const listeners = new Map();


// ============================================================
// 3. REGISTRO DE OBSERVADORES
// ============================================================

/**
 * Registra um observador para determinado evento.
 *
 * @param {string} eventName
 * Nome do evento.
 *
 * @param {Function} callback
 * Função executada quando o evento ocorrer.
 *
 * @returns {Function}
 * Função responsável por remover o observador.
 */
export function onSignalingEvent(
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

    // Permite cancelar a inscrição posteriormente.
    return () => {

        listeners.get(eventName)?.delete(callback);
    };
}


// ============================================================
// 4. EMISSÃO DE EVENTOS
// ============================================================

/**
 * Notifica os observadores de determinado evento.
 *
 * Cada callback é executado independentemente,
 * evitando que uma exceção interrompa os demais.
 *
 * @param {string} eventName
 * Nome do evento.
 *
 * @param {*} payload
 * Dados associados ao evento.
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
                `Erro no observador "${eventName}":`,
                error
            );
        }
    }
}


// ============================================================
// 5. ENVIO DE MENSAGENS
// ============================================================

/**
 * Envia uma mensagem JSON ao servidor.
 *
 * @param {Object} message
 * Mensagem que será serializada.
 *
 * @throws {Error}
 * Caso o WebSocket não esteja conectado.
 */
function sendMessage(message) {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {

        throw new Error(
            "WebSocket não está conectado."
        );
    }

    socket.send(
        JSON.stringify(message)
    );
}


// ============================================================
// 6. CONEXÃO AO SERVIDOR
// ============================================================

/**
 * Estabelece uma conexão WebSocket.
 *
 * Responsabilidades:
 *
 * - Abrir a conexão;
 * - Processar mensagens JSON;
 * - Confirmar entrada na sala;
 * - Encaminhar eventos aos observadores;
 * - Tratar erros e desconexões;
 * - Ignorar eventos de conexões substituídas.
 *
 * @returns {Promise<void>}
 */
export function connectSignaling() {

    // --------------------------------------------------------
    // CONEXÃO JÁ ESTABELECIDA
    // --------------------------------------------------------

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        return Promise.resolve();
    }

    // --------------------------------------------------------
    // CONEXÃO EM ANDAMENTO
    // --------------------------------------------------------

    if (
        socket &&
        socket.readyState === WebSocket.CONNECTING
    ) {

        return Promise.reject(
            new Error(
                "Conexão já está em andamento."
            )
        );
    }

    // --------------------------------------------------------
    // INICIAR CONEXÃO
    // --------------------------------------------------------

    return new Promise((resolve, reject) => {

        let connection;

        try {

            connection = new WebSocket(
                SIGNALING_URL
            );

        } catch (error) {

            reject(error);

            return;
        }

        socket = connection;

        /**
         * Impede que a Promise seja resolvida
         * ou rejeitada mais de uma vez.
         */
        let settled = false;

        /**
         * Indica se o fechamento foi solicitado
         * intencionalmente pela aplicação.
         */
        let intentionalClose = false;


        // ====================================================
        // CONEXÃO ESTABELECIDA
        // ====================================================

        connection.addEventListener("open", () => {

            if (socket !== connection) {
                return;
            }

            settled = true;

            emit("connected");

            resolve();

            console.log(
                "TeleMed: WebSocket conectado."
            );
        });


        // ====================================================
        // MENSAGEM RECEBIDA
        // ====================================================

        connection.addEventListener(
            "message",
            (event) => {

                if (socket !== connection) {
                    return;
                }

                let message;

                // --------------------------------------------
                // DECODIFICAR JSON
                // --------------------------------------------

                try {

                    message = JSON.parse(
                        event.data
                    );

                } catch {

                    emit("error", {
                        message: "Mensagem JSON inválida."
                    });

                    return;
                }

                // --------------------------------------------
                // VALIDAR ESTRUTURA BÁSICA
                // --------------------------------------------

                if (
                    !message ||
                    typeof message !== "object" ||
                    Array.isArray(message) ||
                    typeof message.type !== "string"
                ) {
                    return;
                }

                // --------------------------------------------
                // CONFIRMAÇÃO DE ENTRADA
                // --------------------------------------------

                if (message.type === "joined") {

                    joined = true;
                }

                // --------------------------------------------
                // ENCAMINHAR EVENTO
                // --------------------------------------------

                emit(
                    message.type,
                    message
                );
            }
        );


        // ====================================================
        // ERRO DE CONEXÃO
        // ====================================================

        connection.addEventListener("error", () => {

            if (socket !== connection) {
                return;
            }

            if (!settled) {

                settled = true;

                reject(
                    new Error(
                        "Falha ao conectar ao servidor."
                    )
                );
            }

            emit("error", {
                message: "Erro na conexão WebSocket."
            });

            console.error(
                "TeleMed: erro na conexão WebSocket."
            );
        });


        // ====================================================
        // CONEXÃO ENCERRADA
        // ====================================================

        connection.addEventListener("close", () => {

            if (socket !== connection) {

                // Uma conexão antiga foi substituída.
                return;
            }

            socket = null;

            joined = false;

            currentRoomId = null;

            // --------------------------------------------
            // CONEXÃO ENCERRADA ANTES DE ABRIR
            // --------------------------------------------

            if (!settled) {

                settled = true;

                reject(
                    new Error(
                        "Conexão encerrada antes de abrir."
                    )
                );
            }

            // --------------------------------------------
            // DISTINGUIR ENCERRAMENTO INTENCIONAL
            // --------------------------------------------

            if (!intentionalClose) {

                emit("disconnected");

                console.warn(
                    "TeleMed: servidor desconectado."
                );

            } else {

                console.log(
                    "TeleMed: conexão encerrada pela aplicação."
                );
            }
        });


        // ====================================================
        // CONTROLE DE ENCERRAMENTO
        // ====================================================

        /**
         * Associa um método de encerramento
         * à instância atual.
         *
         * O método é utilizado internamente
         * por disconnectSignaling().
         */
        connection.closeIntentionally = () => {

            intentionalClose = true;

            connection.close();
        };
    });
}


// ============================================================
// 7. ENTRADA NA SALA
// ============================================================

/**
 * Solicita entrada em uma sala de consulta.
 *
 * O identificador é validado antes do envio.
 *
 * @param {string} roomId
 * Identificador da sala.
 *
 * @throws {Error}
 * Caso o identificador seja inválido.
 */
export function joinSignalingRoom(roomId) {

    // --------------------------------------------------------
    // VALIDAR IDENTIFICADOR
    // --------------------------------------------------------

    const maxLength = APP_CONFIG.maxRoomIdLength;

    const roomPattern = new RegExp(
        `^[a-zA-Z0-9_-]{1,${maxLength}}$`
    );

    if (
        typeof roomId !== "string" ||
        !roomPattern.test(roomId)
    ) {

        throw new Error(
            "Identificador de sala inválido."
        );
    }

    // --------------------------------------------------------
    // SOLICITAR ENTRADA
    // --------------------------------------------------------

    sendMessage({
        type: "join",
        roomId
    });

    // --------------------------------------------------------
    // ATUALIZAR ESTADO LOCAL
    // --------------------------------------------------------

    currentRoomId = roomId;

    joined = false;
}


// ============================================================
// 8. ENCAMINHAMENTO WEBRTC
// ============================================================

/**
 * Encaminha mensagens WebRTC ao servidor.
 *
 * Tipos esperados:
 *
 * - offer;
 * - answer;
 * - ice-candidate.
 *
 * A validação detalhada das mensagens
 * também deve ocorrer no backend.
 *
 * @param {Object} message
 * Mensagem de sinalização.
 */
export function sendSignalingMessage(message) {

    if (!joined) {

        throw new Error(
            "Entrada na sala ainda não confirmada."
        );
    }

    sendMessage(message);
}


// ============================================================
// 9. ENCERRAMENTO DA SINALIZAÇÃO
// ============================================================

/**
 * Sai da sala e encerra o WebSocket.
 *
 * O encerramento solicitado pela aplicação
 * não deve emitir o evento "disconnected",
 * evitando que app.js interprete a saída
 * voluntária como falha do servidor.
 */
export function disconnectSignaling() {

    if (!socket) {
        return;
    }

    const connection = socket;

    // --------------------------------------------------------
    // SOLICITAR SAÍDA DA SALA
    // --------------------------------------------------------

    if (
        connection.readyState === WebSocket.OPEN &&
        joined
    ) {

        try {

            connection.send(
                JSON.stringify({
                    type: "leave"
                })
            );

        } catch (error) {

            console.warn(
                "Não foi possível enviar a saída:",
                error
            );
        }
    }

    // --------------------------------------------------------
    // ENCERRAR CONEXÃO
    // --------------------------------------------------------

    try {

        if (
            connection.readyState === WebSocket.OPEN ||
            connection.readyState === WebSocket.CONNECTING
        ) {

            connection.closeIntentionally();
        }

    } catch (error) {

        console.warn(
            "Erro ao encerrar WebSocket:",
            error
        );
    }

    // --------------------------------------------------------
    // RESTAURAR ESTADO LOCAL
    // --------------------------------------------------------

    if (socket === connection) {

        socket = null;
    }

    joined = false;

    currentRoomId = null;
}


// ============================================================
// 10. CONSULTA DO ESTADO DA SINALIZAÇÃO
// ============================================================

/**
 * Retorna o identificador da sala atual.
 *
 * @returns {string|null}
 */
export function getCurrentRoomId() {

    return currentRoomId;
}


/**
 * Informa se o servidor confirmou a entrada
 * do participante na sala.
 *
 * @returns {boolean}
 */
export function isSignalingJoined() {

    return joined;
}


// ============================================================
// FIM DO MÓDULO DE SINALIZAÇÃO
// TELEMED — ETAPA 8.1.2
// ============================================================
