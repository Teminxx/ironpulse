// Service worker de IronPulse. Guarda la interfaz para que la app abra sin conexión.
// La caché se rellena siempre desde la red (cache: "reload") para no heredar
// versiones antiguas que GitHub Pages pueda tener todavía en su caché HTTP.
const CACHE_ACTUAL = "ironpulse-cache-v8";

const RECURSOS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/ajustes.js",
    "./js/almacen.js",
    "./js/app.js",
    "./js/cabecera.js",
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
            .then((cache) => {
                const peticiones = RECURSOS.map((recurso) => new Request(
                    new URL(recurso, self.location.href).href,
                    { cache: "reload" }
                ));

                return cache.addAll(peticiones);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (evento) => {
    evento.waitUntil((async () => {
        const claves = await caches.keys();
        // Las versiones v4 y v5 podían mezclar HTML nuevo con CSS antiguo.
        // Si venimos de ellas, forzamos una recarga limpia aunque la página
        // abierta todavía no tenga el detector de actualizaciones.
        const requiereRecarga = claves.includes("ironpulse-cache-v4")
            || claves.includes("ironpulse-cache-v5");

        await Promise.all(
            claves
                .filter((clave) => clave.startsWith("ironpulse-cache-") && clave !== CACHE_ACTUAL)
                .map((clave) => caches.delete(clave))
        );

        await self.clients.claim();

        if (requiereRecarga) {
            const clientes = await self.clients.matchAll({ type: "window" });

            clientes.forEach((cliente) => {
                cliente.navigate(cliente.url).catch(() => {});
            });
        }
    })());
});

self.addEventListener("message", (evento) => {
    if (evento.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

async function responderNavegacion(request) {
    const url = new URL(request.url);
    const esPantallaApp = url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");

    if (!esPantallaApp) {
        try {
            return await fetch(request);
        } catch (error) {
            return new Response("Esta página no está disponible sin conexión.", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" }
            });
        }
    }

    const cache = await caches.open(CACHE_ACTUAL);
    const guardado = (await cache.match("./index.html")) || (await cache.match("./"));

    if (guardado) {
        return guardado;
    }

    try {
        const respuesta = await fetch("./index.html", { cache: "no-store" });

        if (respuesta.ok) {
            await cache.put("./index.html", respuesta.clone());
        }

        return respuesta;
    } catch (error) {
        return new Response("IronPulse no está disponible sin conexión.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
    }
}

async function responderRecurso(request) {
    const cache = await caches.open(CACHE_ACTUAL);
    const guardado = await cache.match(request);

    if (guardado) {
        return guardado;
    }

    try {
        const respuesta = await fetch(request);

        if (respuesta.ok) {
            await cache.put(request, respuesta.clone());
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
