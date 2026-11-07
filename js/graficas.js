// Gráficas y tablas de datos para la pantalla Progreso.
// Todo se construye con DOM y SVG nativos, sin librerías externas.
import { formatearFecha, parsearFechaLocal } from "./fechas.js";
import { formatearNumero } from "./ui.js";

const NS_SVG = "http://www.w3.org/2000/svg";
const ANCHO = 360;
const ALTO = 220;
const MARGEN = {
    superior: 18,
    derecha: 14,
    inferior: 32,
    izquierda: 46
};

const FORMATO_FECHA_CORTA = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit"
});

function crearElementoSvg(nombre, atributos = {}) {
    const elemento = document.createElementNS(NS_SVG, nombre);

    Object.entries(atributos).forEach(([clave, valor]) => {
        elemento.setAttribute(clave, String(valor));
    });

    return elemento;
}

export function formatearFechaCorta(fecha) {
    const fechaLocal = parsearFechaLocal(fecha);

    if (!fechaLocal) {
        return fecha;
    }

    return FORMATO_FECHA_CORTA.format(fechaLocal).replace(/\./g, "");
}

function prepararPuntos(puntos) {
    if (!Array.isArray(puntos)) {
        return [];
    }

    return puntos.reduce((resultado, punto) => {
        const fecha = parsearFechaLocal(punto?.fecha);
        const valor = Number(punto?.valor);

        if (!fecha || !Number.isFinite(valor)) {
            return resultado;
        }

        resultado.push({
            ...punto,
            fecha,
            fechaISO: punto.fecha,
            valor
        });
        return resultado;
    }, []).sort((a, b) => a.fecha - b.fecha);
}

export function crearGraficoLinea({
    puntos = [],
    etiqueta = "Gráfica de evolución",
    color = "acento",
    formatearValor = (valor) => `${formatearNumero(valor, 1)} kg`
} = {}) {
    const lista = prepararPuntos(puntos);

    if (lista.length === 0) {
        return null;
    }

    const svg = crearElementoSvg("svg", {
        viewBox: `0 0 ${ANCHO} ${ALTO}`,
        class: `grafica-linea grafica-${color}`,
        role: "img",
        "aria-label": etiqueta
    });

    const titulo = crearElementoSvg("title");
    titulo.textContent = etiqueta;

    const descripcion = crearElementoSvg("desc");
    descripcion.textContent = `${lista.length} ${lista.length === 1 ? "registro" : "registros"} entre ${formatearFecha(lista[0].fechaISO)} y ${formatearFecha(lista[lista.length - 1].fechaISO)}.`;

    svg.append(titulo, descripcion);

    const anchoGrafica = ANCHO - MARGEN.izquierda - MARGEN.derecha;
    const altoGrafica = ALTO - MARGEN.superior - MARGEN.inferior;
    const valores = lista.map((punto) => punto.valor);
    const valorMinimo = Math.min(...valores);
    const valorMaximo = Math.max(...valores);
    const rango = valorMaximo - valorMinimo;
    const relleno = rango === 0
        ? Math.max(1, Math.abs(valorMaximo) * 0.05)
        : rango * 0.15;

    let minimoY = valorMinimo - relleno;
    let maximoY = valorMaximo + relleno;

    if (minimoY < 0) {
        minimoY = 0;
    }

    if (maximoY <= minimoY) {
        maximoY = minimoY + 1;
    }

    const inicioTiempo = lista[0].fecha.getTime();
    const finTiempo = lista[lista.length - 1].fecha.getTime();
    const duracion = finTiempo - inicioTiempo;

    const posicionX = (fecha) => (
        duracion === 0
            ? MARGEN.izquierda + anchoGrafica / 2
            : MARGEN.izquierda + ((fecha.getTime() - inicioTiempo) / duracion) * anchoGrafica
    );

    const posicionY = (valor) => (
        MARGEN.superior + ((maximoY - valor) / (maximoY - minimoY)) * altoGrafica
    );

    const marcasY = [maximoY, (maximoY + minimoY) / 2, minimoY];

    marcasY.forEach((valor) => {
        const y = posicionY(valor);

        const linea = crearElementoSvg("line", {
            x1: MARGEN.izquierda,
            y1: y,
            x2: ANCHO - MARGEN.derecha,
            y2: y,
            class: "grafica-rejilla"
        });

        const texto = crearElementoSvg("text", {
            x: MARGEN.izquierda - 8,
            y: y + 3,
            class: "grafica-etiqueta",
            "text-anchor": "end"
        });
        texto.textContent = formatearValor(valor);

        svg.append(linea, texto);
    });

    const baseY = posicionY(minimoY);

    if (lista.length > 1) {
        const puntosArea = lista.map((punto) => (
            `${posicionX(punto.fecha)} ${posicionY(punto.valor)}`
        ));
        const area = crearElementoSvg("path", {
            d: `M ${posicionX(lista[0].fecha)} ${baseY} L ${puntosArea.join(" L ")} L ${posicionX(lista[lista.length - 1].fecha)} ${baseY} Z`,
            class: "grafica-area"
        });

        const trazo = crearElementoSvg("path", {
            d: `M ${puntosArea.join(" L ")}`,
            class: "grafica-trazo"
        });

        svg.append(area, trazo);
    }

    const radio = lista.length > 18 ? 2.5 : 3.5;

    lista.forEach((punto, indice) => {
        const circulo = crearElementoSvg("circle", {
            cx: posicionX(punto.fecha),
            cy: posicionY(punto.valor),
            r: indice === lista.length - 1 ? radio + 1 : radio,
            class: indice === lista.length - 1
                ? "grafica-punto grafica-punto-final"
                : "grafica-punto"
        });

        const tituloPunto = crearElementoSvg("title");
        tituloPunto.textContent = `${formatearFecha(punto.fechaISO)}: ${formatearValor(punto.valor)}${punto.detalle ? ` · ${punto.detalle}` : ""}`;
        circulo.appendChild(tituloPunto);
        svg.appendChild(circulo);
    });

    const indicesEtiquetas = lista.length === 1
        ? [0]
        : [0, Math.floor((lista.length - 1) / 2), lista.length - 1];
    const indicesUnicos = [...new Set(indicesEtiquetas)];

    indicesUnicos.forEach((indice) => {
        const punto = lista[indice];
        const esPrimero = indice === 0;
        const esUltimo = indice === lista.length - 1;

        const texto = crearElementoSvg("text", {
            x: posicionX(punto.fecha),
            y: ALTO - 8,
            class: "grafica-etiqueta grafica-etiqueta-x",
            "text-anchor": esPrimero && !esUltimo ? "start" : esUltimo && !esPrimero ? "end" : "middle"
        });
        texto.textContent = formatearFechaCorta(punto.fechaISO);
        svg.appendChild(texto);
    });

    const eje = crearElementoSvg("line", {
        x1: MARGEN.izquierda,
        y1: baseY,
        x2: ANCHO - MARGEN.derecha,
        y2: baseY,
        class: "grafica-eje"
    });

    svg.appendChild(eje);
    return svg;
}

export function crearGraficoBarras({ datos = [], etiqueta = "Gráfica de barras" } = {}) {
    const lista = Array.isArray(datos)
        ? datos.filter((dato) => dato && Number.isFinite(Number(dato.valor)))
        : [];

    if (lista.length === 0) {
        return null;
    }

    const maximo = Math.max(...lista.map((dato) => Number(dato.valor)), 1);
    const contenedor = document.createElement("div");
    contenedor.className = "grafica-barras";
    contenedor.setAttribute("role", "list");
    contenedor.setAttribute("aria-label", etiqueta);

    lista.forEach((dato) => {
        const valor = Math.max(0, Number(dato.valor));
        const porcentaje = Math.min(100, (valor / maximo) * 100);

        const fila = document.createElement("div");
        fila.className = "barra-grupo";
        fila.setAttribute("role", "listitem");

        const cabecera = document.createElement("div");
        cabecera.className = "barra-grupo-cabecera";

        const nombre = document.createElement("span");
        nombre.className = "barra-grupo-nombre";
        nombre.textContent = dato.nombre;

        const valorTexto = document.createElement("strong");
        valorTexto.className = "barra-grupo-valor";
        valorTexto.textContent = dato.valorTexto ?? `${formatearNumero(valor, 0)} kg`;

        cabecera.append(nombre, valorTexto);

        const pista = document.createElement("div");
        pista.className = "barra-grupo-pista";
        pista.setAttribute("aria-hidden", "true");

        const relleno = document.createElement("span");
        relleno.className = "barra-grupo-relleno";
        relleno.style.width = `${porcentaje}%`;
        pista.appendChild(relleno);

        fila.append(cabecera, pista);

        if (dato.detalle) {
            const detalle = document.createElement("span");
            detalle.className = "barra-grupo-detalle";
            detalle.textContent = dato.detalle;
            fila.appendChild(detalle);
        }

        contenedor.appendChild(fila);
    });

    return contenedor;
}

export function crearTablaDatos({
    resumen = "Ver datos",
    columnas = [],
    filas = []
} = {}) {
    if (!Array.isArray(columnas) || columnas.length === 0 || !Array.isArray(filas) || filas.length === 0) {
        return null;
    }

    const detalles = document.createElement("details");
    detalles.className = "datos-grafica";

    const cabecera = document.createElement("summary");
    cabecera.textContent = resumen;

    const contenedor = document.createElement("div");
    contenedor.className = "tabla-datos-contenedor";

    const tabla = document.createElement("table");
    tabla.className = "tabla-datos";

    const thead = document.createElement("thead");
    const filaCabecera = document.createElement("tr");

    columnas.forEach((columna) => {
        const celda = document.createElement("th");
        celda.scope = "col";
        celda.textContent = columna;
        filaCabecera.appendChild(celda);
    });

    thead.appendChild(filaCabecera);

    const tbody = document.createElement("tbody");

    filas.forEach((fila) => {
        const filaTabla = document.createElement("tr");

        fila.forEach((valor) => {
            const celda = document.createElement("td");
            celda.textContent = valor;
            filaTabla.appendChild(celda);
        });

        tbody.appendChild(filaTabla);
    });

    tabla.append(thead, tbody);
    contenedor.appendChild(tabla);
    detalles.append(cabecera, contenedor);
    return detalles;
}
