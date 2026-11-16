
// ============================================================
// TELEMED — CONFIGURAÇÃO DO BACKEND
// ETAPA 8.1: CONFIGURAÇÃO DE AMBIENTE
// ============================================================

/**
 * Recupera uma variável de ambiente textual.
 *
 * @param {string} name
 * Nome da variável.
 *
 * @param {string} fallback
 * Valor padrão.
 *
 * @returns {string}
 */
function getEnvironmentVariable(name, fallback) {

    const value = process.env[name];

    return value?.trim() || fallback;
}


/**
 * Recupera uma porta TCP válida.
 *
 * @param {string} value
 * Valor da variável de ambiente.
 *
 * @param {number} fallback
 * Porta padrão.
 *
 * @returns {number}
 */
function parsePort(value, fallback) {

    if (!/^\d+$/.test(value ?? "")) {
        return fallback;
    }

    const port = Number(value);

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        return fallback;
    }

    return port;
}


/**
 * Recupera o ambiente de execução.
 *
 * @returns {string}
 */
function getEnvironment() {

    return getEnvironmentVariable(
        "NODE_ENV",
        "development"
    );
}


/**
 * Configurações do servidor TeleMed.
 *
 * As configurações são carregadas durante
 * a inicialização do processo Node.js.
 */
export const SERVER_CONFIG = Object.freeze({

    applicationName: "TeleMed",

    environment: getEnvironment(),

    host: getEnvironmentVariable(
        "TELEMED_HOST",
        "127.0.0.1"
    ),

    port: parsePort(
        process.env.TELEMED_PORT,
        3000
    ),

    signalingPath: "/signaling",

    maxParticipantsPerRoom: 2,

    maxWebSocketPayload: 16 * 1024
});
