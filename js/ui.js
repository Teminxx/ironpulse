// Componentes de interfaz compartidos: avisos, confirmaciones y formato de números.

const DURACION_AVISO = 4200;
let interfazInicializada = false;
let resolverConfirmacion = null;

export function inicializarInterfaz() {
    if (interfazInicializada) {
        return;
    }

    const dialogo = document.getElementById("dialogo-confirmar");
    const botonAceptar = document.getElementById("btn-confirmar-aceptar");
    const botonCancelar = document.getElementById("btn-confirmar-cancelar");

    if (!dialogo || !botonAceptar || !botonCancelar) {
        return;
    }

    botonAceptar.addEventListener("click", () => cerrarConfirmacion(true));
    botonCancelar.addEventListener("click", () => cerrarConfirmacion(false));
    dialogo.addEventListener("cancel", (evento) => {
        evento.preventDefault();
        cerrarConfirmacion(false);
    });
    dialogo.addEventListener("close", () => {
        if (resolverConfirmacion) {
            const resolver = resolverConfirmacion;
            resolverConfirmacion = null;
            resolver(false);
        }
    });

    interfazInicializada = true;
}

function cerrarConfirmacion(valor) {
    if (resolverConfirmacion) {
        const resolver = resolverConfirmacion;
        resolverConfirmacion = null;
        const dialogo = document.getElementById("dialogo-confirmar");

        if (dialogo?.open) {
            dialogo.close();
        }

        resolver(valor);
    }
}

export function confirmarAccion({
    titulo = "Confirmar acción",
    mensaje,
    textoAceptar = "Confirmar",
    textoCancelar = "Cancelar",
    peligro = true
} = {}) {
    inicializarInterfaz();

    const dialogo = document.getElementById("dialogo-confirmar");
    const tituloElemento = document.getElementById("confirmar-titulo");
    const mensajeElemento = document.getElementById("confirmar-mensaje");
    const botonAceptar = document.getElementById("btn-confirmar-aceptar");
    const botonCancelar = document.getElementById("btn-confirmar-cancelar");

    if (!dialogo || !tituloElemento || !mensajeElemento || !botonAceptar || !botonCancelar) {
        return Promise.resolve(false);
    }

    if (dialogo.open) {
        return Promise.resolve(false);
    }

    tituloElemento.textContent = titulo;
    mensajeElemento.textContent = mensaje;
    botonAceptar.textContent = textoAceptar;
    botonCancelar.textContent = textoCancelar;
    botonAceptar.className = peligro ? "boton boton-peligro" : "boton boton-primario";

    return new Promise((resolver) => {
        resolverConfirmacion = resolver;
        dialogo.showModal();
        botonCancelar.focus();
    });
}

export function mostrarAviso(mensaje, tipo = "info", duracion = DURACION_AVISO) {
    const zona = document.getElementById("zona-avisos");
    if (!zona) {
        return;
    }

    const aviso = document.createElement("div");
    aviso.className = `aviso-toast ${tipo}`;
    aviso.textContent = mensaje;

    if (tipo === "error") {
        aviso.setAttribute("role", "alert");
    }

    zona.appendChild(aviso);
    requestAnimationFrame(() => aviso.classList.add("visible"));

    window.setTimeout(() => {
        aviso.classList.remove("visible");
        window.setTimeout(() => aviso.remove(), 180);
    }, Math.max(1200, duracion));
}

export function crearIconoSvg(ruta) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ruta);
    svg.appendChild(path);

    return svg;
}

export function crearBotonIcono({
    etiqueta,
    ruta,
    peligro = false,
    deshabilitado = false,
    clase = "boton-icono"
}) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = peligro ? `${clase} peligro` : clase;
    boton.setAttribute("aria-label", etiqueta);
    boton.disabled = deshabilitado;
    boton.appendChild(crearIconoSvg(ruta));
    return boton;
}

export function convertirNumeroDecimal(texto) {
    const limpio = String(texto ?? "").trim().replace(",", ".");

    if (!/^\d+(\.\d+)?$/.test(limpio)) {
        return Number.NaN;
    }

    return Number(limpio);
}

export function formatearNumero(valor, decimales = 1) {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "0";
    }

    return new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimales
    }).format(numero);
}
