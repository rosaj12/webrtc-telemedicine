
// ============================================================
// TELEMED — CONFIGURAÇÃO TLS
// ETAPA 8.2.1: CARREGAMENTO DE CERTIFICADOS
// ============================================================

import fs from "node:fs";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";


// ============================================================
// 1. DIRETÓRIO DO BACKEND
// ============================================================

/**
 * Obtém o diretório deste módulo.
 *
 * Evita depender do diretório em que
 * o comando Node.js foi executado.
 */
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);


// ============================================================
// 2. CONVERSÃO DE CONFIGURAÇÕES
// ============================================================

/**
 * Interpreta uma variável de ambiente booleana.
 *
 * Somente o valor "true" ativa o recurso.
 *
 * @param {string|undefined} value
 * @returns {boolean}
 */
function isEnabled(value) {

    return value?.toLowerCase() === "true";
}


// ============================================================
// 3. LOCALIZAÇÃO DOS CERTIFICADOS
// ============================================================

/**
 * Resolve o caminho de um certificado.
 *
 * Caminhos relativos são interpretados
 * a partir do diretório do backend.
 *
 * @param {string} filePath
 * @returns {string}
 */
function resolveCertificatePath(filePath) {

    if (path.isAbsolute(filePath)) {
        return filePath;
    }

    return path.resolve(
        __dirname,
        filePath
    );
}


// ============================================================
// 4. CARREGAMENTO DA CONFIGURAÇÃO TLS
// ============================================================

/**
 * Retorna a configuração TLS do servidor.
 *
 * Quando TLS está desativado, retorna null.
 *
 * Quando TLS está ativado, exige uma chave
 * privada e um certificado válidos.
 *
 * @returns {{key: Buffer, cert: Buffer}|null}
 */
export function loadTLSConfig() {

    // --------------------------------------------------------
    // VERIFICAR SE TLS ESTÁ ATIVADO
    // --------------------------------------------------------

    const enabled = isEnabled(
        process.env.TELEMED_TLS_ENABLED
    );

    if (!enabled) {
        return null;
    }

    // --------------------------------------------------------
    // OBTER CAMINHOS CONFIGURADOS
    // --------------------------------------------------------

    const keyFile =
        process.env.TELEMED_TLS_KEY;

    const certFile =
        process.env.TELEMED_TLS_CERT;

    if (!keyFile || !certFile) {

        throw new Error(
            "TLS ativado, mas os caminhos da chave " +
            "e do certificado não foram configurados."
        );
    }

    // --------------------------------------------------------
    // RESOLVER CAMINHOS
    // --------------------------------------------------------

    const keyPath =
        resolveCertificatePath(keyFile);

    const certPath =
        resolveCertificatePath(certFile);

    // --------------------------------------------------------
    // CARREGAR CERTIFICADOS
    // --------------------------------------------------------

    try {

        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };

    } catch (error) {

        throw new Error(
            "Não foi possível carregar os arquivos TLS.",
            { cause: error }
        );
    }
}


// ============================================================
// FIM DO MÓDULO TLS
// ============================================================
