// Registro de entrenamientos, borrador automático e historial editable.
import { cargarDatos, guardarDatos } from "./almacen.js";
import { esFechaISOValida, formatearFecha, hoyLocal } from "./fechas.js";
import {
    GRUPOS,
    normalizarNombre,
    obtenerEjercicio,
    obtenerTodosLosEjercicios
} from "./ejercicios.js";
import { calcularMapaRecords, obtenerMejorSerie } from "./rangos.js";
import { calcularRachas } from "./rachas.js";
import { calcularResumenXP } from "./xp.js";
import {
    confirmarAccion,
    convertirNumeroDecimal,
    crearBotonIcono,
    crearIconoSvg,
    formatearNumero,
    mostrarAviso
} from "./ui.js";

const ICONOS = Object.freeze({
    borrar: "M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5",
    copiar: "M8 8h11v11H8zM5 16H4V4h12v1",
    quitar: "m6 6 12 12M18 6 6 18",
    check: "m5 12 4 4L19 6"
});

let estado = crearEstadoVacio();
let navegar = () => {};
let entrenosInicializados = false;
let filtroGrupo = "Todos";
let busquedaSelector = "";
let errorAutoguardadoMostrado = false;

function crearEstadoVacio() {
    return {
        fecha: hoyLocal(),
        ejercicios: [],
        entrenoId: null
    };
}

export function inicializarEntrenos({ irAPestana = () => {} } = {}) {
    if (entrenosInicializados) {
        return;
    }

    const fechaInput = document.getElementById("fecha-entrenamiento");
    const listaEntrenamiento = document.getElementById("lista-entrenamiento");
    const listaHistorial = document.getElementById("lista-historial");
    const botonAgregar = document.getElementById("btn-agregar-ejercicio");
    const botonGuardar = document.getElementById("btn-guardar-entrenamiento");
    const dialogoEjercicio = document.getElementById("dialogo-ejercicio");

    if (!fechaInput || !listaEntrenamiento || !listaHistorial || !botonAgregar || !botonGuardar || !dialogoEjercicio) {
        return;
    }

    navegar = irAPestana;
    const borradorRecuperado = recuperarBorrador();

    fechaInput.addEventListener("change", manejarCambioFecha);
    botonAgregar.addEventListener("click", abrirSelectorEjercicio);
    botonGuardar.addEventListener("click", guardarEntrenamiento);
    listaEntrenamiento.addEventListener("click", manejarClickEntrenamiento);
    listaEntrenamiento.addEventListener("input", manejarEntradaSerie);
    listaEntrenamiento.addEventListener("change", manejarCambioSerie);
    listaHistorial.addEventListener("click", manejarClickHistorial);

    document.getElementById("btn-cancelar-edicion")?.addEventListener("click", () => {
        descartarTrabajoActual(
            "Cancelar edición",
            "Se perderán los cambios no guardados de este entrenamiento.",
            "Cancelar edición"
        );
    });

    document.getElementById("btn-descartar-borrador")?.addEventListener("click", () => {
        descartarTrabajoActual(
            "Descartar borrador",
            "Se borrará el borrador guardado en este dispositivo.",
            "Descartar borrador"
        );
    });

    document.getElementById("btn-cerrar-selector")?.addEventListener("click", () => {
        dialogoEjercicio.close();
    });

    document.getElementById("btn-cerrar-resumen")?.addEventListener("click", () => {
        document.getElementById("dialogo-resumen")?.close();
    });

    const buscador = document.getElementById("buscador-ejercicio");
    buscador?.addEventListener("input", manejarBusquedaSelector);
    buscador?.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") {
            evento.preventDefault();
        }
    });

    document.getElementById("filtros-grupo")?.addEventListener("click", manejarFiltroGrupo);
    document.getElementById("lista-selector-ejercicios")?.addEventListener("click", manejarSeleccionEjercicio);

    entrenosInicializados = true;
    renderizarEntrenar();
    renderizarHistorial();

    if (borradorRecuperado) {
        mostrarAviso("Borrador recuperado. Puedes continuar donde lo dejaste.", "info", 5000);
    }
}

export function renderizarEntrenar() {
    const lista = document.getElementById("lista-entrenamiento");
    const estadoVacio = document.getElementById("estado-vacio-entreno");
    const fechaInput = document.getElementById("fecha-entrenamiento");

    if (!lista || !estadoVacio || !fechaInput) {
        return;
    }

    const datos = cargarDatos();
    fechaInput.value = estado.fecha;
    lista.replaceChildren();

    estado.ejercicios.forEach((ejercicioEstado, indice) => {
        const ejercicio = obtenerEjercicio(ejercicioEstado.ejercicioId, datos.ejerciciosPropios);
        const tarjeta = crearTarjetaEjercicio(
            ejercicioEstado,
            indice,
            ejercicio,
            datos
        );
        lista.appendChild(tarjeta);
    });
    estadoVacio.hidden = estado.ejercicios.length > 0;
    actualizarCabeceraEntrenamiento();
}

export function renderizarHistorial() {
    const lista = document.getElementById("lista-historial");
    const resumen = document.getElementById("resumen-historial");

    if (!lista || !resumen) {
        return;
    }

    const datos = cargarDatos();
    const entrenos = [...datos.entrenos].sort(compararEntrenosDescendente);
    const records = calcularMapaRecords(datos.entrenos);

    lista.replaceChildren();
    resumen.textContent = entrenos.length === 0
        ? "Todavía no hay entrenamientos."
        : `${entrenos.length} ${entrenos.length === 1 ? "entrenamiento guardado" : "entrenamientos guardados"}.`;

    if (entrenos.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "estado-vacio";

        const icono = document.createElement("span");
        icono.className = "estado-vacio-icono";
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = "0";

        const titulo = document.createElement("h2");
        titulo.textContent = "Aún no hay sesiones";

        const texto = document.createElement("p");
        texto.textContent = "Cuando guardes tu primer entrenamiento aparecerá aquí.";

        vacio.append(icono, titulo, texto);
        lista.appendChild(vacio);
        return;
    }

    entrenos.forEach((entreno) => {
        lista.appendChild(crearTarjetaHistorial(entreno, datos.ejerciciosPropios, records));
    });
}

export function validarEntreno(borrador, nombresPorId = {}) {
    const nombres = nombresPorId && typeof nombresPorId === "object" ? nombresPorId : {};

    if (!borrador || !esFechaISOValida(borrador.fecha)) {
        return {
            valido: false,
            error: "Selecciona una fecha válida para el entrenamiento."
        };
    }

    if (!Array.isArray(borrador.ejercicios) || borrador.ejercicios.length === 0) {
        return {
            valido: false,
            error: "Añade al menos un ejercicio al entrenamiento."
        };
    }

    const ejercicios = [];
    let totalSeries = 0;

    for (let indiceEjercicio = 0; indiceEjercicio < borrador.ejercicios.length; indiceEjercicio += 1) {
        const ejercicio = borrador.ejercicios[indiceEjercicio];

        if (!ejercicio || typeof ejercicio !== "object") {
            return {
                valido: false,
                error: "Hay un ejercicio no válido en el entrenamiento."
            };
        }

        const nombre = nombres[ejercicio.ejercicioId] ?? "este ejercicio";

        if (!ejercicio.ejercicioId) {
            return {
                valido: false,
                error: "Hay un ejercicio no válido en el entrenamiento."
            };
        }

        if (!Array.isArray(ejercicio.series) || ejercicio.series.length === 0) {
            return {
                valido: false,
                error: `Añade al menos una serie a ${nombre}.`,
                indiceEjercicio
            };
        }

        const seriesValidas = [];

        for (let indiceSerie = 0; indiceSerie < ejercicio.series.length; indiceSerie += 1) {
            const serie = ejercicio.series[indiceSerie];

            if (!serie || typeof serie !== "object") {
                return {
                    valido: false,
                    error: `Hay una serie no válida en ${nombre}.`,
                    indiceEjercicio,
                    indiceSerie
                };
            }

            const pesoTexto = String(serie.peso ?? "").trim();
            const repsTexto = String(serie.reps ?? "").trim();

            if (pesoTexto === "" && repsTexto === "") {
                continue;
            }

            if (pesoTexto === "") {
                return {
                    valido: false,
                    error: `Completa el peso de la serie ${indiceSerie + 1} de ${nombre}.`,
                    indiceEjercicio,
                    indiceSerie,
                    campo: "peso"
                };
            }

            if (repsTexto === "") {
                return {
                    valido: false,
                    error: `Completa las repeticiones de la serie ${indiceSerie + 1} de ${nombre}.`,
                    indiceEjercicio,
                    indiceSerie,
                    campo: "reps"
                };
            }

            const peso = convertirNumeroDecimal(pesoTexto);
            if (!Number.isFinite(peso) || peso < 0.5 || peso > 500) {
                return {
                    valido: false,
                    error: `El peso debe estar entre 0,5 y 500 kg en la serie ${indiceSerie + 1} de ${nombre}.`,
                    indiceEjercicio,
                    indiceSerie,
                    campo: "peso"
                };
            }

            const reps = convertirNumeroDecimal(repsTexto);
            if (!Number.isInteger(reps) || reps < 1 || reps > 30) {
                return {
                    valido: false,
                    error: `Las repeticiones deben ser un número entero entre 1 y 30 en la serie ${indiceSerie + 1} de ${nombre}.`,
                    indiceEjercicio,
                    indiceSerie,
                    campo: "reps"
                };
            }

            seriesValidas.push({ peso, reps });
        }

        if (seriesValidas.length === 0) {
            return {
                valido: false,
                error: `Añade al menos una serie con datos a ${nombre}.`,
                indiceEjercicio
            };
        }

        ejercicios.push({
            ejercicioId: ejercicio.ejercicioId,
            series: seriesValidas
        });
        totalSeries += seriesValidas.length;
    }

    return {
        valido: true,
        totalSeries,
        datos: {
            fecha: borrador.fecha,
            ejercicios
        }
    };
}

function recuperarBorrador() {
    const datos = cargarDatos();
    const borrador = datos.borrador;

    if (!borrador || (borrador.ejercicios.length === 0 && !borrador.entrenoId)) {
        estado = crearEstadoVacio();
        return false;
    }

    estado = {
        fecha: borrador.fecha,
        ejercicios: borrador.ejercicios.map((ejercicio) => ({
            ejercicioId: ejercicio.ejercicioId,
            series: ejercicio.series.map((serie) => ({
                peso: serie.peso,
                reps: serie.reps,
                completada: serie.completada
            }))
        })),
        entrenoId: borrador.entrenoId
    };

    return true;
}

function autoguardarBorrador() {
    const datos = cargarDatos();
    datos.borrador = crearBorradorDesdeEstado();

    if (!guardarDatos(datos)) {
        if (!errorAutoguardadoMostrado) {
            mostrarAviso("No se pudo guardar el borrador. Revisa el almacenamiento del dispositivo.", "error", 6000);
            errorAutoguardadoMostrado = true;
        }
        return;
    }

    errorAutoguardadoMostrado = false;
    actualizarCabeceraEntrenamiento();
}

function crearBorradorDesdeEstado() {
    if (estado.ejercicios.length === 0 && !estado.entrenoId) {
        return null;
    }

    return {
        fecha: estado.fecha,
        entrenoId: estado.entrenoId,
        ejercicios: estado.ejercicios.map((ejercicio) => ({
            ejercicioId: ejercicio.ejercicioId,
            series: ejercicio.series.map((serie) => ({
                peso: String(serie.peso ?? ""),
                reps: String(serie.reps ?? ""),
                completada: Boolean(serie.completada)
            }))
        }))
    };
}

function manejarCambioFecha(evento) {
    if (!esFechaISOValida(evento.target.value)) {
        mostrarAviso("Selecciona una fecha válida.", "error");
        evento.target.value = estado.fecha;
        return;
    }

    estado.fecha = evento.target.value;
    autoguardarBorrador();
}

function actualizarCabeceraEntrenamiento() {
    const indicador = document.getElementById("indicador-borrador");
    const avisoEdicion = document.getElementById("aviso-edicion");
    const textoEdicion = document.getElementById("texto-edicion");
    const botonDescartar = document.getElementById("btn-descartar-borrador");
    const hayTrabajo = estado.ejercicios.length > 0 || Boolean(estado.entrenoId);

    if (indicador) {
        indicador.hidden = !hayTrabajo;
        indicador.textContent = estado.entrenoId ? "Editando" : "Borrador guardado";
    }

    if (avisoEdicion) {
        avisoEdicion.hidden = !estado.entrenoId;
    }

    if (textoEdicion && estado.entrenoId) {
        textoEdicion.textContent = `Editando el entrenamiento del ${formatearFecha(estado.fecha)}. Al guardar se sustituirá la versión original.`;
    }

    if (botonDescartar) {
        botonDescartar.hidden = !hayTrabajo;
    }
}

function crearTarjetaEjercicio(ejercicioEstado, indice, ejercicio, datos) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-ejercicio";

    const nombre = ejercicio?.nombre ?? "Ejercicio eliminado";
    const grupo = ejercicio?.grupo ?? "Sin grupo";
    const rankeable = Boolean(ejercicio?.rankeable);
    const ultimaVez = obtenerUltimaVez(ejercicioEstado.ejercicioId, datos.entrenos, estado.entrenoId);

    const cabecera = document.createElement("header");
    cabecera.className = "cabecera-ejercicio";

    const bloqueTitulo = document.createElement("div");
    const titulo = document.createElement("h2");
    titulo.textContent = nombre;

    const meta = document.createElement("div");
    meta.className = "meta-ejercicio";

    const etiquetaGrupo = document.createElement("span");
    etiquetaGrupo.className = "etiqueta-grupo";
    etiquetaGrupo.textContent = grupo;
    meta.appendChild(etiquetaGrupo);

    if (rankeable) {
        const etiquetaRanking = document.createElement("span");
        etiquetaRanking.className = "etiqueta-ranking";
        etiquetaRanking.textContent = "Puntúa";
        meta.appendChild(etiquetaRanking);
    }

    bloqueTitulo.append(titulo, meta);

    const botonQuitar = crearBotonIcono({
        etiqueta: `Quitar ${nombre} del entrenamiento`,
        ruta: ICONOS.quitar,
        peligro: true
    });
    botonQuitar.dataset.accion = "quitar-ejercicio";
    botonQuitar.dataset.indice = String(indice);

    cabecera.append(bloqueTitulo, botonQuitar);
    tarjeta.appendChild(cabecera);

    const ultima = document.createElement("p");
    ultima.className = "ultima-vez";

    if (ultimaVez) {
        const etiqueta = document.createElement("strong");
        etiqueta.textContent = "Última vez: ";
        ultima.append(
            etiqueta,
            document.createTextNode(
                `${formatearFecha(ultimaVez.fecha)} · ${formatearSeries(ultimaVez.series)}`
            )
        );
    } else {
        ultima.textContent = "Sin registros anteriores para este ejercicio.";
    }

    tarjeta.appendChild(ultima);

    const listaSeries = document.createElement("div");
    listaSeries.className = "series-lista";

    ejercicioEstado.series.forEach((serie, indiceSerie) => {
        listaSeries.appendChild(crearFilaSerie(
            serie,
            indice,
            indiceSerie,
            nombre,
            ejercicioEstado.series.length
        ));
    });

    tarjeta.appendChild(listaSeries);

    const botonAgregarSerie = document.createElement("button");
    botonAgregarSerie.type = "button";
    botonAgregarSerie.className = "boton-agregar-serie";
    botonAgregarSerie.dataset.accion = "agregar-serie";
    botonAgregarSerie.dataset.indice = String(indice);
    botonAgregarSerie.textContent = "+ Añadir serie";
    tarjeta.appendChild(botonAgregarSerie);

    return tarjeta;
}

function crearFilaSerie(serie, indiceEjercicio, indiceSerie, nombreEjercicio, totalSeries) {
    const fila = document.createElement("div");
    fila.className = serie.completada ? "fila-serie completada" : "fila-serie";

    const cabecera = document.createElement("div");
    cabecera.className = "fila-serie-cabecera";

    const numero = document.createElement("span");
    numero.className = "numero-serie";
    numero.textContent = `Serie ${indiceSerie + 1}`;

    const acciones = document.createElement("div");
    acciones.className = "acciones-serie";

    const etiquetaCheck = document.createElement("label");
    etiquetaCheck.className = "check-serie";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(serie.completada);
    checkbox.dataset.campo = "completada";
    checkbox.dataset.indiceEjercicio = String(indiceEjercicio);
    checkbox.dataset.indiceSerie = String(indiceSerie);
    checkbox.setAttribute(
        "aria-label",
        `Serie ${indiceSerie + 1} de ${nombreEjercicio} completada`
    );

    const checkVisual = document.createElement("span");
    checkVisual.className = "check-visual";
    checkVisual.setAttribute("aria-hidden", "true");
    checkVisual.appendChild(crearIconoSvg(ICONOS.check));

    const textoCheck = document.createElement("span");
    textoCheck.textContent = "Hecha";

    etiquetaCheck.append(checkbox, checkVisual, textoCheck);

    const botonCopiar = crearBotonIcono({
        etiqueta: indiceSerie === 0
            ? `Copiar la última serie anterior de ${nombreEjercicio}`
            : `Copiar la serie ${indiceSerie} de ${nombreEjercicio}`,
        ruta: ICONOS.copiar
    });
    botonCopiar.dataset.accion = "copiar-serie";
    botonCopiar.dataset.indice = String(indiceEjercicio);
    botonCopiar.dataset.indiceSerie = String(indiceSerie);

    const botonQuitar = crearBotonIcono({
        etiqueta: `Quitar la serie ${indiceSerie + 1} de ${nombreEjercicio}`,
        ruta: ICONOS.borrar,
        peligro: true,
        deshabilitado: totalSeries <= 1
    });
    botonQuitar.dataset.accion = "quitar-serie";
    botonQuitar.dataset.indice = String(indiceEjercicio);
    botonQuitar.dataset.indiceSerie = String(indiceSerie);

    if (totalSeries <= 1) {
        botonQuitar.title = "Debe quedar al menos una serie";
    }

    acciones.append(etiquetaCheck, botonCopiar, botonQuitar);
    cabecera.append(numero, acciones);

    const campos = document.createElement("div");
    campos.className = "campos-serie";

    const campoPeso = crearCampoSerie(
        "Peso (kg)",
        "peso",
        "decimal",
        serie.peso,
        indiceEjercicio,
        indiceSerie,
        `Peso de la serie ${indiceSerie + 1} de ${nombreEjercicio}`
    );

    const signo = document.createElement("span");
    signo.className = "signo-por";
    signo.textContent = "×";
    signo.setAttribute("aria-hidden", "true");

    const campoReps = crearCampoSerie(
        "Reps",
        "reps",
        "numeric",
        serie.reps,
        indiceEjercicio,
        indiceSerie,
        `Repeticiones de la serie ${indiceSerie + 1} de ${nombreEjercicio}`
    );

    campos.append(campoPeso, signo, campoReps);
    fila.append(cabecera, campos);

    return fila;
}

function crearCampoSerie(etiquetaTexto, campo, modoEntrada, valor, indiceEjercicio, indiceSerie, etiquetaAccesible) {
    const etiqueta = document.createElement("label");
    etiqueta.className = "campo-serie";

    const texto = document.createElement("span");
    texto.textContent = etiquetaTexto;

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = modoEntrada;
    input.autocomplete = "off";
    input.value = String(valor ?? "");
    input.dataset.campo = campo;
    input.dataset.indiceEjercicio = String(indiceEjercicio);
    input.dataset.indiceSerie = String(indiceSerie);
    input.setAttribute("aria-label", etiquetaAccesible);
    input.setAttribute("enterkeyhint", "next");

    etiqueta.append(texto, input);
    return etiqueta;
}

function manejarClickEntrenamiento(evento) {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) {
        return;
    }

    const indiceEjercicio = Number(boton.dataset.indice);
    const ejercicio = estado.ejercicios[indiceEjercicio];

    if (!ejercicio) {
        return;
    }

    const accion = boton.dataset.accion;

    if (accion === "quitar-ejercicio") {
        estado.ejercicios.splice(indiceEjercicio, 1);
        renderizarEntrenar();
        autoguardarBorrador();
        return;
    }

    if (accion === "agregar-serie") {
        if (ejercicio.series.length >= 40) {
            mostrarAviso("Has alcanzado el máximo de 40 series para este ejercicio.", "error");
            return;
        }

        const nuevaSerie = { peso: "", reps: "", completada: false };
        ejercicio.series.push(nuevaSerie);
        renderizarEntrenar();
        autoguardarBorrador();
        enfocarCampo(indiceEjercicio, ejercicio.series.length - 1, "peso");
        return;    }

    const indiceSerie = Number(boton.dataset.indiceSerie);
    const serie = ejercicio.series[indiceSerie];

    if (!serie) {
        return;
    }

    if (accion === "quitar-serie") {
        if (ejercicio.series.length <= 1) {
            return;
        }

        ejercicio.series.splice(indiceSerie, 1);
        renderizarEntrenar();
        autoguardarBorrador();
        return;
    }

    if (accion === "copiar-serie") {
        copiarSerie(indiceEjercicio, indiceSerie);
    }
}

function manejarEntradaSerie(evento) {
    const input = evento.target.closest("input[data-campo]");
    if (!input || input.dataset.campo === "completada") {
        return;
    }

    const indiceEjercicio = Number(input.dataset.indiceEjercicio);
    const indiceSerie = Number(input.dataset.indiceSerie);
    const campo = input.dataset.campo;
    const serie = estado.ejercicios[indiceEjercicio]?.series[indiceSerie];

    if (!serie || (campo !== "peso" && campo !== "reps")) {
        return;
    }

    serie[campo] = input.value;
    input.removeAttribute("aria-invalid");
    autoguardarBorrador();
}

function manejarCambioSerie(evento) {
    const checkbox = evento.target.closest('input[data-campo="completada"]');
    if (!checkbox) {
        return;
    }

    const indiceEjercicio = Number(checkbox.dataset.indiceEjercicio);
    const indiceSerie = Number(checkbox.dataset.indiceSerie);
    const serie = estado.ejercicios[indiceEjercicio]?.series[indiceSerie];

    if (!serie) {
        return;
    }

    serie.completada = checkbox.checked;
    checkbox.closest(".fila-serie")?.classList.toggle("completada", checkbox.checked);
    autoguardarBorrador();
}

function copiarSerie(indiceEjercicio, indiceSerie) {
    const ejercicio = estado.ejercicios[indiceEjercicio];
    if (!ejercicio) {
        return;
    }

    let origen = null;

    if (indiceSerie > 0) {
        origen = ejercicio.series[indiceSerie - 1];
    } else {
        const datos = cargarDatos();
        const ultimaVez = obtenerUltimaVez(ejercicio.ejercicioId, datos.entrenos, estado.entrenoId);
        origen = ultimaVez?.series.at(-1) ?? null;
    }

    if (!origen) {
        mostrarAviso("No hay una serie anterior para copiar.", "aviso");
        return;
    }

    const destino = ejercicio.series[indiceSerie];
    destino.peso = String(origen.peso).replace(".", ",");
    destino.reps = String(origen.reps);
    destino.completada = false;

    renderizarEntrenar();
    autoguardarBorrador();
    enfocarCampo(indiceEjercicio, indiceSerie, "peso");
}

function guardarEntrenamiento() {
    const datos = cargarDatos();
    const todosLosEjercicios = obtenerTodosLosEjercicios(datos.ejerciciosPropios);
    const nombresPorId = Object.fromEntries(
        todosLosEjercicios.map((ejercicio) => [ejercicio.id, ejercicio.nombre])
    );
    const validacion = validarEntreno(estado, nombresPorId);

    if (!validacion.valido) {
        mostrarAviso(validacion.error, "error", 5200);
        enfocarErrorValidacion(validacion);
        return;
    }

    const recordsAntes = calcularMapaRecords(datos.entrenos);
    const resumenXPAntes = calcularResumenXP(datos.entrenos, recordsAntes);
    const entreno = {
        id: estado.entrenoId ?? generarIdEntreno(),
        fecha: validacion.datos.fecha,
        ejercicios: validacion.datos.ejercicios
    };
    const estabaEditando = Boolean(estado.entrenoId);

    if (estabaEditando) {
        const indice = datos.entrenos.findIndex((item) => item.id === estado.entrenoId);
        const original = indice >= 0 ? datos.entrenos[indice] : null;

        if (original?.duracionMin) {
            entreno.duracionMin = original.duracionMin;
        }

        if (indice >= 0) {
            datos.entrenos[indice] = entreno;
        } else {
            datos.entrenos.push(entreno);
        }
    } else {
        datos.entrenos.push(entreno);
    }

    datos.borrador = null;

    if (!guardarDatos(datos)) {
        mostrarAviso("No se pudo guardar el entrenamiento en este dispositivo.", "error", 6000);
        return;
    }

    const recordsDespues = calcularMapaRecords(datos.entrenos);
    const resumenXPDespues = calcularResumenXP(datos.entrenos, recordsDespues);
    const recordsDelEntreno = recordsDespues.get(entreno.id) ?? new Set();
    const racha = calcularRachas(datos.entrenos, datos.ajustes.objetivoSemanal);
    const resumen = {
        entreno,
        ejerciciosPropios: datos.ejerciciosPropios,
        records: recordsDelEntreno,
        totalSeries: validacion.totalSeries,
        estabaEditando,
        xpGanado: resumenXPDespues.total - resumenXPAntes.total,
        nivelAntes: resumenXPAntes.nivel.nivel,
        nivelDespues: resumenXPDespues.nivel.nivel,
        racha
    };

    estado = crearEstadoVacio();
    renderizarEntrenar();
    renderizarHistorial();
    navegar("historial");
    mostrarResumenEntrenamiento(resumen);
}

function mostrarResumenEntrenamiento(resumen) {
    const dialogo = document.getElementById("dialogo-resumen");
    const contenido = document.getElementById("contenido-resumen");

    if (!dialogo || !contenido) {
        mostrarAviso(
            resumen.estabaEditando
                ? "Entrenamiento actualizado."
                : "Entrenamiento guardado.",
            "exito"
        );
        return;
    }

    contenido.replaceChildren();

    const bloqueXP = document.createElement("section");
    bloqueXP.className = "resumen-xp";

    const etiquetaXP = document.createElement("p");
    etiquetaXP.className = "etiqueta-superior";
    etiquetaXP.textContent = "Experiencia";

    const valorXP = document.createElement("h3");
    valorXP.className = resumen.xpGanado < 0 ? "resumen-xp-negativo" : "resumen-xp-positivo";
    valorXP.textContent = `${resumen.xpGanado >= 0 ? "+" : ""}${resumen.xpGanado} XP`;

    const detalleNivel = document.createElement("p");
    if (resumen.nivelDespues > resumen.nivelAntes) {
        detalleNivel.textContent = `Has subido al nivel ${resumen.nivelDespues}.`;
    } else if (resumen.nivelDespues < resumen.nivelAntes) {
        detalleNivel.textContent = `Tu nivel se ha ajustado al ${resumen.nivelDespues}.`;
    } else {
        detalleNivel.textContent = `Nivel actual: ${resumen.nivelDespues}.`;
    }

    bloqueXP.append(etiquetaXP, valorXP, detalleNivel);

    const bloqueRacha = document.createElement("p");
    bloqueRacha.className = "resumen-racha";
    const textoRacha = resumen.racha.racha === 0
        ? "Sin racha semanal"
        : `Racha actual: ${resumen.racha.racha} ${resumen.racha.racha === 1 ? "semana" : "semanas"}`;
    bloqueRacha.textContent = `${textoRacha} · Esta semana: ${resumen.racha.entrenosSemanaActual}/${resumen.racha.objetivoSemanal} entrenamientos`;
    bloqueXP.appendChild(bloqueRacha);
    contenido.appendChild(bloqueXP);

    const tituloEjercicios = document.createElement("h3");
    tituloEjercicios.className = "resumen-subtitulo";
    tituloEjercicios.textContent = "Tus ejercicios";
    contenido.appendChild(tituloEjercicios);

    const lista = document.createElement("div");
    lista.className = "resumen-lista";

    resumen.entreno.ejercicios.forEach((ejercicioEntreno) => {
        const ejercicio = obtenerEjercicio(ejercicioEntreno.ejercicioId, resumen.ejerciciosPropios);
        const mejor = obtenerMejorSerie(ejercicioEntreno.series);

        const fila = document.createElement("article");
        fila.className = "resumen-ejercicio";

        const cabecera = document.createElement("div");
        cabecera.className = "resumen-ejercicio-cabecera";

        const bloqueNombre = document.createElement("div");
        const nombre = document.createElement("h4");
        nombre.textContent = ejercicio?.nombre ?? "Ejercicio eliminado";

        const grupo = document.createElement("span");
        grupo.className = "etiqueta-grupo";
        grupo.textContent = ejercicio?.grupo ?? "Sin grupo";

        bloqueNombre.append(nombre, grupo);

        if (resumen.records.has(ejercicioEntreno.ejercicioId)) {
            const marca = document.createElement("span");
            marca.className = "etiqueta-pr";
            marca.textContent = "Récord";
            marca.setAttribute("aria-label", "Récord personal");
            bloqueNombre.appendChild(marca);
        }

        cabecera.appendChild(bloqueNombre);

        const datos = document.createElement("p");
        datos.className = "resumen-ejercicio-datos";
        if (mejor) {
            datos.textContent = `Mejor serie: ${formatearNumero(mejor.peso, 1)} kg × ${mejor.reps} · 1RM: ${formatearNumero(mejor.rm, 1)} kg`;
        } else {
            datos.textContent = "Sin series válidas.";
        }

        fila.append(cabecera, datos);
        lista.appendChild(fila);
    });

    contenido.appendChild(lista);

    const nota = document.createElement("p");
    nota.className = "resumen-nota";
    nota.textContent = resumen.estabaEditando
        ? "Los récords y el XP se han recalculado con el historial actual."
        : "Los récords y el XP ya están guardados en este dispositivo.";
    contenido.appendChild(nota);

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton-primario boton-ancho";
    boton.textContent = "Ver historial";
    boton.addEventListener("click", () => dialogo.close());
    contenido.appendChild(boton);

    if (dialogo.open) {
        dialogo.close();
    }

    dialogo.showModal();
}

function enfocarErrorValidacion(validacion) {
    const campoTabla = document.getElementById("fecha-entrenamiento");

    if (validacion.indiceEjercicio === undefined) {
        if (campoTabla) {
            campoTabla.focus();
        }
        return;
    }

    if (validacion.campo) {
        enfocarCampo(validacion.indiceEjercicio, validacion.indiceSerie, validacion.campo, true);
        return;
    }

    const boton = document.querySelector(
        `#lista-entrenamiento button[data-accion="agregar-serie"][data-indice="${validacion.indiceEjercicio}"]`
    );
    boton?.focus();
}

function enfocarCampo(indiceEjercicio, indiceSerie, campo, marcarError = false) {
    requestAnimationFrame(() => {
        const selector = [
            "#lista-entrenamiento input",
            `[data-indice-ejercicio="${indiceEjercicio}"]`,
            `[data-indice-serie="${indiceSerie}"]`,
            `[data-campo="${campo}"]`
        ].join("");

        const input = document.querySelector(selector);
        if (input) {
            if (marcarError) {
                input.setAttribute("aria-invalid", "true");
            }
            input.scrollIntoView({ block: "center", behavior: "smooth" });
            input.focus({ preventScroll: true });
        }
    });
}

async function descartarTrabajoActual(titulo, mensaje, textoAceptar) {
    const confirmado = await confirmarAccion({
        titulo,
        mensaje,
        textoAceptar
    });

    if (!confirmado) {
        return;
    }

    const datos = cargarDatos();
    datos.borrador = null;

    if (!guardarDatos(datos)) {
        mostrarAviso("No se pudo borrar el borrador en este dispositivo.", "error");
        return;
    }

    estado = crearEstadoVacio();
    renderizarEntrenar();
    mostrarAviso("Borrador descartado.", "exito");
}

function obtenerUltimaVez(ejercicioId, entrenos, idExcluido = null) {
    const ordenados = [...entrenos].sort(compararEntrenosDescendente);

    for (const entreno of ordenados) {
        if (entreno.id === idExcluido) {
            continue;
        }

        const ejercicio = entreno.ejercicios.find((item) => item.ejercicioId === ejercicioId);

        if (ejercicio && ejercicio.series.length > 0) {
            return {
                fecha: entreno.fecha,
                series: ejercicio.series
            };
        }
    }

    return null;
}

function compararEntrenosDescendente(a, b) {
    return b.fecha.localeCompare(a.fecha) || String(b.id).localeCompare(String(a.id));
}

function formatearSeries(series) {
    return series
        .map((serie) => `${formatearNumero(serie.peso, 1)}×${serie.reps}`)
        .join(", ");
}

function generarIdEntreno() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `entreno-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function crearTarjetaHistorial(entreno, ejerciciosPropios, records) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-historial";

    const totalSeries = entreno.ejercicios.reduce(
        (total, ejercicio) => total + ejercicio.series.length,
        0
    );
    const recordsDelEntreno = records?.get(entreno.id) ?? new Set();

    const cabecera = document.createElement("header");
    cabecera.className = "historial-cabecera";

    const bloqueFecha = document.createElement("div");
    const fecha = document.createElement("h2");
    fecha.textContent = formatearFecha(entreno.fecha);

    const resumen = document.createElement("p");
    resumen.className = "historial-resumen";
    const textoRecords = recordsDelEntreno.size > 0
        ? ` · ${recordsDelEntreno.size} ${recordsDelEntreno.size === 1 ? "récord" : "récords"}`
        : "";
    resumen.textContent = `${entreno.ejercicios.length} ${entreno.ejercicios.length === 1 ? "ejercicio" : "ejercicios"} · ${totalSeries} ${totalSeries === 1 ? "serie" : "series"}${textoRecords}`;

    bloqueFecha.append(fecha, resumen);
    cabecera.appendChild(bloqueFecha);

    const ejercicios = document.createElement("div");
    ejercicios.className = "historial-ejercicios";

    entreno.ejercicios.forEach((ejercicioEntreno) => {
        const ejercicio = obtenerEjercicio(ejercicioEntreno.ejercicioId, ejerciciosPropios);
        const nombre = ejercicio?.nombre ?? "Ejercicio eliminado";
        const grupo = ejercicio?.grupo ?? "Sin grupo";

        const fila = document.createElement("div");
        fila.className = "historial-ejercicio";

        const filaCabecera = document.createElement("div");
        filaCabecera.className = "historial-ejercicio-cabecera";

        const bloqueTitulo = document.createElement("div");
        bloqueTitulo.className = "historial-titulo-ejercicio";

        const titulo = document.createElement("h3");
        titulo.textContent = nombre;
        bloqueTitulo.appendChild(titulo);

        if (recordsDelEntreno.has(ejercicioEntreno.ejercicioId)) {
            const marcaRecord = document.createElement("span");
            marcaRecord.className = "etiqueta-pr";
            marcaRecord.textContent = "Récord";
            marcaRecord.setAttribute("aria-label", "Récord personal");
            marcaRecord.setAttribute("title", "Récord personal en este entrenamiento");
            bloqueTitulo.appendChild(marcaRecord);
        }

        const etiqueta = document.createElement("span");
        etiqueta.className = "etiqueta-grupo";
        etiqueta.textContent = grupo;

        filaCabecera.append(bloqueTitulo, etiqueta);

        const series = document.createElement("p");
        series.className = "historial-series";
        series.textContent = formatearSeries(ejercicioEntreno.series);

        const mejor = document.createElement("p");
        mejor.className = "historial-mejor";
        const mejorSerie = obtenerMejorSerie(ejercicioEntreno.series);

        if (mejorSerie) {
            const etiquetaMejor = document.createElement("span");
            etiquetaMejor.textContent = "Mejor: ";
            const valorMejor = document.createElement("strong");
            valorMejor.textContent = `${formatearNumero(mejorSerie.peso, 1)} kg × ${mejorSerie.reps}`;
            const estimado = document.createTextNode(
                ` · 1RM estimado ${formatearNumero(mejorSerie.rm, 1)} kg`
            );
            mejor.append(etiquetaMejor, valorMejor, estimado);
        } else {
            mejor.textContent = "Sin series válidas.";
        }

        fila.append(filaCabecera, series, mejor);
        ejercicios.appendChild(fila);
    });

    const acciones = document.createElement("div");
    acciones.className = "historial-acciones";

    const botonEditar = document.createElement("button");
    botonEditar.type = "button";
    botonEditar.className = "boton boton-secundario";
    botonEditar.dataset.accion = "editar-entreno";
    botonEditar.dataset.id = entreno.id;
    botonEditar.textContent = "Editar";

    const botonBorrar = document.createElement("button");
    botonBorrar.type = "button";
    botonBorrar.className = "boton boton-texto peligro";
    botonBorrar.dataset.accion = "borrar-entreno";
    botonBorrar.dataset.id = entreno.id;
    botonBorrar.textContent = "Borrar";

    acciones.append(botonEditar, botonBorrar);
    tarjeta.append(cabecera, ejercicios, acciones);

    return tarjeta;
}

function manejarClickHistorial(evento) {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) {
        return;
    }

    if (boton.dataset.accion === "editar-entreno") {
        editarEntrenamiento(boton.dataset.id);
    } else if (boton.dataset.accion === "borrar-entreno") {
        borrarEntrenamiento(boton.dataset.id);
    }
}

async function editarEntrenamiento(entrenoId) {
    const datos = cargarDatos();
    const entreno = datos.entrenos.find((item) => item.id === entrenoId);

    if (!entreno) {
        mostrarAviso("No se encontró el entrenamiento.", "error");
        return;
    }

    if (estado.ejercicios.length > 0 || estado.entrenoId) {
        const confirmado = await confirmarAccion({
            titulo: "Abrir otro entrenamiento",
            mensaje: "Se descartará el borrador actual. ¿Quieres continuar?",
            textoAceptar: "Abrir entrenamiento"
        });

        if (!confirmado) {
            return;
        }
    }

    estado = {
        fecha: entreno.fecha,
        entrenoId: entreno.id,
        ejercicios: entreno.ejercicios.map((ejercicio) => ({
            ejercicioId: ejercicio.ejercicioId,
            series: ejercicio.series.map((serie) => ({
                peso: String(serie.peso).replace(".", ","),
                reps: String(serie.reps),
                completada: true
            }))
        }))
    };

    autoguardarBorrador();
    renderizarEntrenar();
    navegar("entrenar");
    window.scrollTo({ top: 0, behavior: "smooth" });
    mostrarAviso("Entrenamiento cargado para editar.", "info");
}

async function borrarEntrenamiento(entrenoId) {
    const datos = cargarDatos();
    const entreno = datos.entrenos.find((item) => item.id === entrenoId);

    if (!entreno) {
        mostrarAviso("No se encontró el entrenamiento.", "error");
        return;
    }

    const confirmado = await confirmarAccion({
        titulo: "Borrar entrenamiento",
        mensaje: `Se borrará el entrenamiento del ${formatearFecha(entreno.fecha)}. Esta acción no se puede deshacer.`,
        textoAceptar: "Borrar entrenamiento"
    });

    if (!confirmado) {
        return;
    }

    const datosActualizados = cargarDatos();
    datosActualizados.entrenos = datosActualizados.entrenos.filter(
        (item) => item.id !== entrenoId
    );

    const borrabaEdicionActual = estado.entrenoId === entrenoId;

    if (borrabaEdicionActual) {
        datosActualizados.borrador = null;
    }

    if (!guardarDatos(datosActualizados)) {
        mostrarAviso("No se pudo borrar el entrenamiento.", "error");
        return;
    }

    if (borrabaEdicionActual) {
        estado = crearEstadoVacio();
        renderizarEntrenar();
    }

    renderizarHistorial();
    mostrarAviso("Entrenamiento borrado.", "exito");
}

function abrirSelectorEjercicio() {
    const dialogo = document.getElementById("dialogo-ejercicio");
    const buscador = document.getElementById("buscador-ejercicio");

    if (!dialogo || !buscador) {
        return;
    }

    filtroGrupo = "Todos";
    busquedaSelector = "";
    buscador.value = "";
    renderizarFiltrosGrupo();
    renderizarSelectorEjercicios();
    dialogo.showModal();

    requestAnimationFrame(() => buscador.focus());
}

function manejarBusquedaSelector(evento) {
    busquedaSelector = evento.target.value;
    renderizarSelectorEjercicios();
}

function manejarFiltroGrupo(evento) {
    const boton = evento.target.closest("button[data-grupo]");
    if (!boton) {
        return;
    }

    filtroGrupo = boton.dataset.grupo;
    renderizarFiltrosGrupo();
    renderizarSelectorEjercicios();
}

function manejarSeleccionEjercicio(evento) {
    const boton = evento.target.closest("button[data-ejercicio-id]");
    if (!boton) {
        return;
    }

    agregarEjercicio(boton.dataset.ejercicioId);
}

function agregarEjercicio(ejercicioId) {
    if (estado.ejercicios.some((ejercicio) => ejercicio.ejercicioId === ejercicioId)) {
        mostrarAviso("Ese ejercicio ya está en el entrenamiento.", "aviso");
        return;
    }

    const datos = cargarDatos();
    const ejercicio = obtenerEjercicio(ejercicioId, datos.ejerciciosPropios);

    if (!ejercicio) {
        mostrarAviso("No se encontró el ejercicio seleccionado.", "error");
        return;
    }

    estado.ejercicios.push({
        ejercicioId: ejercicio.id,
        series: [{ peso: "", reps: "", completada: false }]
    });

    document.getElementById("dialogo-ejercicio")?.close();
    renderizarEntrenar();
    autoguardarBorrador();
    enfocarCampo(estado.ejercicios.length - 1, 0, "peso");
}

function renderizarFiltrosGrupo() {
    const contenedor = document.getElementById("filtros-grupo");
    if (!contenedor) {
        return;
    }

    contenedor.replaceChildren();

    ["Todos", ...GRUPOS].forEach((grupo) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "filtro-grupo";
        boton.dataset.grupo = grupo;
        boton.setAttribute("aria-pressed", String(filtroGrupo === grupo));
        boton.textContent = grupo;
        contenedor.appendChild(boton);
    });
}

function renderizarSelectorEjercicios() {
    const contenedor = document.getElementById("lista-selector-ejercicios");
    const contador = document.getElementById("contador-selector");

    if (!contenedor || !contador) {
        return;
    }

    const datos = cargarDatos();
    const termino = normalizarNombre(busquedaSelector);
    const ejercicios = obtenerTodosLosEjercicios(datos.ejerciciosPropios).filter((ejercicio) => {
        const coincideGrupo = filtroGrupo === "Todos" || ejercicio.grupo === filtroGrupo;
        const coincideNombre = termino === "" || normalizarNombre(ejercicio.nombre).includes(termino);
        return coincideGrupo && coincideNombre;
    });

    contenedor.replaceChildren();
    contador.textContent = `${ejercicios.length} ${ejercicios.length === 1 ? "ejercicio" : "ejercicios"}`;

    if (ejercicios.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = "No hay ejercicios que coincidan con la búsqueda.";
        contenedor.appendChild(vacio);
        return;
    }

    ejercicios.forEach((ejercicio) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "opcion-ejercicio";
        boton.dataset.ejercicioId = ejercicio.id;

        const texto = document.createElement("span");
        texto.className = "opcion-ejercicio-texto";

        const nombre = document.createElement("strong");
        nombre.textContent = ejercicio.nombre;

        const detalle = document.createElement("small");
        detalle.textContent = ejercicio.rankeable
            ? `${ejercicio.grupo} · Puntúa en rangos`
            : `${ejercicio.grupo} · Solo registro`;

        texto.append(nombre, detalle);

        const mas = document.createElement("span");
        mas.className = "mas";
        mas.setAttribute("aria-hidden", "true");
        mas.textContent = "+";

        boton.append(texto, mas);
        contenedor.appendChild(boton);
    });
}
