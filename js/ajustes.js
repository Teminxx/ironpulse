// Pantalla de ajustes: perfil, historial de peso y ejercicios propios.
import { cargarDatos, guardarDatos } from "./almacen.js";
import { formatearFecha, hoyLocal } from "./fechas.js";
import {
    esGrupoValido,
    generarIdEjercicio,
    normalizarNombre,
    obtenerTodosLosEjercicios
} from "./ejercicios.js";
import {
    confirmarAccion,
    convertirNumeroDecimal,
    crearBotonIcono,
    formatearNumero,
    mostrarAviso
} from "./ui.js";

let ajustesInicializados = false;
let idEjercicioEnEdicion = null;

export function inicializarAjustes() {
    if (ajustesInicializados) {
        return;
    }

    const formularioAjustes = document.getElementById("form-ajustes");
    const formularioEjercicio = document.getElementById("form-ejercicio-propio");
    const listaEjercicios = document.getElementById("lista-ejercicios-propios");
    const botonCancelar = document.getElementById("btn-cancelar-ejercicio-propio");

    if (!formularioAjustes || !formularioEjercicio || !listaEjercicios || !botonCancelar) {
        return;
    }

    formularioAjustes.addEventListener("submit", manejarEnvioAjustes);
    formularioEjercicio.addEventListener("submit", manejarEnvioEjercicioPropio);
    listaEjercicios.addEventListener("click", manejarAccionEjercicioPropio);
    botonCancelar.addEventListener("click", cancelarEdicionEjercicio);

    ajustesInicializados = true;
    renderizarAjustes();
}

export function renderizarAjustes() {
    const datos = cargarDatos();
    const formulario = document.getElementById("form-ajustes");
    const pesoInput = document.getElementById("peso-corporal");
    const objetivoSelect = document.getElementById("objetivo-semanal");

    if (!formulario || !pesoInput || !objetivoSelect) {
        return;
    }

    formulario.querySelectorAll('input[name="sexo"]').forEach((radio) => {
        radio.checked = radio.value === (datos.ajustes.sexo ?? "");
    });

    pesoInput.value = datos.ajustes.pesoCorporal === null
        ? ""
        : String(datos.ajustes.pesoCorporal).replace(".", ",");
    objetivoSelect.value = String(datos.ajustes.objetivoSemanal);

    renderizarHistorialPeso(datos.historialPesoCorporal);
    renderizarEjerciciosPropios(datos.ejerciciosPropios);
}

export function validarAjustes(sexo, pesoTexto, objetivo) {
    if (!["", "masculino", "femenino"].includes(sexo)) {
        return { valido: false, error: "Selecciona un sexo válido." };
    }

    let pesoCorporal = null;
    const textoPeso = String(pesoTexto ?? "").trim();

    if (textoPeso !== "") {
        pesoCorporal = convertirNumeroDecimal(textoPeso);

        if (!Number.isFinite(pesoCorporal) || pesoCorporal < 30 || pesoCorporal > 300) {
            return { valido: false, error: "El peso corporal debe estar entre 30 y 300 kg." };
        }
    }

    if (!Number.isInteger(objetivo) || objetivo < 1 || objetivo > 7) {
        return { valido: false, error: "El objetivo semanal debe estar entre 1 y 7 entrenos." };
    }

    return {
        valido: true,
        sexo: sexo || null,
        pesoCorporal,
        objetivoSemanal: objetivo
    };
}

export function validarEjercicioPropio(nombre, grupo, ejerciciosExistentes, idEditando = null) {
    const nombreLimpio = String(nombre ?? "").trim().replace(/\s+/g, " ");

    if (nombreLimpio.length < 2 || nombreLimpio.length > 50) {
        return { valido: false, error: "El nombre debe tener entre 2 y 50 caracteres." };
    }

    if (!esGrupoValido(grupo)) {
        return { valido: false, error: "Selecciona un grupo muscular válido." };
    }

    const nombreNormalizado = normalizarNombre(nombreLimpio);
    const duplicado = ejerciciosExistentes.some((ejercicio) => (
        ejercicio.id !== idEditando
        && normalizarNombre(ejercicio.nombre) === nombreNormalizado
    ));

    if (duplicado) {
        return { valido: false, error: "Ya existe un ejercicio con ese nombre." };
    }

    return { valido: true, nombre: nombreLimpio, grupo };
}

function manejarEnvioAjustes(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const sexo = formulario.querySelector('input[name="sexo"]:checked')?.value ?? "";
    const pesoTexto = document.getElementById("peso-corporal")?.value ?? "";
    const objetivo = Number(document.getElementById("objetivo-semanal")?.value);
    const validacion = validarAjustes(sexo, pesoTexto, objetivo);

    if (!validacion.valido) {
        mostrarAviso(validacion.error, "error");
        return;
    }

    const datos = cargarDatos();
    datos.ajustes = {
        sexo: validacion.sexo,
        pesoCorporal: validacion.pesoCorporal,
        objetivoSemanal: validacion.objetivoSemanal
    };

    if (validacion.pesoCorporal !== null) {
        const fecha = hoyLocal();
        const registro = datos.historialPesoCorporal.find((item) => item.fecha === fecha);

        if (registro) {
            registro.peso = validacion.pesoCorporal;
        } else {
            datos.historialPesoCorporal.push({
                fecha,
                peso: validacion.pesoCorporal
            });
        }
    }

    if (!guardarDatos(datos)) {
        mostrarAviso("No se pudieron guardar los ajustes en este dispositivo.", "error");
        return;
    }

    renderizarAjustes();

    if (validacion.sexo === null || validacion.pesoCorporal === null) {
        mostrarAviso("Ajustes guardados. Para calcular rangos faltan el sexo y el peso corporal.", "aviso");
    } else {
        mostrarAviso("Ajustes guardados.", "exito");
    }
}

function manejarEnvioEjercicioPropio(evento) {
    evento.preventDefault();

    const nombreInput = document.getElementById("nombre-ejercicio-propio");
    const grupoSelect = document.getElementById("grupo-ejercicio-propio");

    if (!nombreInput || !grupoSelect) {
        return;
    }

    const datos = cargarDatos();
    const ejerciciosExistentes = obtenerTodosLosEjercicios(datos.ejerciciosPropios);
    const validacion = validarEjercicioPropio(
        nombreInput.value,
        grupoSelect.value,
        ejerciciosExistentes,
        idEjercicioEnEdicion
    );

    if (!validacion.valido) {
        mostrarAviso(validacion.error, "error");
        nombreInput.focus();
        return;
    }

    if (idEjercicioEnEdicion) {
        const ejercicio = datos.ejerciciosPropios.find((item) => item.id === idEjercicioEnEdicion);

        if (!ejercicio) {
            cancelarEdicionEjercicio();
            mostrarAviso("El ejercicio que intentabas editar ya no existe.", "error");
            return;
        }

        ejercicio.nombre = validacion.nombre;
        ejercicio.grupo = validacion.grupo;
        ejercicio.rankeable = false;
    } else {
        datos.ejerciciosPropios.push({
            id: generarIdEjercicio(validacion.nombre, ejerciciosExistentes),
            nombre: validacion.nombre,
            grupo: validacion.grupo,
            rankeable: false
        });
    }

    if (!guardarDatos(datos)) {
        mostrarAviso("No se pudo guardar el ejercicio propio.", "error");
        return;
    }

    const estabaEditando = Boolean(idEjercicioEnEdicion);
    cancelarEdicionEjercicio();
    renderizarAjustes();
    mostrarAviso(
        estabaEditando ? "Ejercicio propio actualizado." : "Ejercicio propio creado.",
        "exito"
    );
}

function manejarAccionEjercicioPropio(evento) {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) {
        return;
    }

    const ejercicioId = boton.dataset.id;
    if (!ejercicioId) {
        return;
    }

    if (boton.dataset.accion === "editar") {
        iniciarEdicionEjercicio(ejercicioId);
    } else if (boton.dataset.accion === "borrar") {
        borrarEjercicioPropio(ejercicioId);
    }
}

function iniciarEdicionEjercicio(ejercicioId) {
    const datos = cargarDatos();
    const ejercicio = datos.ejerciciosPropios.find((item) => item.id === ejercicioId);
    const nombreInput = document.getElementById("nombre-ejercicio-propio");
    const grupoSelect = document.getElementById("grupo-ejercicio-propio");
    const botonGuardar = document.getElementById("btn-guardar-ejercicio-propio");
    const botonCancelar = document.getElementById("btn-cancelar-ejercicio-propio");

    if (!ejercicio || !nombreInput || !grupoSelect || !botonGuardar || !botonCancelar) {
        mostrarAviso("No se encontró el ejercicio propio.", "error");
        return;
    }

    idEjercicioEnEdicion = ejercicioId;
    nombreInput.value = ejercicio.nombre;
    grupoSelect.value = ejercicio.grupo;
    botonGuardar.textContent = "Guardar cambios";
    botonCancelar.hidden = false;
    nombreInput.focus();
    nombreInput.select();
}

function cancelarEdicionEjercicio() {
    idEjercicioEnEdicion = null;

    const formulario = document.getElementById("form-ejercicio-propio");
    const botonGuardar = document.getElementById("btn-guardar-ejercicio-propio");
    const botonCancelar = document.getElementById("btn-cancelar-ejercicio-propio");

    if (formulario) {
        formulario.reset();
    }

    if (botonGuardar) {
        botonGuardar.textContent = "Crear ejercicio";
    }

    if (botonCancelar) {
        botonCancelar.hidden = true;
    }
}

async function borrarEjercicioPropio(ejercicioId) {
    const datos = cargarDatos();
    const ejercicio = datos.ejerciciosPropios.find((item) => item.id === ejercicioId);

    if (!ejercicio) {
        mostrarAviso("No se encontró el ejercicio propio.", "error");
        return;
    }

    const estaEnBorrador = datos.borrador?.ejercicios?.some(
        (item) => item.ejercicioId === ejercicioId
    ) ?? false;

    if (estaEnBorrador) {
        mostrarAviso("No puedes borrar un ejercicio que está en el borrador actual.", "error");
        return;
    }

    const confirmado = await confirmarAccion({
        titulo: "Borrar ejercicio propio",
        mensaje: `Se eliminará "${ejercicio.nombre}". Los entrenos antiguos conservarán el registro, pero mostrarán que el ejercicio ya no existe.`,
        textoAceptar: "Borrar ejercicio"
    });

    if (!confirmado) {
        return;
    }

    const datosActualizados = cargarDatos();
    datosActualizados.ejerciciosPropios = datosActualizados.ejerciciosPropios.filter(
        (item) => item.id !== ejercicioId
    );

    if (!guardarDatos(datosActualizados)) {
        mostrarAviso("No se pudo borrar el ejercicio propio.", "error");
        return;
    }

    if (idEjercicioEnEdicion === ejercicioId) {
        cancelarEdicionEjercicio();
    }

    renderizarAjustes();
    mostrarAviso("Ejercicio propio borrado.", "exito");
}

function renderizarHistorialPeso(registros) {
    const contenedor = document.getElementById("lista-historial-peso");
    if (!contenedor) {
        return;
    }

    contenedor.replaceChildren();

    if (registros.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = "Aún no hay registros de peso.";
        contenedor.appendChild(vacio);
        return;
    }

    [...registros]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .forEach((registro) => {
            const fila = document.createElement("div");
            fila.className = "fila-compacta";

            const fecha = document.createElement("span");
            fecha.textContent = formatearFecha(registro.fecha);

            const peso = document.createElement("strong");
            peso.textContent = `${formatearNumero(registro.peso, 1)} kg`;

            fila.append(fecha, peso);
            contenedor.appendChild(fila);
        });
}

function renderizarEjerciciosPropios(ejercicios) {
    const contenedor = document.getElementById("lista-ejercicios-propios");
    if (!contenedor) {
        return;
    }

    contenedor.replaceChildren();

    if (ejercicios.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = "Todavía no has creado ejercicios propios.";
        contenedor.appendChild(vacio);
        return;
    }

    ejercicios.forEach((ejercicio) => {
        const item = document.createElement("article");
        item.className = "item-ejercicio-propio";

        const texto = document.createElement("div");
        const nombre = document.createElement("h3");
        nombre.textContent = ejercicio.nombre;
        const detalle = document.createElement("p");
        detalle.textContent = `${ejercicio.grupo} · No puntúa en rangos`;
        texto.append(nombre, detalle);

        const acciones = document.createElement("div");
        acciones.className = "acciones-item";

        const botonEditar = crearBotonIcono({
            etiqueta: `Editar ${ejercicio.nombre}`,
            ruta: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4"
        });
        botonEditar.dataset.accion = "editar";
        botonEditar.dataset.id = ejercicio.id;

        const botonBorrar = crearBotonIcono({
            etiqueta: `Borrar ${ejercicio.nombre}`,
            ruta: "M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5",
            peligro: true
        });
        botonBorrar.dataset.accion = "borrar";
        botonBorrar.dataset.id = ejercicio.id;

        acciones.append(botonEditar, botonBorrar);
        item.append(texto, acciones);
        contenedor.appendChild(item);
    });
}
