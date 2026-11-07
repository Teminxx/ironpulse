// Service worker de IronPulse. Guarda la interfaz para que la app abra sin conexión.
const CACHE_ACTUAL = "ironpulse-cache-v3";

const RECURSOS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/ajustes.js",
    "./js/almacen.js",
    "./js/app.js",
    "./js/ejercicios.js",
    "./js/entrenos.js",
    "./js/estandares.js",
    "./js/fechas.js",
    "./js/graficas.js",
    "./js/progreso.js",
    "./js/pwa.js",
    "./js/rachas.js",
    "./js/rangos.js",
    "./js/respaldo.js",
    "./js/ui.js",
    "./js/xp.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-512.png",
    "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (evento) => {
    evento.waitUntil(
        caches.open(CACHE_ACTUAL)
            .then((cache) => cache.addAll(RECURSOS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((claves) => Promise.all(
                claves
                    .filter((clave) => clave.startsWith("ironpulse-cache-") && clave !== CACHE_ACTUAL)
                    .map((clave) => caches.delete(clave))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("message", (evento) => {
    if (evento.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

async function responderNavegacion(request) {
    const cache = await caches.open(CACHE_ACTUAL);
    const url = new URL(request.url);
    const esPantallaPrincipal = url.pathname === "/" || url.pathname.endsWith("/index.html");

    try {
        const respuesta = await fetch(request);

        if (respuesta.ok) {
            if (esPantallaPrincipal) {
                await cache.put("./index.html", respuesta.clone());
            }

            return respuesta;
        }

        return (await cache.match("./index.html"))
            || (await cache.match("./"))
            || respuesta;
    } catch (error) {
        return (await cache.match("./index.html"))
            || (await cache.match("./"))
            || new Response("IronPulse no está disponible sin conexión.", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" }
            });
    }
}

async function responderRecurso(request) {
    const cache = await caches.open(CACHE_ACTUAL);
    const guardado = await cache.match(request);

    if (guardado) {
        fetch(request)
            .then((respuesta) => {
                if (respuesta.ok) {
                    cache.put(request, respuesta);
                }
            })
            .catch(() => {});
        return guardado;
    }

    try {
        const respuesta = await fetch(request);

        if (respuesta.ok) {
            cache.put(request, respuesta.clone());
        }

        return respuesta;
    } catch (error) {
        return new Response("", { status: 503, statusText: "Sin conexión" });
    }
}

self.addEventListener("fetch", (evento) => {
    const { request } = evento;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        evento.respondWith(responderNavegacion(request));
        return;
    }

    evento.respondWith(responderRecurso(request));
});
