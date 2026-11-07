// Biblioteca de ejercicios de IronPulse.
// Criterio de ranking: movimientos con carga externa medible y registro de peso.
// Dominadas y dominadas supinas se registran, pero no puntúan porque el peso
// corporal no permite comparar el 1RM con el peso del usuario.

export const GRUPOS = Object.freeze([
    "Pecho",
    "Espalda",
    "Piernas",
    "Hombros",
    "Bíceps",
    "Tríceps"
]);

export const BIBLIOTECA_EJERCICIOS = Object.freeze([
    // Pecho
    { id: "aperturas-maquina", nombre: "Aperturas en máquina", grupo: "Pecho", rankeable: true },
    { id: "aperturas-mancuernas", nombre: "Aperturas con mancuernas", grupo: "Pecho", rankeable: true },
    { id: "press-inclinado-maquina", nombre: "Press inclinado en máquina", grupo: "Pecho", rankeable: true },
    { id: "press-inclinado-mancuernas", nombre: "Press inclinado con mancuernas", grupo: "Pecho", rankeable: true },
    { id: "press-pecho-maquina", nombre: "Press plano en máquina", grupo: "Pecho", rankeable: true },
    { id: "press-banca-mancuernas", nombre: "Press plano con mancuernas", grupo: "Pecho", rankeable: true },
    { id: "press-banca", nombre: "Press banca", grupo: "Pecho", rankeable: true },
    { id: "cruces-polea", nombre: "CrossOver", grupo: "Pecho", rankeable: true },
    { id: "fondos", nombre: "Fondos en máquina", grupo: "Pecho", rankeable: true },

    // Espalda
    { id: "jalon-al-pecho", nombre: "Jalón al pecho con barra", grupo: "Espalda", rankeable: true },
    { id: "jalon-cerrado", nombre: "Jalón al pecho agarre cerrado", grupo: "Espalda", rankeable: true },
    { id: "remo-sentado-cerrado", nombre: "Remo sentado agarre cerrado", grupo: "Espalda", rankeable: true },
    { id: "remo-sentado-amplio", nombre: "Remo sentado agarre amplio", grupo: "Espalda", rankeable: true },
    { id: "remo-t", nombre: "Remo en T", grupo: "Espalda", rankeable: true },
    { id: "jalon-maquina", nombre: "Jalón en máquina", grupo: "Espalda", rankeable: true },
    { id: "remo-mancuerna", nombre: "Remo con mancuernas", grupo: "Espalda", rankeable: true },
    { id: "dominadas-supinas", nombre: "Dominadas supinas", grupo: "Espalda", rankeable: false },
    { id: "dominadas", nombre: "Dominadas", grupo: "Espalda", rankeable: false },
    { id: "face-pull", nombre: "Facepull", grupo: "Espalda", rankeable: true },
    { id: "remo-maquina", nombre: "Remo en máquina", grupo: "Espalda", rankeable: true },
    { id: "pullover-mancuerna", nombre: "Pull over", grupo: "Espalda", rankeable: true },

    // Bíceps
    { id: "curl-martillo", nombre: "Curl martillo", grupo: "Bíceps", rankeable: true },
    { id: "curl-banco-inclinado", nombre: "Curl en banco inclinado", grupo: "Bíceps", rankeable: true },
    { id: "curl-predicador", nombre: "Curl predicador", grupo: "Bíceps", rankeable: true },
    { id: "curl-polea", nombre: "Curl en polea", grupo: "Bíceps", rankeable: true },
    { id: "curl-barra-z", nombre: "Curl con barra Z", grupo: "Bíceps", rankeable: true },

    // Tríceps
    { id: "jalon-tras-nuca", nombre: "Jalón tras nuca", grupo: "Tríceps", rankeable: true },
    { id: "extension-triceps-polea", nombre: "Extensión de tríceps", grupo: "Tríceps", rankeable: true },
    { id: "press-frances", nombre: "Press francés", grupo: "Tríceps", rankeable: true },
    { id: "extension-unilateral", nombre: "Extensión unilateral", grupo: "Tríceps", rankeable: true },
    { id: "katana", nombre: "Katana", grupo: "Tríceps", rankeable: true },

    // Hombros
    { id: "elevaciones-laterales", nombre: "Elevaciones laterales con mancuerna", grupo: "Hombros", rankeable: true },
    { id: "elevaciones-laterales-maquina", nombre: "Elevaciones laterales en máquina", grupo: "Hombros", rankeable: true },
    { id: "press-militar", nombre: "Press militar", grupo: "Hombros", rankeable: true },
    { id: "pajaros", nombre: "Pájaros", grupo: "Hombros", rankeable: true },

    // Piernas
    { id: "sentadilla-smith", nombre: "Sentadilla en Smith", grupo: "Piernas", rankeable: true },
    { id: "prensa-piernas", nombre: "Prensa", grupo: "Piernas", rankeable: true },
    { id: "extension-piernas", nombre: "Extensión de cuádriceps", grupo: "Piernas", rankeable: true },
    { id: "curl-femoral", nombre: "Curl femoral tumbado", grupo: "Piernas", rankeable: true },
    { id: "curl-femoral-sentado", nombre: "Curl femoral sentado", grupo: "Piernas", rankeable: true },
    { id: "hip-thrust", nombre: "Hip thrust", grupo: "Piernas", rankeable: true },
    { id: "sentadilla-hacka", nombre: "Sentadilla hacka", grupo: "Piernas", rankeable: true },
    { id: "gemelos-sentados", nombre: "Gemelos sentados", grupo: "Piernas", rankeable: true }
]);

export function normalizarNombre(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es-ES")
        .trim()
        .replace(/\s+/g, " ");
}

export function esGrupoValido(grupo) {
    return GRUPOS.includes(grupo);
}

export function obtenerEjercicio(ejercicioId, ejerciciosPropios = []) {
    return BIBLIOTECA_EJERCICIOS.find((ejercicio) => ejercicio.id === ejercicioId)
        ?? ejerciciosPropios.find((ejercicio) => ejercicio.id === ejercicioId)
        ?? null;
}

export function obtenerTodosLosEjercicios(ejerciciosPropios = []) {
    return [...BIBLIOTECA_EJERCICIOS, ...ejerciciosPropios];
}

export function generarIdEjercicio(nombre, ejerciciosExistentes = []) {
    const base = normalizarNombre(nombre)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 42) || "ejercicio";
    const ids = new Set(ejerciciosExistentes.map((ejercicio) => ejercicio.id));
    let id = `propio-${base}`;
    let sufijo = 2;

    while (ids.has(id)) {
        id = `propio-${base}-${sufijo}`;
        sufijo += 1;
    }

    return id;
}
