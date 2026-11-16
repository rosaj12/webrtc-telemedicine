
// ============================================================
// TELEMED — GERENCIAMENTO DE SALAS
// ETAPA 4: SERVIDOR DE SINALIZAÇÃO
// ============================================================

/**
 * Armazena as salas ativas.
 *
 * Chave: identificador da sala.
 * Valor: conjunto de clientes WebSocket.
 */
const rooms = new Map();

/**
 * Armazena a sala associada a cada cliente.
 *
 * WeakMap permite consultar a sala de um cliente
 * sem percorrer todas as salas existentes.
 */
const clientRooms = new WeakMap();

/**
 * Limite de participantes por sala.
 */
const MAX_PARTICIPANTS = 2;


/**
 * Adiciona um cliente a uma sala.
 *
 * @param {WebSocket} client
 * @param {string} roomId
 *
 * @returns {Object}
 * Resultado da operação.
 */
export function joinRoom(client, roomId) {

    // Impede que o cliente participe de várias salas.
    if (clientRooms.has(client)) {
        return {
            success: false,
            error: "Cliente já pertence a uma sala."
        };
    }

    // Recupera ou cria a sala.
    let room = rooms.get(roomId);

    if (!room) {
        room = new Set();
        rooms.set(roomId, room);
    }

    // Verifica o limite de participantes.
    if (room.size >= MAX_PARTICIPANTS) {
        return {
            success: false,
            error: "Sala cheia."
        };
    }

    // Adiciona o cliente.
    room.add(client);

    // Associa o cliente à sala.
    clientRooms.set(client, roomId);

    return {
        success: true,
        roomId,
        participants: room.size
    };
}


/**
 * Remove um cliente da sala.
 *
 * @param {WebSocket} client
 *
 * @returns {string|null}
 * Identificador da sala anterior.
 */
export function leaveRoom(client) {

    const roomId = clientRooms.get(client);

    if (!roomId) {
        return null;
    }

    const room = rooms.get(roomId);

    if (room) {

        room.delete(client);

        // Remove salas vazias.
        if (room.size === 0) {
            rooms.delete(roomId);
        }
    }

    clientRooms.delete(client);

    return roomId;
}


/**
 * Retorna os clientes de uma sala.
 *
 * @param {string} roomId
 * @returns {Set<WebSocket>}
 */
export function getRoomClients(roomId) {

    return rooms.get(roomId) ?? new Set();
}


/**
 * Retorna a sala associada a um cliente.
 *
 * @param {WebSocket} client
 * @returns {string|null}
 */
export function getClientRoom(client) {

    return clientRooms.get(client) ?? null;
}


/**
 * Retorna a quantidade de salas ativas.
 *
 * @returns {number}
 */
export function getActiveRoomCount() {

    return rooms.size;
}
