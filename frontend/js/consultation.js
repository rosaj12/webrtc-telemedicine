
// ============================================================
// TELEMED — GERENCIAMENTO DA CONSULTA
// ETAPA 7: CONTROLES AVANÇADOS
// ============================================================

/**
 * Momento em que a comunicação WebRTC foi estabelecida.
 *
 * @type {number|null}
 */
let consultationStartedAt = null;

/**
 * Identificador do temporizador.
 *
 * @type {number|null}
 */
let timerId = null;

/**
 * Observador responsável por atualizar a duração.
 *
 * @type {Function|null}
 */
let timerCallback = null;


// ============================================================
// FORMATAÇÃO DA DURAÇÃO
// ============================================================

/**
 * Converte segundos para HH:MM:SS.
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatDuration(totalSeconds) {

    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
}


// ============================================================
// CONSULTA ATIVA
// ============================================================

/**
 * Inicia a contagem da consulta.
 *
 * @param {Function} onTick
 * Função chamada com a duração formatada.
 */
export function startConsultationTimer(onTick) {

    // Impede temporizadores duplicados.
    if (timerId !== null) {
        return;
    }

    consultationStartedAt = Date.now();
    timerCallback = onTick;

    /**
     * Calcula a duração a partir do relógio.
     *
     * Isso evita acumular erros causados por atrasos
     * na execução do setInterval.
     */
    function updateTimer() {

        const elapsedSeconds = Math.floor(
            (Date.now() - consultationStartedAt) / 1000
        );

        timerCallback?.(
            formatDuration(elapsedSeconds)
        );
    }

    updateTimer();

    timerId = window.setInterval(
        updateTimer,
        1000
    );
}


// ============================================================
// ENCERRAMENTO DA CONSULTA
// ============================================================

/**
 * Interrompe a contagem e libera o temporizador.
 */
export function stopConsultationTimer() {

    if (timerId !== null) {

        window.clearInterval(timerId);

        timerId = null;
    }

    consultationStartedAt = null;
    timerCallback = null;
}
