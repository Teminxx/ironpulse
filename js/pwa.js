// Registro del service worker e instalación de la PWA.
import { mostrarAviso } from "./ui.js";

let pwaInicializada = false;
let eventoInstalacion = null;

function estaInstalada() {
    return window.matchMedia("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
}

function actualizarInterfazInstalacion() {
    const boton = document.getElementById("btn-instalar-pwa");
    const estado = document.getElementById("estado-pwa");

    if (!boton || !estado) {
        return;
    }

    if (estaInstalada()) {
        boton.hidden = true;
        estado.textContent = "IronPulse está instalada en este dispositivo y funciona sin conexión.";
        return;
    }

    if (eventoInstalacion) {
        boton.hidden = false;
        estado.textContent = "Instálala para abrirla a pantalla completa desde tu pantalla de inicio.";
        return;
    }

    boton.hidden = true;
    estado.textContent = "Puedes instalarla desde el menú del navegador. Después de la primera visita también funciona sin conexión.";
}

function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url))
        .catch((error) => {
            console.warn("No se pudo activar el modo sin conexión.", error);
        });
}

function configurarInstalacion() {
    window.addEventListener("beforeinstallprompt", (evento) => {
        evento.preventDefault();
        eventoInstalacion = evento;
        actualizarInterfazInstalacion();
    });

    window.addEventListener("appinstalled", () => {
        eventoInstalacion = null;
        actualizarInterfazInstalacion();
        mostrarAviso("IronPulse se ha instalado en este dispositivo.", "exito", 5000);
    });

    document.getElementById("btn-instalar-pwa")?.addEventListener("click", async () => {
        if (!eventoInstalacion) {
            return;
        }

        const evento = eventoInstalacion;
        eventoInstalacion = null;
        evento.prompt();

        try {
            await evento.userChoice;
        } catch (error) {
            console.warn("No se pudo completar la instalación.", error);
        }

        actualizarInterfazInstalacion();
    });
}

export function inicializarPWA() {
    if (pwaInicializada) {
        return;
    }

    pwaInicializada = true;
    registrarServiceWorker();
    configurarInstalacion();
    actualizarInterfazInstalacion();
}
