// Cálculo de XP y nivel de usuario a partir del historial guardado.
// No se guarda ningún contador: todo se recalcula para evitar desincronizaciones.

export const XP_POR_SERIE = 10;
export const XP_POR_RECORD = 50;
export const XP_POR_ENTRENO_COMPLETO = 100;
export const MINIMO_EJERCICIOS_ENTRENO = 3;

function contarSeriesValidas(entreno) {
    if (!entreno || !Array.isArray(entreno.ejercicios)) {
        return 0;
    }

    return entreno.ejercicios.reduce((total, ejercicio) => {
        if (!ejercicio || !Array.isArray(ejercicio.series)) {
            return total;
        }

        return total + ejercicio.series.filter((serie) => {
            const peso = Number(serie?.peso);
            const reps = Number(serie?.reps);

            return Number.isFinite(peso)
                && peso >= 0.5
                && peso <= 500
                && Number.isInteger(reps)
                && reps >= 1
                && reps <= 30;
        }).length;
    }, 0);
}

export function calcularXP(entrenos, records = new Map()) {
    const lista = Array.isArray(entrenos) ? entrenos : [];
    const recordsValidos = records instanceof Map ? records : new Map();
    let totalSeries = 0;
    let totalRecords = 0;
    let entrenosCompletos = 0;

    lista.forEach((entreno) => {
        const series = contarSeriesValidas(entreno);
        totalSeries += series;
        totalRecords += recordsValidos.get(entreno?.id)?.size ?? 0;

        if (entreno?.ejercicios?.length >= MINIMO_EJERCICIOS_ENTRENO) {
            entrenosCompletos += 1;
        }
    });

    return {
        total: totalSeries * XP_POR_SERIE
            + totalRecords * XP_POR_RECORD
            + entrenosCompletos * XP_POR_ENTRENO_COMPLETO,
        totalSeries,
        totalRecords,
        entrenosCompletos,
        xpSeries: totalSeries * XP_POR_SERIE,
        xpRecords: totalRecords * XP_POR_RECORD,
        xpEntrenosCompletos: entrenosCompletos * XP_POR_ENTRENO_COMPLETO
    };
}

export function calcularNivelUsuario(xp) {
    const valor = Math.max(0, Number(xp) || 0);
    const nivel = Math.floor(Math.sqrt(valor / 100)) + 1;
    const xpBase = (nivel - 1) ** 2 * 100;
    const xpSiguiente = nivel ** 2 * 100;
    const progreso = xpSiguiente > xpBase
        ? Math.min(1, Math.max(0, (valor - xpBase) / (xpSiguiente - xpBase)))
        : 0;

    return {
        nivel,
        xp: valor,
        xpBase,
        xpSiguiente,
        xpFaltante: Math.max(0, xpSiguiente - valor),
        progreso
    };
}

export function calcularResumenXP(entrenos, records) {
    const totales = calcularXP(entrenos, records);

    return {
        ...totales,
        nivel: calcularNivelUsuario(totales.total)
    };
}
