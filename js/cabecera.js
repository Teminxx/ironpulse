// Cabecera: mantiene visibles la racha, la experiencia y el nivel.
// Igual que el resto de contadores, todo se recalcula desde los datos guardados.
import { cargarDatos } from "./almacen.js";
import { calcularMapaRecords } from "./rangos.js";
import { calcularRachas } from "./rachas.js";
import { calcularResumenXP } from "./xp.js";

const formateador = new Intl.NumberFormat("es-ES");
const temporizadores = new WeakMap();
let inicializado = false;

function animar(elemento) {
    const bloque = elemento.closest(".dato-cabecera");

    if (!bloque) {
        return;
    }

    bloque.classList.remove("actualizado");
    // Fuerza el reinicio de la animación aunque el valor cambie varias veces seguidas.
    void bloque.offsetWidth;
    bloque.classList.add("actualizado");

    const anterior = temporizadores.get(bloque);

    if (anterior) {
        clearTimeout(anterior);
    }

    temporizadores.set(bloque, setTimeout(() => {
        bloque.classList.remove("actualizado");
    }, 420));
}

function escribir(id, texto) {
    const elemento = document.getElementById(id);

    if (!elemento || elemento.textContent === texto) {
        return;
    }

    elemento.textContent = texto;
    animar(elemento);
}

function actualizarEtiqueta(id, texto) {
    document.getElementById(id)?.setAttribute("aria-label", texto);
}

export function actualizarCabecera() {
    const datos = cargarDatos();
    const entrenos = Array.isArray(datos.entrenos) ? datos.entrenos : [];
    const records = calcularMapaRecords(entrenos);
    const resumen = calcularResumenXP(entrenos, records);
    const racha = calcularRachas(entrenos, datos.ajustes?.objetivoSemanal ?? 3);

    // La racha de IronPulse se mide en semanas consecutivas que cumplen el objetivo.
    const dias = racha.racha * 7;
    const porcentaje = Math.round(resumen.nivel.progreso * 100);

    escribir("cabecera-racha", formateador.format(dias));
    escribir("cabecera-xp", formateador.format(resumen.total));
    escribir("cabecera-nivel", String(resumen.nivel.nivel));
    escribir("cabecera-nivel-detalle", `${porcentaje}%`);

    const anillo = document.getElementById("anillo-nivel");

    if (anillo) {
        anillo.style.setProperty("--progreso", `${porcentaje}%`);
    }

    actualizarEtiqueta("dato-racha", `Racha: ${dias} ${dias === 1 ? "día" : "días"}`);
    actualizarEtiqueta("dato-xp", `Experiencia: ${formateador.format(resumen.total)} XP`);
    actualizarEtiqueta(
        "dato-nivel",
        `Nivel ${resumen.nivel.nivel}, ${porcentaje}% hacia el nivel ${resumen.nivel.nivel + 1}`
    );
}

export function inicializarCabecera() {
    if (inicializado) {
        return;
    }

    inicializado = true;
    actualizarCabecera();
    document.addEventListener("ironpulse:datos-actualizados", actualizarCabecera);
}
