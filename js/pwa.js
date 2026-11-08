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

    // Si esta página ya estaba controlada, una nueva versión del service worker
    // recarga una sola vez para evitar mezclar HTML nuevo con estilos antiguos.
    const yaControlada = Boolean(navigator.serviceWorker.controller);
    let recargando = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!yaControlada || recargando) {
            return;
        }

        recargando = true;
        window.location.reload();
    });

    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url))
        .catch((error) => {
            console.warn("No se pudo activar el modo sin conexión.", error);
        });

    // Al volver a la app instalada, busca actualizaciones sin esperar a navegar.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") {
            return;
        }

        navigator.serviceWorker.getRegistration()
            .then((registro) => registro?.update())
            .catch(() => {});
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
