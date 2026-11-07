// Arranque de IronPulse y navegación inferior.
import { inicializarAjustes, renderizarAjustes } from "./ajustes.js";
import { inicializarCabecera } from "./cabecera.js";
import {
    inicializarEntrenos,
    renderizarEntrenar,
    renderizarHistorial
} from "./entrenos.js";
import { inicializarProgreso, renderizarProgreso } from "./progreso.js";
import { inicializarPWA } from "./pwa.js";
import { inicializarRangos, renderizarRangos } from "./rangos.js";
import { inicializarRespaldo } from "./respaldo.js";
import { inicializarInterfaz } from "./ui.js";

const PESTANAS = ["entrenar", "historial", "rangos", "progreso", "ajustes"];
const TITULOS = {
    entrenar: "IronPulse · Entrenar",
    historial: "IronPulse · Historial",
    rangos: "IronPulse · Rangos",
    progreso: "IronPulse · Progreso",
    ajustes: "IronPulse · Ajustes"
};

let panelActivo = "entrenar";

function activarPanel(nombre, { desplazar = true } = {}) {
    if (!PESTANAS.includes(nombre)) {
        return;
    }

    panelActivo = nombre;

    PESTANAS.forEach((clave) => {
        const boton = document.getElementById(`tab-${clave}`);
        const panel = document.getElementById(`panel-${clave}`);
        const activo = clave === nombre;

        if (boton) {
            boton.classList.toggle("activa", activo);
            boton.setAttribute("aria-selected", String(activo));
            boton.tabIndex = activo ? 0 : -1;
        }

        if (panel) {
            panel.hidden = !activo;
        }
    });

    if (nombre === "entrenar") {
        renderizarEntrenar();
    } else if (nombre === "historial") {
        renderizarHistorial();
    } else if (nombre === "rangos") {
        renderizarRangos();
    } else if (nombre === "progreso") {
        renderizarProgreso();
    } else if (nombre === "ajustes") {
        renderizarAjustes();
    }

    document.title = TITULOS[nombre];

    if (desplazar) {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function inicializarNavegacion() {
    const navegacion = document.querySelector(".navegacion-inferior");
    if (!navegacion) {
        return;
    }

    PESTANAS.forEach((clave) => {
        document.getElementById(`tab-${clave}`)?.addEventListener("click", () => {
            activarPanel(clave);
        });
    });

    navegacion.addEventListener("keydown", (evento) => {
        const boton = evento.target.closest('[role="tab"]');
        if (!boton) {
            return;
        }

        const indiceActual = PESTANAS.indexOf(boton.dataset.panel);
        if (indiceActual < 0) {
            return;
        }

        let siguiente = null;

        if (evento.key === "ArrowRight") {
            siguiente = (indiceActual + 1) % PESTANAS.length;
        } else if (evento.key === "ArrowLeft") {
            siguiente = (indiceActual - 1 + PESTANAS.length) % PESTANAS.length;
        } else if (evento.key === "Home") {
            siguiente = 0;
        } else if (evento.key === "End") {
            siguiente = PESTANAS.length - 1;
        }

        if (siguiente === null) {
            return;
        }

        evento.preventDefault();
        const siguienteBoton = document.getElementById(`tab-${PESTANAS[siguiente]}`);
        siguienteBoton?.focus();
        activarPanel(PESTANAS[siguiente]);
    });
}

function iniciarAplicacion() {
    inicializarInterfaz();
    inicializarCabecera();
    inicializarAjustes();
    inicializarRespaldo();
    inicializarPWA();
    inicializarNavegacion();
    inicializarEntrenos({ irAPestana: activarPanel });
    inicializarRangos({ irAPestana: activarPanel });
    inicializarProgreso({ irAPestana: activarPanel });
    activarPanel(panelActivo, { desplazar: false });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarAplicacion, { once: true });
} else {
    iniciarAplicacion();
}
