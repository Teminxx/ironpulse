// Cálculo de rachas semanales. La semana empieza en lunes y usa hora local.
import { esFechaISOValida, fechaLocalISO, hoyLocal } from "./fechas.js";

function fechaDesdeISO(fechaIso) {
    const [anio, mes, dia] = fechaIso.split("-").map(Number);
    return new Date(anio, mes - 1, dia, 12, 0, 0, 0);
}

function restarSemana(fechaIso) {
    const fecha = fechaDesdeISO(fechaIso);
    fecha.setDate(fecha.getDate() - 7);
    return fechaLocalISO(fecha);
}

export function inicioSemana(fechaIso = hoyLocal()) {
    if (!esFechaISOValida(fechaIso)) {
        return null;
    }

    const fecha = fechaDesdeISO(fechaIso);
    const desplazamiento = (fecha.getDay() + 6) % 7;
    fecha.setDate(fecha.getDate() - desplazamiento);
    return fechaLocalISO(fecha);
}

export function calcularRachas(entrenos, objetivoSemanal = 3, hoy = hoyLocal()) {
    const objetivo = Math.min(7, Math.max(1, Math.trunc(Number(objetivoSemanal)) || 3));
    const semanaActual = inicioSemana(hoy);
    const conteoPorSemana = new Map();

    if (Array.isArray(entrenos) && semanaActual) {
        entrenos.forEach((entreno) => {
            if (!entreno || !esFechaISOValida(entreno.fecha)) {
                return;
            }

            const semana = inicioSemana(entreno.fecha);

            if (!semana) {
                return;
            }

            conteoPorSemana.set(semana, (conteoPorSemana.get(semana) ?? 0) + 1);
        });
    }

    const entrenosSemanaActual = semanaActual
        ? conteoPorSemana.get(semanaActual) ?? 0
        : 0;

    let racha = 0;
    let cursor = semanaActual;

    if (!cursor) {
        return {
            racha: 0,
            entrenosSemanaActual,
            objetivoSemanal: objetivo
        };
    }

    if (entrenosSemanaActual < objetivo) {
        // La semana actual, mientras sigue en curso, no rompe la racha.
        cursor = restarSemana(cursor);
    }

    while (cursor && (conteoPorSemana.get(cursor) ?? 0) >= objetivo) {
        racha += 1;
        cursor = restarSemana(cursor);
    }

    return {
        racha,
        entrenosSemanaActual,
        objetivoSemanal: objetivo
    };
}
