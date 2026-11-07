// Exportación e importación de copias de seguridad en formato JSON.
import {
    VERSION_DATOS,
    cargarDatos,
    guardarDatos,
    normalizarDatosImportados
} from "./almacen.js";
import { hoyLocal } from "./fechas.js";
import { confirmarAccion, mostrarAviso } from "./ui.js";

const FORMATO_COPIA = "ironpulse-copia";
const TAMANO_MAXIMO = 5 * 1024 * 1024;
let respaldoInicializado = false;

function unirLista(partes) {
    if (partes.length === 0) {
        return "";
    }

    if (partes.length === 1) {
        return partes[0];
    }

    return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function describirDatos(datos) {
    const entrenos = datos.entrenos.length;
    const ejercicios = datos.ejerciciosPropios.length;
    const pesos = datos.historialPesoCorporal.length;

    return unirLista([
        `${entrenos} ${entrenos === 1 ? "entrenamiento" : "entrenamientos"}`,
        `${ejercicios} ${ejercicios === 1 ? "ejercicio propio" : "ejercicios propios"}`,
        `${pesos} ${pesos === 1 ? "registro de peso" : "registros de peso"}`
    ]);
}

export function crearCopiaSeguridad(datos = cargarDatos()) {
    return {
        formato: FORMATO_COPIA,
        version: VERSION_DATOS,
        exportadoEl: hoyLocal(),
        datos: {
            version: VERSION_DATOS,
            entrenos: datos.entrenos,
            ajustes: datos.ajustes,
            ejerciciosPropios: datos.ejerciciosPropios,
            borrador: datos.borrador,
            historialPesoCorporal: datos.historialPesoCorporal
        }
    };
}

export function serializarCopia(datos = cargarDatos()) {
    return JSON.stringify(crearCopiaSeguridad(datos), null, 2);
}

export function validarCopiaSeguridad(valor) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        return { valido: false, error: "El archivo no contiene una copia válida de IronPulse." };
    }

    if (valor.formato !== FORMATO_COPIA) {
        return { valido: false, error: "El archivo no es una copia de seguridad de IronPulse." };
    }

    if (!Number.isInteger(valor.version) || valor.version < 1) {
        return { valido: false, error: "La copia no indica una versión válida." };
    }

    if (valor.version > VERSION_DATOS) {
        return {
            valido: false,
            error: "La copia pertenece a una versión más reciente de IronPulse. Actualiza la aplicación antes de importarla."
        };
    }

    const datos = normalizarDatosImportados(valor.datos);

    if (!datos) {
        return { valido: false, error: "La copia no contiene datos de entrenamiento válidos." };
    }

    return {
        valido: true,
        datos,
        resumen: describirDatos(datos)
    };
}

export function descargarCopiaSeguridad() {
    const texto = serializarCopia();
    const archivo = new Blob([texto], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = `ironpulse-copia-${hoyLocal()}.json`;
    enlace.rel = "noopener";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    mostrarAviso("Copia de seguridad exportada.", "exito");
}

function leerArchivo(archivo) {
    if (typeof archivo.text === "function") {
        return archivo.text();
    }

    return new Promise((resolver, rechazar) => {
        const lector = new FileReader();
        lector.onload = () => resolver(String(lector.result ?? ""));
        lector.onerror = () => rechazar(lector.error ?? new Error("No se pudo leer el archivo."));
        lector.readAsText(archivo);
    });
}

export async function importarArchivoCopia(archivo) {
    if (!archivo) {
        return;
    }

    if (archivo.size > TAMANO_MAXIMO) {
        mostrarAviso("El archivo es demasiado grande. El máximo es 5 MB.", "error", 6000);
        return;
    }

    let texto;

    try {
        texto = await leerArchivo(archivo);
    } catch (error) {
        console.warn("No se pudo leer el archivo de copia de seguridad.", error);
        mostrarAviso("No se pudo leer el archivo seleccionado.", "error");
        return;
    }

    let contenido;

    try {
        contenido = JSON.parse(texto);
    } catch (error) {
        mostrarAviso("El archivo no contiene JSON válido.", "error", 6000);
        return;
    }

    const validacion = validarCopiaSeguridad(contenido);

    if (!validacion.valido) {
        mostrarAviso(validacion.error, "error", 6000);
        return;
    }

    const confirmado = await confirmarAccion({
        titulo: "Importar copia de seguridad",
        mensaje: `La copia contiene ${validacion.resumen}. Se reemplazarán todos los datos actuales de este dispositivo, incluido el borrador.`,
        textoAceptar: "Importar y reemplazar"
    });

    if (!confirmado) {
        mostrarAviso("Importación cancelada.", "info");
        return;
    }

    if (!guardarDatos(validacion.datos)) {
        mostrarAviso("No se pudo guardar la copia. Revisa el espacio disponible del dispositivo.", "error", 6000);
        return;
    }

    mostrarAviso("Copia importada. La aplicación se actualizará.", "exito", 3000);
    window.setTimeout(() => window.location.reload(), 900);
}

export function inicializarRespaldo() {
    if (respaldoInicializado) {
        return;
    }

    const botonExportar = document.getElementById("btn-exportar-copia");
    const botonImportar = document.getElementById("btn-importar-copia");
    const archivoInput = document.getElementById("archivo-copia");

    if (!botonExportar || !botonImportar || !archivoInput) {
        return;
    }

    botonExportar.addEventListener("click", descargarCopiaSeguridad);
    botonImportar.addEventListener("click", () => archivoInput.click());

    archivoInput.addEventListener("change", async () => {
        const archivo = archivoInput.files?.[0] ?? null;
        archivoInput.value = "";
        await importarArchivoCopia(archivo);
    });

    respaldoInicializado = true;
}
