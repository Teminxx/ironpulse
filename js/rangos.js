// Cálculo de rangos, mejores marcas, récords personales, XP y rachas.
// La lógica de cálculo no toca el DOM: recibe entrenos y ajustes y devuelve datos.
import { cargarDatos } from "./almacen.js";
import { BIBLIOTECA_EJERCICIOS, GRUPOS } from "./ejercicios.js";
import {
    RANGOS,
    calcular1RMEstimado,
    calcularRangoPorPuntuacion,
    calcularRangoPorRatio,
    obtenerUmbrales
} from "./estandares.js";
import { calcularResumenXP } from "./xp.js";
import { calcularRachas } from "./rachas.js";
import { formatearNumero } from "./ui.js";

const MAXIMO_EJERCICIOS_POR_GRUPO = 3;

let rangosInicializados = false;
let navegar = () => {};

function ordenarEntrenosAscendente(entrenos) {
    return entrenos
        .map((entreno, indice) => ({ entreno, indice }))
        .sort((a, b) => (
            a.entreno.fecha.localeCompare(b.entreno.fecha) || a.indice - b.indice
        ));
}

export function obtenerMejorSerie(series) {
    if (!Array.isArray(series) || series.length === 0) {
        return null;
    }

    return series.reduce((mejor, serie) => {
        const peso = Number(serie?.peso);
        const reps = Number(serie?.reps);

        if (!Number.isFinite(peso) || peso <= 0 || !Number.isInteger(reps) || reps < 1) {
            return mejor;
        }

        const rm = calcular1RMEstimado(peso, reps);
        const candidata = { peso, reps, rm };

        if (!mejor || rm > mejor.rm) {
            return candidata;
        }

        return mejor;
    }, null);
}

export function calcularMejoresPorEjercicio(entrenos) {
    const mejores = new Map();

    if (!Array.isArray(entrenos)) {
        return mejores;
    }

    entrenos.forEach((entreno) => {
        if (!entreno || !Array.isArray(entreno.ejercicios)) {
            return;
        }

        entreno.ejercicios.forEach((ejercicio) => {
            if (!ejercicio || typeof ejercicio.ejercicioId !== "string") {
                return;
            }

            const mejorSerie = obtenerMejorSerie(ejercicio.series);

            if (!mejorSerie) {
                return;
            }

            const actual = mejores.get(ejercicio.ejercicioId);

            if (!actual || mejorSerie.rm > actual.rm) {
                mejores.set(ejercicio.ejercicioId, {
                    ...mejorSerie,
                    fecha: entreno.fecha,
                    entrenoId: entreno.id
                });
            }
        });
    });

    return mejores;
}

// Un entreno marca récord cuando su mejor serie supera el mejor 1RM anterior del
// ejercicio. La primera marca registrada también cuenta como récord personal.
export function calcularMapaRecords(entrenos) {
    const records = new Map();

    if (!Array.isArray(entrenos)) {
        return records;
    }

    const mejoresPrevios = new Map();

    ordenarEntrenosAscendente(entrenos).forEach(({ entreno }) => {
        if (!entreno || !Array.isArray(entreno.ejercicios)) {
            return;
        }

        const recordsDelEntreno = new Set();

        entreno.ejercicios.forEach((ejercicio) => {
            if (!ejercicio || typeof ejercicio.ejercicioId !== "string") {
                return;
            }

            const mejorSerie = obtenerMejorSerie(ejercicio.series);

            if (!mejorSerie) {
                return;
            }

            const mejorPrevio = mejoresPrevios.get(ejercicio.ejercicioId) ?? 0;

            if (mejorSerie.rm > mejorPrevio + 0.000001) {
                recordsDelEntreno.add(ejercicio.ejercicioId);
                mejoresPrevios.set(ejercicio.ejercicioId, mejorSerie.rm);
            }
        });

        if (recordsDelEntreno.size > 0) {
            records.set(entreno.id, recordsDelEntreno);
        }
    });

    return records;
}

export function calcularResumenRangos(entrenos, ajustes) {
    const datosFaltantes = [];
    const sexo = ajustes?.sexo === "masculino" || ajustes?.sexo === "femenino"
        ? ajustes.sexo
        : null;
    const pesoCorporal = Number(ajustes?.pesoCorporal);
    const records = calcularMapaRecords(entrenos);
    const progresoUsuario = calcularResumenXP(entrenos, records);
    const racha = calcularRachas(entrenos, ajustes?.objetivoSemanal ?? 3);

    if (!sexo) {
        datosFaltantes.push("sexo");
    }

    if (!Number.isFinite(pesoCorporal) || pesoCorporal < 30 || pesoCorporal > 300) {
        datosFaltantes.push("peso corporal");
    }

    if (datosFaltantes.length > 0) {
        return {
            datosFaltantes,
            sexo,
            pesoCorporal: null,
            ejercicios: [],
            grupos: [],
            global: null,
            totalRecords: 0,
            progresoUsuario,
            racha
        };
    }

    const mejores = calcularMejoresPorEjercicio(entrenos);

    const ejercicios = BIBLIOTECA_EJERCICIOS
        .filter((ejercicio) => ejercicio.rankeable)
        .map((ejercicio) => {
            const umbrales = obtenerUmbrales(ejercicio.id, sexo);
            const mejor = mejores.get(ejercicio.id) ?? null;
            const objetivoBase = umbrales ? umbrales[1] * pesoCorporal : null;

            if (!mejor || !umbrales) {
                return {
                    ...ejercicio,
                    sinDatos: true,
                    mejor: null,
                    ratio: null,
                    rango: null,
                    umbrales,
                    objetivoBase,
                    advertenciaReps: false
                };
            }

            const ratio = mejor.rm / pesoCorporal;
            const rango = calcularRangoPorRatio(ratio, umbrales);

            return {
                ...ejercicio,
                sinDatos: false,
                mejor,
                ratio,
                rango,
                umbrales,
                objetivoBase,
                advertenciaReps: mejor.reps > 10
            };
        });

    const grupos = GRUPOS.map((nombre) => {
        const mejoresDelGrupo = ejercicios
            .filter((ejercicio) => ejercicio.grupo === nombre && !ejercicio.sinDatos && ejercicio.rango)
            .sort((a, b) => b.rango.puntuacion - a.rango.puntuacion)
            .slice(0, MAXIMO_EJERCICIOS_POR_GRUPO);

        if (mejoresDelGrupo.length === 0) {
            return {
                nombre,
                sinDatos: true,
                cantidad: 0,
                puntuacion: null,
                rango: null,
                mejores: []
            };
        }

        const puntuacion = mejoresDelGrupo.reduce(
            (total, ejercicio) => total + ejercicio.rango.puntuacion,
            0
        ) / mejoresDelGrupo.length;

        return {
            nombre,
            sinDatos: false,
            cantidad: mejoresDelGrupo.length,
            puntuacion,
            rango: calcularRangoPorPuntuacion(puntuacion),
            mejores: mejoresDelGrupo
        };
    });

    const gruposConDatos = grupos.filter((grupo) => !grupo.sinDatos);
    const puntuacionGlobal = gruposConDatos.length === 0
        ? null
        : gruposConDatos.reduce((total, grupo) => total + grupo.puntuacion, 0) / gruposConDatos.length;
    const totalRecords = Array.from(records.values()).reduce(
        (total, recordsDelEntreno) => total + recordsDelEntreno.size,
        0
    );

    return {
        datosFaltantes: [],
        sexo,
        pesoCorporal,
        ejercicios,
        grupos,
        global: {
            puntuacion: puntuacionGlobal,
            rango: puntuacionGlobal === null ? null : calcularRangoPorPuntuacion(puntuacionGlobal),
            gruposConDatos: gruposConDatos.length,
            totalGrupos: GRUPOS.length
        },
        totalRecords,
        progresoUsuario,
        racha
    };
}

export function inicializarRangos({ irAPestana = () => {} } = {}) {
    if (rangosInicializados) {
        return;
    }

    const contenido = document.getElementById("contenido-rangos");

    if (!contenido) {
        return;
    }

    navegar = irAPestana;
    contenido.addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) {
            return;
        }

        if (boton.dataset.accion === "ir-ajustes") {
            navegar("ajustes");
        } else if (boton.dataset.accion === "ir-entrenar") {
            navegar("entrenar");
        }
    });

    rangosInicializados = true;
    renderizarRangos();
}

export function renderizarRangos() {
    const contenido = document.getElementById("contenido-rangos");

    if (!contenido) {
        return;
    }

    const datos = cargarDatos();
    const resumen = calcularResumenRangos(datos.entrenos, datos.ajustes);

    contenido.replaceChildren();
    contenido.appendChild(crearTarjetaProgreso(resumen));

    if (resumen.datosFaltantes.length > 0) {
        contenido.appendChild(crearAvisoPerfil(resumen.datosFaltantes));
        return;
    }

    contenido.appendChild(crearTarjetaGlobal(resumen));

    const seccionGrupos = document.createElement("section");
    seccionGrupos.className = "seccion-rangos";
    seccionGrupos.setAttribute("aria-labelledby", "titulo-rangos-grupos");

    const tituloGrupos = document.createElement("h2");
    tituloGrupos.id = "titulo-rangos-grupos";
    tituloGrupos.className = "titulo-seccion-rangos";
    tituloGrupos.textContent = "Por grupo muscular";

    const cuadricula = document.createElement("div");
    cuadricula.className = "cuadricula-grupos";
    resumen.grupos.forEach((grupo) => {
        cuadricula.appendChild(crearTarjetaGrupo(grupo));
    });

    seccionGrupos.append(tituloGrupos, cuadricula);
    contenido.appendChild(seccionGrupos);

    const seccionEjercicios = document.createElement("section");
    seccionEjercicios.className = "seccion-rangos";
    seccionEjercicios.setAttribute("aria-labelledby", "titulo-rangos-ejercicios");

    const tituloEjercicios = document.createElement("h2");
    tituloEjercicios.id = "titulo-rangos-ejercicios";
    tituloEjercicios.className = "titulo-seccion-rangos";
    tituloEjercicios.textContent = "Ejercicios que puntúan";

    const nota = document.createElement("p");
    nota.className = "nota-seccion-rangos";
    nota.textContent = "El 1RM se estima con la fórmula de Epley a partir de tu mejor serie histórica.";

    const lista = document.createElement("div");
    lista.className = "lista-rangos-ejercicios";
    resumen.ejercicios.forEach((ejercicio) => {
        lista.appendChild(crearFilaEjercicio(ejercicio));
    });

    seccionEjercicios.append(tituloEjercicios, nota, lista);
    contenido.appendChild(seccionEjercicios);
}

function crearTarjetaProgreso(resumen) {
    const { nivel, total } = resumen.progresoUsuario;
    const { racha, entrenosSemanaActual, objetivoSemanal } = resumen.racha;
    const tarjeta = document.createElement("section");
    tarjeta.className = "tarjeta tarjeta-progreso-usuario";
    tarjeta.setAttribute("aria-labelledby", "titulo-progreso-usuario");

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-progreso-usuario";

    const bloqueNivel = document.createElement("div");
    const etiqueta = document.createElement("p");
    etiqueta.className = "etiqueta-superior";
    etiqueta.textContent = "Tu progreso";

    const titulo = document.createElement("h2");
    titulo.id = "titulo-progreso-usuario";
    titulo.textContent = `Nivel ${nivel.nivel}`;

    bloqueNivel.append(etiqueta, titulo);

    const bloqueXP = document.createElement("p");
    bloqueXP.className = "xp-usuario";
    bloqueXP.textContent = `${total} XP`;

    cabecera.append(bloqueNivel, bloqueXP);
    tarjeta.appendChild(cabecera);

    const textoNivel = document.createElement("p");
    textoNivel.className = "detalle-progreso-usuario";
    textoNivel.textContent = `Te faltan ${nivel.xpFaltante} XP para llegar al nivel ${nivel.nivel + 1}.`;
    tarjeta.appendChild(textoNivel);
    tarjeta.appendChild(crearBarraProgreso(
        nivel.progreso,
        `Progreso al nivel ${nivel.nivel + 1}`
    ));

    const pie = document.createElement("div");
    pie.className = "pie-progreso-usuario";

    const bloqueRacha = document.createElement("span");
    bloqueRacha.textContent = racha === 0
        ? "Sin racha semanal"
        : `Racha: ${racha} ${racha === 1 ? "semana" : "semanas"}`;

    const bloqueSemana = document.createElement("span");
    bloqueSemana.textContent = `Esta semana: ${entrenosSemanaActual}/${objetivoSemanal} entrenamientos`;

    pie.append(bloqueRacha, bloqueSemana);
    tarjeta.appendChild(pie);

    return tarjeta;
}

function crearAvisoPerfil(datosFaltantes) {
    const tarjeta = document.createElement("section");
    tarjeta.className = "tarjeta tarjeta-perfil-faltante";

    const icono = document.createElement("span");
    icono.className = "icono-aviso";
    icono.setAttribute("aria-hidden", "true");
    icono.textContent = "!";

    const texto = document.createElement("div");
    texto.className = "contenido-perfil-faltante";

    const titulo = document.createElement("h2");
    titulo.textContent = "Completa tu perfil";

    const descripcion = document.createElement("p");
    const lista = datosFaltantes.length === 1
        ? datosFaltantes[0]
        : `${datosFaltantes.slice(0, -1).join(", ")} y ${datosFaltantes.at(-1)}`;
    descripcion.textContent = `Para calcular tus rangos necesitamos tu ${lista}. Sin estos datos no se puede comparar tu fuerza con tu peso corporal.`;

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton-primario boton-ancho";
    boton.dataset.accion = "ir-ajustes";
    boton.textContent = "Ir a Ajustes";

    texto.append(titulo, descripcion, boton);
    tarjeta.append(icono, texto);
    return tarjeta;
}

function textoProgresoRango(rango) {
    if (rango.indice >= RANGOS.length - 1) {
        return "Rango máximo alcanzado.";
    }

    return `Siguiente rango: ${RANGOS[rango.indice + 1].nombre}.`;
}

function crearTarjetaGlobal(resumen) {
    const { global } = resumen;
    const tieneDatos = Boolean(global.rango);
    const rango = global.rango;

    const tarjeta = document.createElement("section");
    tarjeta.className = "tarjeta tarjeta-rango-global";
    if (rango) {
        tarjeta.classList.add(rango.rango.clase);
    }

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-rango-global";

    const bloqueNivel = document.createElement("div");
    const etiqueta = document.createElement("p");
    etiqueta.className = "etiqueta-superior";
    etiqueta.textContent = "Rango global";

    const nombreRango = document.createElement("h2");
    nombreRango.className = "nombre-rango-global";
    nombreRango.textContent = rango?.rango.nombre ?? "Sin datos";

    const detalle = document.createElement("p");
    detalle.className = "detalle-rango-global";
    detalle.textContent = tieneDatos
        ? `Media de ${global.gruposConDatos} ${global.gruposConDatos === 1 ? "grupo con datos" : "grupos con datos"}.`
        : "Registra series en ejercicios que puntúan para empezar.";

    bloqueNivel.append(etiqueta, nombreRango, detalle);
    cabecera.appendChild(bloqueNivel);
    tarjeta.appendChild(cabecera);

    if (rango) {
        const siguiente = document.createElement("p");
        siguiente.className = "siguiente-rango";
        siguiente.textContent = textoProgresoRango(rango);
        tarjeta.append(
            siguiente,
            crearBarraProgreso(rango.progreso, `Progreso del rango global ${rango.rango.nombre}`)
        );
    }

    const pie = document.createElement("div");
    pie.className = "pie-rango-global";

    const grupos = document.createElement("span");
    grupos.textContent = `${global.gruposConDatos} de ${global.totalGrupos} grupos con datos`;

    const records = document.createElement("span");
    records.textContent = `${resumen.totalRecords} ${resumen.totalRecords === 1 ? "récord personal" : "récords personales"}`;

    pie.append(grupos, records);
    tarjeta.appendChild(pie);

    if (!tieneDatos) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "boton boton-secundario boton-ancho boton-empezar-rangos";
        boton.dataset.accion = "ir-entrenar";
        boton.textContent = "Registrar un entrenamiento";
        tarjeta.appendChild(boton);
    } else {
        const peso = document.createElement("p");
        peso.className = "nota-peso-rango";
        peso.textContent = `Calculado con un peso corporal de ${formatearNumero(resumen.pesoCorporal, 1)} kg.`;
        tarjeta.appendChild(peso);
    }

    return tarjeta;
}

function crearTarjetaGrupo(grupo) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta tarjeta-rango-grupo";
    if (grupo.rango) {
        tarjeta.classList.add(grupo.rango.rango.clase);
    }

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-rango-grupo";

    const nombre = document.createElement("h3");
    nombre.textContent = grupo.nombre;

    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta-nivel";
    if (grupo.rango) {
        etiqueta.classList.add(grupo.rango.rango.clase);
        etiqueta.textContent = grupo.rango.rango.nombre;
    } else {
        etiqueta.classList.add("nivel-vacio");
        etiqueta.textContent = "Sin datos";
    }

    cabecera.append(nombre, etiqueta);
    tarjeta.appendChild(cabecera);

    if (!grupo.sinDatos) {
        const detalle = document.createElement("p");
        detalle.className = "detalle-rango-grupo";
        detalle.textContent = "Basado en tus mejores ejercicios del grupo.";

        const siguiente = document.createElement("p");
        siguiente.className = "siguiente-rango";
        siguiente.textContent = textoProgresoRango(grupo.rango);

        tarjeta.append(
            detalle,
            siguiente,
            crearBarraProgreso(
                grupo.rango.progreso,
                `Progreso del grupo ${grupo.nombre} en el rango ${grupo.rango.rango.nombre}`
            )
        );
    } else {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = "Todavía no hay marcas en este grupo.";
        tarjeta.appendChild(vacio);
    }

    return tarjeta;
}

function crearFilaEjercicio(ejercicio) {
    const fila = document.createElement("article");
    fila.className = "fila-rango";
    if (ejercicio.rango) {
        fila.classList.add(ejercicio.rango.rango.clase);
    }

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-fila-rango";

    const bloqueNombre = document.createElement("div");
    bloqueNombre.className = "nombre-fila-rango";

    const nombre = document.createElement("h3");
    nombre.textContent = ejercicio.nombre;

    const grupo = document.createElement("span");
    grupo.className = "etiqueta-grupo";
    grupo.textContent = ejercicio.grupo;

    bloqueNombre.append(nombre, grupo);

    const etiquetaNivel = document.createElement("span");
    etiquetaNivel.className = "etiqueta-nivel";

    if (ejercicio.rango) {
        etiquetaNivel.classList.add(ejercicio.rango.rango.clase);
        etiquetaNivel.textContent = ejercicio.rango.rango.nombre;
    } else {
        etiquetaNivel.classList.add("nivel-vacio");
        etiquetaNivel.textContent = "Sin datos";
    }

    cabecera.append(bloqueNombre, etiquetaNivel);
    fila.appendChild(cabecera);

    if (!ejercicio.sinDatos) {
        const datos = document.createElement("div");
        datos.className = "datos-fila-rango";

        datos.append(
            crearDatoRango("1RM", `${formatearNumero(ejercicio.mejor.rm, 1)} kg`),
            crearDatoRango("Mejor serie", `${formatearNumero(ejercicio.mejor.peso, 1)}×${ejercicio.mejor.reps}`)
        );

        const progreso = document.createElement("div");
        progreso.className = "progreso-fila-rango";

        const textos = document.createElement("div");
        textos.className = "textos-progreso-rango";

        const direccion = document.createElement("span");
        direccion.textContent = textoProgresoRango(ejercicio.rango);

        textos.append(direccion);
        progreso.append(
            textos,
            crearBarraProgreso(
                ejercicio.rango.progreso,
                `Progreso de ${ejercicio.nombre} en el rango ${ejercicio.rango.rango.nombre}`
            )
        );

        fila.append(datos, progreso);

        if (ejercicio.advertenciaReps) {
            const aviso = document.createElement("p");
            aviso.className = "aviso-reps";
            aviso.textContent = "Estimación poco fiable: usa series de 3 a 8 repeticiones.";
            fila.appendChild(aviso);
        }
    } else {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio texto-vacio-rango";
        const objetivo = ejercicio.objetivoBase === null
            ? "Sin datos disponibles."
            : `Primer objetivo: ${formatearNumero(ejercicio.objetivoBase, 1)} kg.`;
        vacio.textContent = `Sin registros todavía. ${objetivo}`;
        fila.appendChild(vacio);
    }

    return fila;
}

function crearDatoRango(etiqueta, valor) {
    const bloque = document.createElement("div");
    bloque.className = "dato-rango";

    const textoEtiqueta = document.createElement("span");
    textoEtiqueta.textContent = etiqueta;

    const textoValor = document.createElement("strong");
    textoValor.textContent = valor;

    bloque.append(textoEtiqueta, textoValor);
    return bloque;
}

function crearBarraProgreso(progreso, etiqueta) {
    const porcentaje = Math.round(Math.min(1, Math.max(0, progreso)) * 100);

    const barra = document.createElement("div");
    barra.className = "barra-progreso";
    barra.setAttribute("role", "progressbar");
    barra.setAttribute("aria-valuemin", "0");
    barra.setAttribute("aria-valuemax", "100");
    barra.setAttribute("aria-valuenow", String(porcentaje));
    barra.setAttribute("aria-label", etiqueta);

    const relleno = document.createElement("span");
    relleno.className = "barra-progreso-relleno";
    relleno.style.width = `${porcentaje}%`;

    barra.appendChild(relleno);
    return barra;
}
