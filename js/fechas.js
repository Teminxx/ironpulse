// Utilidades de fecha. Todas las fechas de usuario usan hora local y formato YYYY-MM-DD.

const FORMATO_FECHA = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
});

function dosCifras(valor) {
    return String(valor).padStart(2, "0");
}

export function fechaLocalISO(fecha = new Date()) {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
        throw new TypeError("La fecha recibida no es válida.");
    }

    return [
        fecha.getFullYear(),
        dosCifras(fecha.getMonth() + 1),
        dosCifras(fecha.getDate())
    ].join("-");
}

export function hoyLocal() {
    return fechaLocalISO(new Date());
}

export function esFechaISOValida(texto) {
    if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return false;
    }

    const [anio, mes, dia] = texto.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia, 12, 0, 0, 0);

    return fecha.getFullYear() === anio
        && fecha.getMonth() === mes - 1
        && fecha.getDate() === dia;
}

export function parsearFechaLocal(texto) {
    if (!esFechaISOValida(texto)) {
        return null;
    }

    const [anio, mes, dia] = texto.split("-").map(Number);
    return new Date(anio, mes - 1, dia, 12, 0, 0, 0);
}

export function formatearFecha(texto) {
    const fecha = parsearFechaLocal(texto);

    if (!fecha) {
        return "Fecha no válida";
    }

    const formateada = FORMATO_FECHA.format(fecha).replace(/\./g, "");
    return formateada.charAt(0).toUpperCase() + formateada.slice(1);
}
