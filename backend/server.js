
 // ============================================================
 // TELEMED — SERVIDOR DE SINALIZAÇÃO
 // ETAPA 8.2.2: INTEGRAÇÃO HTTPS E WSS
 // PARTE 1 DE 2
 // ============================================================

 // ============================================================
 // 1. IMPORTAÇÕES
 // ============================================================

 /**
  * Servidores HTTP e HTTPS nativos do Node.js.
  */
 import http from "node:http";
 import https from "node:https";

 /**
  * Implementação do protocolo WebSocket.
  */
 import {
     WebSocket,
     WebSocketServer
 } from "ws";

 /**
  * Configurações centralizadas do backend.
  */
 import {
     SERVER_CONFIG
 } from "./config.js";

 /**
  * Carregamento da chave privada e do certificado TLS.
  */
 import {
     loadTLSConfig
 } from "./tls.js";

 /**
  * Gerenciamento das salas e participantes.
  */
 import {
     joinRoom,
     leaveRoom,
     getRoomClients,
     getClientRoom,
     getActiveRoomCount
 } from "./rooms.js";


 // ============================================================
 // 2. CONFIGURAÇÕES DO SERVIDOR
 // ============================================================

 /**
  * Interface de rede utilizada pelo servidor.
  */
 const HOST = SERVER_CONFIG.host;

 /**
  * Porta TCP utilizada pelo servidor.
  */
 const PORT = SERVER_CONFIG.port;

 /**
  * Caminho das conexões WebSocket.
  */
 const SIGNALING_PATH = SERVER_CONFIG.signalingPath;

 /**
  * Tamanho máximo de uma mensagem WebSocket,
  * expresso em bytes.
  */
 const MAX_MESSAGE_BYTES =
     SERVER_CONFIG.maxWebSocketPayload;

 /**
  * Valida identificadores de sala contendo
  * letras, números, hífen ou sublinhado.
  */
 const ROOM_ID_PATTERN =
     /^[a-zA-Z0-9_-]{1,64}$/;


 // ============================================================
 // 3. SERVIDOR HTTP / HTTPS
 // ============================================================

 /**
  * Carrega os certificados quando TLS estiver
  * habilitado nas variáveis de ambiente.
  *
  * Retorna null quando TLS estiver desativado.
  *
  * Caso TLS esteja habilitado e os certificados
  * não possam ser carregados, a inicialização falha.
  */
 const tlsConfig = loadTLSConfig();

 /**
  * Identifica se o transporte TLS está ativo.
  */
 const TLS_ENABLED = tlsConfig !== null;


 /**
  * Processa requisições HTTP ou HTTPS.
  *
  * O endpoint raiz retorna apenas o estado
  * básico do servidor.
  *
  * @param {http.IncomingMessage} request
  * @param {http.ServerResponse} response
  */
 function handleHttpRequest(request, response) {

     // --------------------------------------------------------
     // VALIDAR ENDPOINT HTTP
     // --------------------------------------------------------

     if (
         request.url !== "/" ||
         request.method !== "GET"
     ) {

         response.writeHead(404, {
             "Content-Type":
                 "application/json; charset=utf-8",
             "Cache-Control": "no-store"
         });

         response.end(
             JSON.stringify({
                 error: "Endpoint não encontrado."
             })
         );

         return;
     }

     // --------------------------------------------------------
     // RESPONDER AO HEALTH CHECK
     // --------------------------------------------------------

     response.writeHead(200, {
         "Content-Type":
             "application/json; charset=utf-8",
         "Cache-Control": "no-store"
     });

     response.end(
         JSON.stringify({
             application:
                 SERVER_CONFIG.applicationName,

             status: "running"
         })
     );
 }


 /**
  * Cria o servidor adequado ao ambiente.
  *
  * TLS ativado:
  * https.createServer()
  *
  * TLS desativado:
  * http.createServer()
  *
  * Ambos utilizam o mesmo manipulador
  * de requisições.
  */
 const server = TLS_ENABLED

     ? https.createServer(
         tlsConfig,
         handleHttpRequest
     )

     : http.createServer(
         handleHttpRequest
     );


 // ============================================================
 // 4. SERVIDOR WEBSOCKET
 // ============================================================

 /**
  * Servidor responsável pela sinalização WebRTC.
  *
  * O protocolo acompanha o servidor compartilhado:
  *
  * HTTP  -> WS
  * HTTPS -> WSS
  */
 const wss = new WebSocketServer({

     // Servidor HTTP ou HTTPS compartilhado.
     server,

     // Endpoint de sinalização.
     path: SIGNALING_PATH,

     // Tamanho máximo das mensagens.
     maxPayload: MAX_MESSAGE_BYTES,

     // Desativa a compressão WebSocket.
     perMessageDeflate: false
 });


 // ============================================================
 // 5. FUNÇÕES AUXILIARES
 // ============================================================

 /**
  * Envia uma mensagem JSON a um cliente.
  *
  * @param {WebSocket} client
  * Cliente destinatário.
  *
  * @param {Object} message
  * Mensagem a ser enviada.
  */
 function sendMessage(client, message) {

     // --------------------------------------------------------
     // VERIFICAR ESTADO DA CONEXÃO
     // --------------------------------------------------------

     if (
         client.readyState !== WebSocket.OPEN
     ) {
         return;
     }

     // --------------------------------------------------------
     // SERIALIZAR E ENVIAR
     // --------------------------------------------------------

     try {

         client.send(
             JSON.stringify(message)
         );

     } catch (error) {

         console.error(
             "Erro ao enviar mensagem WebSocket:",
             error
         );
     }
 }


 /**
  * Encaminha uma mensagem aos demais
  * participantes da mesma sala.
  *
  * @param {WebSocket} sender
  * Cliente que originou a mensagem.
  *
  * @param {Object} message
  * Mensagem encaminhada.
  */
 function forwardToPeers(sender, message) {

     // --------------------------------------------------------
     // IDENTIFICAR SALA DE ORIGEM
     // --------------------------------------------------------

     const roomId = getClientRoom(sender);

     if (!roomId) {
         return;
     }

     // --------------------------------------------------------
     // RECUPERAR PARTICIPANTES
     // --------------------------------------------------------

     const clients = getRoomClients(roomId);

     // --------------------------------------------------------
     // ENCAMINHAR AOS DEMAIS CLIENTES
     // --------------------------------------------------------

     for (const client of clients) {

         if (client === sender) {
             continue;
         }

         sendMessage(
             client,
             message
         );
     }
 }


 // ============================================================
 // 6. ENTRADA EM UMA SALA
 // ============================================================

 /**
  * Processa a solicitação de entrada
  * em uma sala de consulta.
  *
  * @param {WebSocket} client
  * Cliente solicitante.
  *
  * @param {Object} message
  * Mensagem contendo o identificador da sala.
  */
 function handleJoin(client, message) {

     const roomId = message.roomId;

     // --------------------------------------------------------
     // VALIDAR IDENTIFICADOR DA SALA
     // --------------------------------------------------------

     if (
         typeof roomId !== "string" ||
         !ROOM_ID_PATTERN.test(roomId)
     ) {

         sendMessage(client, {
             type: "error",
             message: "Identificador de sala inválido."
         });

         return;
     }

     // --------------------------------------------------------
     // SOLICITAR ENTRADA AO GERENCIADOR
     // --------------------------------------------------------

     const result = joinRoom(
         client,
         roomId
     );

     // --------------------------------------------------------
     // VERIFICAR RESULTADO
     // --------------------------------------------------------

     if (!result.success) {

         sendMessage(client, {
             type: "error",
             message: result.error
         });

         return;
     }

     // --------------------------------------------------------
     // CONFIRMAR ENTRADA AO PARTICIPANTE
     // --------------------------------------------------------

     sendMessage(client, {
         type: "joined",
         roomId,
         participants: result.participants
     });

     // --------------------------------------------------------
     // NOTIFICAR PARTICIPANTES EXISTENTES
     // --------------------------------------------------------

     forwardToPeers(client, {
         type: "peer-joined"
     });

     // --------------------------------------------------------
     // REGISTRAR EVENTO
     // --------------------------------------------------------

     console.log(
         `Cliente entrou na sala ${roomId}.`
     );

     console.log(
         `Participantes na sala: ${result.participants}`
     );
 }


 // ============================================================
 // 7. SINALIZAÇÃO WEBRTC
 // ============================================================

 /**
  * Processa mensagens utilizadas para
  * estabelecer a conexão Peer-to-Peer.
  *
  * Tipos:
  *
  * - offer;
  * - answer;
  * - ice-candidate.
  *
  * @param {WebSocket} client
  * Cliente que enviou a mensagem.
  *
  * @param {Object} message
  * Conteúdo da sinalização.
  */
 function handleSignaling(client, message) {

     // --------------------------------------------------------
     // VERIFICAR ASSOCIAÇÃO COM UMA SALA
     // --------------------------------------------------------

     const roomId = getClientRoom(client);

     if (!roomId) {

         sendMessage(client, {
             type: "error",
             message:
                 "Cliente não pertence a uma sala."
         });

         return;
     }

     // ========================================================
     // 7.1. OFERTAS E RESPOSTAS SDP
     // ========================================================

     if (
         message.type === "offer" ||
         message.type === "answer"
     ) {

         // ----------------------------------------------------
         // VALIDAR DESCRIÇÃO SDP
         // ----------------------------------------------------

         if (
             !message.sdp ||
             typeof message.sdp !== "object" ||
             Array.isArray(message.sdp) ||
             message.sdp.type !== message.type ||
             typeof message.sdp.sdp !== "string" ||
             message.sdp.sdp.length === 0
         ) {

             sendMessage(client, {
                 type: "error",
                 message: "SDP inválido."
             });

             return;
         }

         // ----------------------------------------------------
         // ENCAMINHAR DESCRIÇÃO SDP
         // ----------------------------------------------------

         forwardToPeers(client, {
             type: message.type,
             sdp: message.sdp
         });

         return;
     }

     // ========================================================
     // 7.2. CANDIDATOS ICE
     // ========================================================

     if (message.type === "ice-candidate") {

         // ----------------------------------------------------
         // VALIDAR CANDIDATO ICE
         // ----------------------------------------------------

         if (
             !message.candidate ||
             typeof message.candidate !== "object" ||
             Array.isArray(message.candidate) ||
             typeof message.candidate.candidate !== "string"
         ) {

             sendMessage(client, {
                 type: "error",
                 message: "Candidato ICE inválido."
             });

             return;
         }

         // ----------------------------------------------------
         // ENCAMINHAR CANDIDATO ICE
         // ----------------------------------------------------

         forwardToPeers(client, {
             type: "ice-candidate",
             candidate: message.candidate
         });

         return;
     }
 }


 // ============================================================
 // 8. SAÍDA DE UMA SALA
 // ============================================================

 /**
  * Remove o participante de sua sala
  * e notifica os demais participantes.
  *
  * @param {WebSocket} client
  * Cliente que deixou a sala.
  */
 function handleDisconnect(client) {

     // --------------------------------------------------------
     // REMOVER PARTICIPANTE
     // --------------------------------------------------------

     const roomId = leaveRoom(client);

     if (!roomId) {
         return;
     }

     // --------------------------------------------------------
     // NOTIFICAR PARTICIPANTES RESTANTES
     // --------------------------------------------------------

     const remainingClients =
         getRoomClients(roomId);

     for (const peer of remainingClients) {

         sendMessage(peer, {
             type: "peer-left"
         });
     }

     // --------------------------------------------------------
     // REGISTRAR SAÍDA
     // --------------------------------------------------------

     console.log(
         `Cliente saiu da sala ${roomId}.`
     );
 }

 // ============================================================
 // CONTINUA NA PARTE 2 — EVENTOS E INICIALIZAÇÃO
 // ============================================================



// ============================================================
// TELEMED — SERVIDOR DE SINALIZAÇÃO
// ETAPA 8.2.2: INTEGRAÇÃO HTTPS E WSS
// PARTE 2 DE 2
// ============================================================


// ============================================================
// 9. EVENTOS DO SERVIDOR WEBSOCKET
// ============================================================

/**
 * Executado quando um novo cliente
 * estabelece uma conexão WebSocket.
 */
wss.on("connection", (client) => {

    console.log(
        "Nova conexão WebSocket."
    );

    // ========================================================
    // 9.1. MENSAGEM RECEBIDA
    // ========================================================

    client.on(
        "message",
        (rawMessage, isBinary) => {

            // ------------------------------------------------
            // REJEITAR MENSAGENS BINÁRIAS
            // ------------------------------------------------

            if (isBinary) {

                sendMessage(client, {
                    type: "error",
                    message:
                        "Mensagens binárias não são aceitas."
                });

                return;
            }

            let message;

            // ------------------------------------------------
            // DECODIFICAR JSON
            // ------------------------------------------------

            try {

                message = JSON.parse(
                    rawMessage.toString()
                );

            } catch {

                sendMessage(client, {
                    type: "error",
                    message: "JSON inválido."
                });

                return;
            }

            // ------------------------------------------------
            // VALIDAR ESTRUTURA BÁSICA
            // ------------------------------------------------

            if (
                !message ||
                typeof message !== "object" ||
                Array.isArray(message) ||
                typeof message.type !== "string"
            ) {

                sendMessage(client, {
                    type: "error",
                    message: "Mensagem inválida."
                });

                return;
            }

            // ------------------------------------------------
            // PROCESSAR TIPO DA MENSAGEM
            // ------------------------------------------------

            switch (message.type) {

                // ============================================
                // ENTRADA EM SALA
                // ============================================

                case "join":

                    handleJoin(
                        client,
                        message
                    );

                    break;


                // ============================================
                // SINALIZAÇÃO WEBRTC
                // ============================================

                case "offer":
                case "answer":
                case "ice-candidate":

                    handleSignaling(
                        client,
                        message
                    );

                    break;


                // ============================================
                // SAÍDA DA SALA
                // ============================================

                case "leave":

                    handleDisconnect(client);

                    break;


                // ============================================
                // TIPO DESCONHECIDO
                // ============================================

                default:

                    sendMessage(client, {
                        type: "error",
                        message:
                            "Tipo de mensagem desconhecido."
                    });

                    break;
            }
        }
    );


    // ========================================================
    // 9.2. CONEXÃO ENCERRADA
    // ========================================================

    client.on("close", () => {

        /*
         * Remove o participante caso ele ainda
         * esteja associado a alguma sala.
         *
         * A operação deve ser idempotente:
         * uma saída anterior não deve provocar
         * uma segunda notificação.
         */

        handleDisconnect(client);
    });


    // ========================================================
    // 9.3. ERRO NA CONEXÃO
    // ========================================================

    client.on("error", (error) => {

        console.error(
            "Erro WebSocket:",
            error.message
        );
    });
});


// ============================================================
// 10. ERROS DO SERVIDOR WEBSOCKET
// ============================================================

/**
 * Registra falhas internas do servidor
 * responsável pela sinalização.
 */
wss.on("error", (error) => {

    console.error(
        "Erro no servidor WebSocket:",
        error
    );
});


// ============================================================
// 11. ERROS DO SERVIDOR HTTP / HTTPS
// ============================================================

/**
 * Trata erros relacionados ao servidor HTTP/HTTPS,
 * incluindo falhas ao utilizar a porta.
 */
server.on("error", (error) => {

    console.error(
        "Erro no servidor HTTP/HTTPS:",
        error.message
    );

    if (error.code === "EADDRINUSE") {

        console.error(
            `A porta ${PORT} já está em uso.`
        );
    }

    if (error.code === "EACCES") {

        console.error(
            "Permissão insuficiente para iniciar o servidor."
        );
    }

    process.exitCode = 1;
});


// ============================================================
// 12. INICIALIZAÇÃO
// ============================================================

/**
 * Seleciona os protocolos conforme
 * a configuração de transporte TLS.
 *
 * TLS ativado:
 * HTTPS + WSS
 *
 * TLS desativado:
 * HTTP + WS
 */
const HTTP_PROTOCOL = TLS_ENABLED
    ? "https"
    : "http";

const WEBSOCKET_PROTOCOL = TLS_ENABLED
    ? "wss"
    : "ws";


/**
 * Inicia o servidor utilizando as configurações
 * centralizadas em backend/config.js.
 *
 * Não existe fallback silencioso para HTTP
 * quando TLS está ativado e apresenta erros.
 */
server.listen(PORT, HOST, () => {

    // --------------------------------------------------------
    // ENDEREÇO DO SERVIDOR HTTP / HTTPS
    // --------------------------------------------------------

    console.log(
        `TeleMed: servidor em ` +
        `${HTTP_PROTOCOL}://${HOST}:${PORT}`
    );

    // --------------------------------------------------------
    // ENDEREÇO DO SERVIDOR WEBSOCKET
    // --------------------------------------------------------

    console.log(
        `TeleMed: sinalização em ` +
        `${WEBSOCKET_PROTOCOL}://${HOST}:${PORT}${SIGNALING_PATH}`
    );

    // --------------------------------------------------------
    // ESTADO DO TLS
    // --------------------------------------------------------

    console.log(
        `TLS: ${TLS_ENABLED ? "ativado" : "desativado"}`
    );

    // --------------------------------------------------------
    // AMBIENTE DE EXECUÇÃO
    // --------------------------------------------------------

    console.log(
        `Ambiente: ${SERVER_CONFIG.environment}`
    );

    // --------------------------------------------------------
    // SALAS ATIVAS
    // --------------------------------------------------------

    console.log(
        `Salas ativas: ${getActiveRoomCount()}`
    );
});


// ============================================================
// FIM DO SERVIDOR DE SINALIZAÇÃO
// TELEMED — ETAPA 8.2.2
// ============================================================
