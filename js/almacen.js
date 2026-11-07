// Acceso único a localStorage. Los datos se guardan en un solo objeto con versión.
import { esFechaISOValida, hoyLocal } from "./fechas.js";
import { esGrupoValido } from "./ejercicios.js";

export const VERSION_DATOS = 1;

const CLAVE_DATOS = "ironpulse.datos";

function crearAjustesPorDefecto() {
    return {
        sexo: null,
        pesoCorporal: null,
        objetivoSemanal: 3
    };
}

function crearDatosPorDefecto() {
    return {
        version: VERSION_DATOS,
        entrenos: [],
        ajustes: crearAjustesPorDefecto(),
        ejerciciosPropios: [],
        borrador: null,
        historialPesoCorporal: []
    };
}

function esObjeto(valor) {
    return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function numeroEnRango(valor, minimo, maximo) {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= minimo && numero <= maximo
        ? numero
        : null;
}

function normalizarAjustes(valor) {
    const ajustes = esObjeto(valor) ? valor : {};
    const sexo = ajustes.sexo === "masculino" || ajustes.sexo === "femenino"
        ? ajustes.sexo
        : null;
    const pesoCorporal = ajustes.pesoCorporal === null || ajustes.pesoCorporal === undefined
        ? null
        : numeroEnRango(ajustes.pesoCorporal, 30, 300);
    const objetivo = Number(ajustes.objetivoSemanal);
    const objetivoSemanal = Number.isInteger(objetivo) && objetivo >= 1 && objetivo <= 7
        ? objetivo
        : 3;

    return { sexo, pesoCorporal, objetivoSemanal };
}

function normalizarSeriesGuardadas(series) {
    if (!Array.isArray(series)) {
        return [];
    }

    return series.reduce((resultado, serie) => {
        if (!esObjeto(serie)) {
            return resultado;
        }

        const peso = numeroEnRango(serie.peso, 0.5, 500);
        const reps = Number(serie.reps);

        if (peso === null || !Number.isInteger(reps) || reps < 1 || reps > 30) {
            return resultado;
        }

        resultado.push({ peso, reps });
        return resultado;
    }, []);
}

function normalizarEntrenos(valor) {
    if (!Array.isArray(valor)) {
        return [];
    }

    const idsVistos = new Set();

    return valor.reduce((resultado, entreno) => {
        if (!esObjeto(entreno) || typeof entreno.id !== "string" || !entreno.id.trim()) {
            return resultado;
        }

        if (idsVistos.has(entreno.id) || !esFechaISOValida(entreno.fecha)) {
            return resultado;
        }

        const ejercicios = Array.isArray(entreno.ejercicios)
            ? entreno.ejercicios.reduce((lista, ejercicio) => {
                if (!esObjeto(ejercicio) || typeof ejercicio.ejercicioId !== "string") {
                    return lista;
                }

                const series = normalizarSeriesGuardadas(ejercicio.series);
                if (series.length === 0) {
                    return lista;
                }

                lista.push({ ejercicioId: ejercicio.ejercicioId, series });
                return lista;
            }, [])
            : [];

        if (ejercicios.length === 0) {
            return resultado;
        }

        const normalizado = {
            id: entreno.id,
            fecha: entreno.fecha,
            ejercicios
        };

        if (Number.isFinite(Number(entreno.duracionMin)) && Number(entreno.duracionMin) > 0) {
            normalizado.duracionMin = Number(entreno.duracionMin);
        }

        idsVistos.add(entreno.id);
        resultado.push(normalizado);
        return resultado;
    }, []);
}

function normalizarEjerciciosPropios(valor) {
    if (!Array.isArray(valor)) {
        return [];
    }

    const idsVistos = new Set();

    return valor.reduce((resultado, ejercicio) => {
        if (!esObjeto(ejercicio) || typeof ejercicio.id !== "string" || !ejercicio.id.trim()) {
            return resultado;
        }

        const nombre = typeof ejercicio.nombre === "string" ? ejercicio.nombre.trim() : "";

        if (!nombre || idsVistos.has(ejercicio.id) || !esGrupoValido(ejercicio.grupo)) {
            return resultado;
        }

        idsVistos.add(ejercicio.id);
        resultado.push({
            id: ejercicio.id,
            nombre: nombre.slice(0, 50),
            grupo: ejercicio.grupo,
            rankeable: false
        });
        return resultado;
    }, []);
}

function normalizarHistorialPeso(valor) {
    if (!Array.isArray(valor)) {
        return [];
    }

    const porFecha = new Map();

    valor.forEach((registro) => {
        if (!esObjeto(registro) || !esFechaISOValida(registro.fecha)) {
            return;
        }

        const peso = numeroEnRango(registro.peso, 30, 300);
        if (peso !== null) {
            porFecha.set(registro.fecha, peso);
        }
    });

    return Array.from(porFecha, ([fecha, peso]) => ({ fecha, peso }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function normalizarSerieBorrador(serie) {
    if (!esObjeto(serie)) {
        return { peso: "", reps: "", completada: false };
    }

    return {
        peso: typeof serie.peso === "string" ? serie.peso.slice(0, 12) : "",
        reps: typeof serie.reps === "string" ? serie.reps.slice(0, 4) : "",
        completada: Boolean(serie.completada)
    };
}

function normalizarBorrador(valor) {
    if (!esObjeto(valor) || !Array.isArray(valor.ejercicios)) {
        return null;
    }

    const ejercicios = valor.ejercicios.reduce((resultado, ejercicio) => {
        if (!esObjeto(ejercicio) || typeof ejercicio.ejercicioId !== "string") {
            return resultado;
        }

        const series = Array.isArray(ejercicio.series)
            ? ejercicio.series.slice(0, 40).map(normalizarSerieBorrador)
            : [];

        resultado.push({ ejercicioId: ejercicio.ejercicioId, series });
        return resultado;
    }, []);

    if (ejercicios.length === 0 && typeof valor.entrenoId !== "string") {
        return null;
    }

    return {
        fecha: esFechaISOValida(valor.fecha) ? valor.fecha : hoyLocal(),
        ejercicios,
        entrenoId: typeof valor.entrenoId === "string" && valor.entrenoId.trim()
            ? valor.entrenoId
            : null
    };
}

function normalizarDatos(valor) {
    if (!esObjeto(valor)) {
        return crearDatosPorDefecto();
    }

    // La versión permite aplicar migraciones futuras. Por ahora, la estructura 1 es la base.
    return {
        version: VERSION_DATOS,
        entrenos: normalizarEntrenos(valor.entrenos),
        ajustes: normalizarAjustes(valor.ajustes),
        ejerciciosPropios: normalizarEjerciciosPropios(valor.ejerciciosPropios),
        borrador: normalizarBorrador(valor.borrador),
        historialPesoCorporal: normalizarHistorialPeso(valor.historialPesoCorporal)
    };
}

export function normalizarDatosImportados(valor) {
    if (!esObjeto(valor) || !Array.isArray(valor.entrenos)) {
        return null;
    }

    return normalizarDatos(valor);
}

export function cargarDatos() {
    try {
        const texto = localStorage.getItem(CLAVE_DATOS);
        if (!texto) {
            return crearDatosPorDefecto();
        }

        return normalizarDatos(JSON.parse(texto));
    } catch (error) {
        console.warn("No se pudieron leer los datos guardados. Se usarán datos vacíos.", error);

        try {
            localStorage.removeItem(CLAVE_DATOS);
        } catch (errorLimpieza) {
            console.warn("Tampoco se pudo limpiar el almacenamiento local.", errorLimpieza);
        }

        return crearDatosPorDefecto();
    }
}

export function guardarDatos(datos) {
    try {
        const datosConVersion = { ...datos, version: VERSION_DATOS };
        localStorage.setItem(CLAVE_DATOS, JSON.stringify(datosConVersion));
        return true;
    } catch (error) {
        console.warn("No se pudieron guardar los datos en este dispositivo.", error);
        return false;
    }
}

export function actualizarDatos(modificador) {
    if (typeof modificador !== "function") {
        return null;
    }

    const datos = cargarDatos();
    const resultado = modificador(datos) ?? datos;

    return guardarDatos(resultado) ? resultado : null;
}
