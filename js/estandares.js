// Estándares de fuerza y rangos de IronPulse.
// Los umbrales son valores de partida aproximados y editables. Representan el
// 1RM estimado dividido entre el peso corporal actual.
// Cada ejercicio define seis anclas: Hierro I, Bronce I, Plata I, Oro I,
// Platino I y Ascendente I. A partir de ellas se reparten los tres subrangos de
// cada familia. Radiante queda un 25 % por encima de Ascendente I, por lo que es
// un rango muy difícil de alcanzar.

const FAMILIAS = Object.freeze([
    { nombre: "Hierro", clase: "rango-hierro" },
    { nombre: "Bronce", clase: "rango-bronce" },
    { nombre: "Plata", clase: "rango-plata" },
    { nombre: "Oro", clase: "rango-oro" },
    { nombre: "Platino", clase: "rango-platino" },
    { nombre: "Ascendente", clase: "rango-ascendente" },
    { nombre: "Radiante", clase: "rango-radiante" }
]);

export const RANGOS = Object.freeze(
    FAMILIAS.flatMap((familia) => {
        if (familia.nombre === "Radiante") {
            return [{ nombre: familia.nombre, clase: familia.clase, familia: familia.nombre }];
        }

        return ["I", "II", "III"].map((sufijo) => ({
            nombre: `${familia.nombre} ${sufijo}`,
            clase: familia.clase,
            familia: familia.nombre
        }));
    })
);

export const MULTIPLICADOR_FEMENINO = 0.65;
export const FACTOR_RADIANTE = 1.25;

function anclas(valores) {
    return Object.freeze(valores);
}

// Hombres: ratio 1RM / peso corporal.
// Anclas: [Hierro I, Bronce I, Plata I, Oro I, Platino I, Ascendente I].
// Los cuatro movimientos base usan valores de referencia. El resto se deriva
// por proporción y se redondea para que sea fácil ajustarlo a mano.
export const UMBRALES_HOMBRE = Object.freeze({
    // Pecho
    "aperturas-maquina": anclas([0, 0.25, 0.4, 0.55, 0.7, 0.85]),
    "aperturas-mancuernas": anclas([0, 0.2, 0.32, 0.45, 0.58, 0.72]),
    "press-inclinado-maquina": anclas([0, 0.43, 0.77, 1.06, 1.36, 1.7]),
    "press-inclinado-mancuernas": anclas([0, 0.4, 0.72, 1.0, 1.28, 1.6]),
    "press-pecho-maquina": anclas([0, 0.45, 0.81, 1.13, 1.44, 1.8]),
    "press-banca-mancuernas": anclas([0, 0.4, 0.72, 1.0, 1.28, 1.6]),
    "press-banca": anclas([0, 0.5, 0.9, 1.25, 1.6, 2.0]),
    "cruces-polea": anclas([0, 0.25, 0.4, 0.55, 0.7, 0.85]),
    "fondos": anclas([0, 0.5, 0.85, 1.2, 1.55, 1.9]),

    // Espalda
    "jalon-al-pecho": anclas([0, 0.5, 0.75, 1.0, 1.25, 1.5]),
    "jalon-cerrado": anclas([0, 0.45, 0.68, 0.9, 1.13, 1.35]),
    "remo-sentado-cerrado": anclas([0, 0.5, 0.75, 1.0, 1.25, 1.5]),
    "remo-sentado-amplio": anclas([0, 0.5, 0.75, 1.0, 1.25, 1.5]),
    "remo-t": anclas([0, 0.45, 0.7, 0.95, 1.2, 1.45]),
    "jalon-maquina": anclas([0, 0.5, 0.75, 1.0, 1.25, 1.5]),
    "remo-mancuerna": anclas([0, 0.45, 0.68, 0.9, 1.13, 1.35]),
    "face-pull": anclas([0, 0.2, 0.3, 0.4, 0.5, 0.6]),
    "remo-maquina": anclas([0, 0.5, 0.75, 1.0, 1.25, 1.5]),
    "pullover-mancuerna": anclas([0, 0.25, 0.4, 0.55, 0.7, 0.85]),

    // Bíceps
    "curl-martillo": anclas([0, 0.2, 0.36, 0.5, 0.64, 0.8]),
    "curl-banco-inclinado": anclas([0, 0.18, 0.32, 0.45, 0.58, 0.72]),
    "curl-predicador": anclas([0, 0.2, 0.36, 0.5, 0.64, 0.8]),
    "curl-polea": anclas([0, 0.2, 0.36, 0.5, 0.64, 0.8]),
    "curl-barra-z": anclas([0, 0.25, 0.45, 0.63, 0.8, 1.0]),

    // Tríceps
    "jalon-tras-nuca": anclas([0, 0.2, 0.35, 0.5, 0.65, 0.8]),
    "extension-triceps-polea": anclas([0, 0.23, 0.41, 0.56, 0.72, 0.9]),
    "press-frances": anclas([0, 0.2, 0.36, 0.5, 0.64, 0.8]),
    "extension-unilateral": anclas([0, 0.15, 0.27, 0.38, 0.5, 0.62]),
    "katana": anclas([0, 0.25, 0.42, 0.58, 0.74, 0.9]),

    // Hombros
    "elevaciones-laterales": anclas([0, 0.08, 0.14, 0.2, 0.26, 0.32]),
    "elevaciones-laterales-maquina": anclas([0, 0.15, 0.25, 0.35, 0.45, 0.55]),
    "press-militar": anclas([0, 0.35, 0.6, 0.85, 1.1, 1.4]),
    "pajaros": anclas([0, 0.08, 0.14, 0.2, 0.26, 0.32]),

    // Piernas
    "sentadilla-smith": anclas([0, 0.65, 1.1, 1.55, 2.0, 2.45]),
    "prensa-piernas": anclas([0, 0.95, 1.55, 2.2, 2.8, 3.45]),
    "extension-piernas": anclas([0, 0.3, 0.5, 0.7, 0.9, 1.1]),
    "curl-femoral": anclas([0, 0.3, 0.5, 0.7, 0.9, 1.1]),
    "curl-femoral-sentado": anclas([0, 0.3, 0.5, 0.7, 0.9, 1.1]),
    "hip-thrust": anclas([0, 0.9, 1.4, 1.9, 2.4, 2.9]),
    "sentadilla-hacka": anclas([0, 0.8, 1.35, 1.85, 2.35, 2.85]),
    "gemelos-sentados": anclas([0, 0.5, 0.85, 1.2, 1.55, 1.9])
});

function redondear(valor) {
    return Number(valor.toFixed(4));
}

function crearIntervalo(inicio, fin) {
    return [
        inicio,
        redondear(inicio + (fin - inicio) / 3),
        redondear(inicio + (2 * (fin - inicio)) / 3)
    ];
}

export function expandirUmbrales(anclasEjercicio) {
    if (!Array.isArray(anclasEjercicio) || anclasEjercicio.length !== 6) {
        return null;
    }

    const valores = anclasEjercicio.map(Number);
    if (!valores.every(Number.isFinite) || valores[0] !== 0) {
        return null;
    }

    const crecientes = valores.every((valor, indice) => (
        indice === 0 || valor > valores[indice - 1]
    ));

    if (!crecientes) {
        return null;
    }

    const radiante = redondear(valores[5] * FACTOR_RADIANTE);
    const umbrales = [
        ...crearIntervalo(valores[0], valores[1]),
        ...crearIntervalo(valores[1], valores[2]),
        ...crearIntervalo(valores[2], valores[3]),
        ...crearIntervalo(valores[3], valores[4]),
        ...crearIntervalo(valores[4], valores[5]),
        valores[5],
        redondear(valores[5] + (radiante - valores[5]) / 3),
        redondear(valores[5] + (2 * (radiante - valores[5])) / 3),
        radiante
    ];

    return umbrales.length === RANGOS.length ? umbrales : null;
}

export function obtenerUmbrales(ejercicioId, sexo) {
    const anclasEjercicio = UMBRALES_HOMBRE[ejercicioId];

    if (!anclasEjercicio || (sexo !== "masculino" && sexo !== "femenino")) {
        return null;
    }

    const umbrales = expandirUmbrales(anclasEjercicio);

    if (!umbrales) {
        return null;
    }

    if (sexo === "masculino") {
        return umbrales;
    }

    return umbrales.map((umbral, indice) => (
        indice === 0 ? 0 : redondear(umbral * MULTIPLICADOR_FEMENINO)
    ));
}

export function calcular1RMEstimado(peso, reps) {
    const pesoNumero = Number(peso);
    const repsNumero = Number(reps);

    if (!Number.isFinite(pesoNumero) || pesoNumero <= 0) {
        return 0;
    }

    if (!Number.isInteger(repsNumero) || repsNumero < 1) {
        return 0;
    }

    return repsNumero === 1 ? pesoNumero : pesoNumero * (1 + repsNumero / 30);
}

export function calcularRangoPorRatio(ratio, umbrales) {
    if (!Array.isArray(umbrales) || umbrales.length !== RANGOS.length) {
        return null;
    }

    const ratioNumero = Number(ratio);

    if (!Number.isFinite(ratioNumero) || ratioNumero < 0) {
        return null;
    }

    let indice = 0;

    for (let posicion = 1; posicion < umbrales.length; posicion += 1) {
        if (ratioNumero >= umbrales[posicion]) {
            indice = posicion;
        } else {
            break;
        }
    }

    const umbralActual = umbrales[indice];
    const umbralSiguiente = indice < umbrales.length - 1 ? umbrales[indice + 1] : null;
    let progreso = 0;

    if (umbralSiguiente !== null) {
        progreso = (ratioNumero - umbralActual) / (umbralSiguiente - umbralActual);
    } else {
        progreso = 1;
    }

    progreso = Math.min(1, Math.max(0, progreso));

    return {
        indice,
        rango: RANGOS[indice],
        progreso,
        puntuacion: indice + progreso,
        umbralActual,
        umbralSiguiente
    };
}

export function calcularRangoPorPuntuacion(puntuacion) {
    const valor = Number(puntuacion);

    if (!Number.isFinite(valor) || valor < 0) {
        return null;
    }

    const indice = Math.min(RANGOS.length - 1, Math.floor(valor));
    const progreso = indice === RANGOS.length - 1
        ? 1
        : Math.min(1, Math.max(0, valor - indice));

    return {
        indice,
        rango: RANGOS[indice],
        progreso,
        puntuacion: Math.min(RANGOS.length, valor)
    };
}
