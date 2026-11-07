// Pantalla Progreso: resumen histórico, evolución del 1RM, volumen por grupo
// muscular y evolución del peso corporal. Todo se calcula desde los datos guardados.
import { cargarDatos } from "./almacen.js";
import { GRUPOS, obtenerTodosLosEjercicios } from "./ejercicios.js";
import { formatearFecha } from "./fechas.js";
import { crearGraficoBarras, crearGraficoLinea, crearTablaDatos } from "./graficas.js";
import { calcularMapaRecords, obtenerMejorSerie } from "./rangos.js";
import { calcularRachas } from "./rachas.js";
import { formatearNumero } from "./ui.js";
import { calcularResumenXP } from "./xp.js";

let progresoInicializado = false;
let navegar = () => {};
let ejercicioSeleccionado = null;

export function calcularDatosProgreso(datos) {
    const entrenos = Array.isArray(datos?.entrenos) ? datos.entrenos : [];
    const ejercicios = obtenerTodosLosEjercicios(datos?.ejerciciosPropios ?? []);
    const mapaEjercicios = new Map(ejercicios.map((ejercicio) => [ejercicio.id, ejercicio]));
    const records = calcularMapaRecords(entrenos);
    const progresoUsuario = calcularResumenXP(entrenos, records);
    const racha = calcularRachas(entrenos, datos?.ajustes?.objetivoSemanal ?? 3);

    let totalSeries = 0;
    let volumenTotal = 0;
    const volumenPorGrupo = new Map(
        GRUPOS.map((grupo) => [grupo, { volumen: 0, series: 0 }])
    );
    const fuerzaPorEjercicio = new Map();

    entrenos.forEach((entreno) => {
        if (!entreno || !Array.isArray(entreno.ejercicios)) {
            return;
        }

        entreno.ejercicios.forEach((ejercicioEntreno) => {
            const ejercicio = mapaEjercicios.get(ejercicioEntreno?.ejercicioId) ?? null;
            const mejor = obtenerMejorSerie(ejercicioEntreno?.series);

            if (Array.isArray(ejercicioEntreno?.series)) {
                ejercicioEntreno.series.forEach((serie) => {
                    const peso = Number(serie?.peso);
                    const reps = Number(serie?.reps);

                    if (!Number.isFinite(peso) || !Number.isFinite(reps) || peso <= 0 || reps <= 0) {
                        return;
                    }

                    totalSeries += 1;
                    const volumen = peso * reps;
                    volumenTotal += volumen;

                    if (ejercicio && volumenPorGrupo.has(ejercicio.grupo)) {
                        const acumulado = volumenPorGrupo.get(ejercicio.grupo);
                        acumulado.volumen += volumen;
                        acumulado.series += 1;
                    }
                });
            }

            if (!ejercicio || !mejor) {
                return;
            }

            if (!fuerzaPorEjercicio.has(ejercicio.id)) {
                fuerzaPorEjercicio.set(ejercicio.id, {
                    id: ejercicio.id,
                    nombre: ejercicio.nombre,
                    grupo: ejercicio.grupo,
                    rankeable: Boolean(ejercicio.rankeable),
                    porFecha: new Map()
                });
            }

            const registro = fuerzaPorEjercicio.get(ejercicio.id);
            const anterior = registro.porFecha.get(entreno.fecha);

            if (!anterior || mejor.rm > anterior.rm) {
                registro.porFecha.set(entreno.fecha, {
                    fecha: entreno.fecha,
                    rm: mejor.rm,
                    peso: mejor.peso,
                    reps: mejor.reps
                });
            }
        });
    });

    const ejerciciosFuerza = Array.from(fuerzaPorEjercicio.values())
        .map((ejercicio) => {
            const puntos = Array.from(ejercicio.porFecha.values())
                .sort((a, b) => a.fecha.localeCompare(b.fecha));

            return {
                id: ejercicio.id,
                nombre: ejercicio.nombre,
                grupo: ejercicio.grupo,
                rankeable: ejercicio.rankeable,
                puntos,
                actual: puntos[puntos.length - 1]?.rm ?? 0,
                mejor: Math.max(...puntos.map((punto) => punto.rm)),
                cambio: puntos.length > 1
                    ? puntos[puntos.length - 1].rm - puntos[0].rm
                    : 0,
                fechaUltima: puntos[puntos.length - 1]?.fecha ?? null
            };
        })
        .sort((a, b) => (
            a.grupo.localeCompare(b.grupo, "es")
            || a.nombre.localeCompare(b.nombre, "es")
        ));

    const ejercicioPredeterminado = [...ejerciciosFuerza]
        .sort((a, b) => (
            b.puntos.length - a.puntos.length
            || (b.fechaUltima ?? "").localeCompare(a.fechaUltima ?? "")
            || b.mejor - a.mejor
            || a.nombre.localeCompare(b.nombre, "es")
        ))[0]?.id ?? null;

    const gruposVolumen = Array.from(volumenPorGrupo, ([nombre, grupo]) => ({
        nombre,
        volumen: grupo.volumen,
        series: grupo.series
    }))
        .filter((grupo) => grupo.series > 0)
        .sort((a, b) => (
            b.volumen - a.volumen
            || GRUPOS.indexOf(a.nombre) - GRUPOS.indexOf(b.nombre)
        ));

    const historialPeso = Array.isArray(datos?.historialPesoCorporal)
        ? datos.historialPesoCorporal
        : [];
    const puntosPeso = historialPeso
        .filter((registro) => registro && Number.isFinite(Number(registro.peso)))
        .map((registro) => ({
            fecha: registro.fecha,
            valor: Number(registro.peso)
        }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pesoGuardado = datos?.ajustes?.pesoCorporal;
    const pesoAjustes = pesoGuardado === null || pesoGuardado === undefined
        ? null
        : Number(pesoGuardado);
    const pesoActual = puntosPeso.length > 0
        ? puntosPeso[puntosPeso.length - 1].valor
        : (Number.isFinite(pesoAjustes) ? pesoAjustes : null);

    return {
        totalEntrenos: entrenos.length,
        totalSeries,
        volumenTotal,
        progresoUsuario,
        racha,
        ejerciciosFuerza,
        ejercicioPredeterminado,
        gruposVolumen,
        gruposConVolumen: gruposVolumen.length,
        peso: {
            puntos: puntosPeso,
            actual: pesoActual,
            cambio: puntosPeso.length > 1
                ? puntosPeso[puntosPeso.length - 1].valor - puntosPeso[0].valor
                : 0,
            tieneHistorial: puntosPeso.length > 0
        }
    };
}

export function inicializarProgreso({ irAPestana = () => {} } = {}) {
    if (progresoInicializado) {
        return;
    }

    const contenido = document.getElementById("contenido-progreso");

    if (!contenido) {
        return;
    }

    navegar = irAPestana;
    contenido.addEventListener("change", manejarCambioEjercicio);
    contenido.addEventListener("click", manejarClickProgreso);

    progresoInicializado = true;
    renderizarProgreso();
}

function manejarCambioEjercicio(evento) {
    if (evento.target.id !== "selector-ejercicio-progreso") {
        return;
    }

    const ejercicioId = evento.target.value;

    if (!ejercicioId) {
        return;
    }

    const detalle = document.getElementById("detalle-fuerza");

    if (!detalle) {
        return;
    }

    ejercicioSeleccionado = ejercicioId;
    renderizarDetalleFuerza(detalle, calcularDatosProgreso(cargarDatos()), ejercicioId);
}

function manejarClickProgreso(evento) {
    const boton = evento.target.closest("button[data-accion]");

    if (!boton) {
        return;
    }

    if (boton.dataset.accion === "ir-entrenar") {
        navegar("entrenar");
    } else if (boton.dataset.accion === "ir-ajustes") {
        navegar("ajustes");
    }
}

export function renderizarProgreso() {
    const contenido = document.getElementById("contenido-progreso");

    if (!contenido) {
        return;
    }

    const resumen = calcularDatosProgreso(cargarDatos());

    contenido.replaceChildren();
    contenido.appendChild(crearTarjetaResumen(resumen));

    if (resumen.totalEntrenos === 0) {
        contenido.appendChild(crearTarjetaSinDatos());
    } else {
        contenido.appendChild(crearSeccionFuerza(resumen));
        contenido.appendChild(crearSeccionGrupos(resumen));
    }

    contenido.appendChild(crearSeccionPeso(resumen));
}

function crearTarjetaResumen(resumen) {
    const { nivel, total } = resumen.progresoUsuario;
    const { racha, entrenosSemanaActual, objetivoSemanal } = resumen.racha;

    const tarjeta = document.createElement("section");
    tarjeta.className = "tarjeta tarjeta-resumen-progreso";
    tarjeta.setAttribute("aria-labelledby", "titulo-resumen-progreso");

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-resumen-progreso";

    const bloqueNivel = document.createElement("div");
    const etiqueta = document.createElement("p");
    etiqueta.className = "etiqueta-superior";
    etiqueta.textContent = "Tu evolución";

    const titulo = document.createElement("h2");
    titulo.id = "titulo-resumen-progreso";
    titulo.textContent = `Nivel ${nivel.nivel}`;

    bloqueNivel.append(etiqueta, titulo);

    const xp = document.createElement("span");
    xp.className = "xp-resumen";
    xp.textContent = `${total} XP`;

    cabecera.append(bloqueNivel, xp);
    tarjeta.appendChild(cabecera);

    const detalle = document.createElement("p");
    detalle.className = "detalle-resumen-progreso";
    detalle.textContent = "Datos calculados desde tu historial de entrenamientos.";
    tarjeta.appendChild(detalle);

    const metricas = document.createElement("div");
    metricas.className = "cuadricula-resumen-progreso";

    metricas.append(
        crearMetricaResumen("Entrenos", String(resumen.totalEntrenos)),
        crearMetricaResumen("Series", String(resumen.totalSeries)),
        crearMetricaResumen("Volumen total", `${formatearNumero(resumen.volumenTotal, 0)} kg`),
        crearMetricaResumen(
            "Racha",
            racha === 0
                ? "Sin racha"
                : `${racha} ${racha === 1 ? "semana" : "semanas"}`
        )
    );

    tarjeta.appendChild(metricas);

    const pie = document.createElement("p");
    pie.className = "pie-resumen-progreso";
    pie.textContent = `Esta semana: ${entrenosSemanaActual}/${objetivoSemanal} entrenamientos.`;
    tarjeta.appendChild(pie);

    return tarjeta;
}

function crearMetricaResumen(etiqueta, valor) {
    const bloque = document.createElement("div");
    bloque.className = "metrica-progreso";

    const textoEtiqueta = document.createElement("span");
    textoEtiqueta.textContent = etiqueta;

    const textoValor = document.createElement("strong");
    textoValor.textContent = valor;

    bloque.append(textoEtiqueta, textoValor);
    return bloque;
}

function crearTarjetaSinDatos() {
    const tarjeta = document.createElement("section");
    tarjeta.className = "tarjeta tarjeta-vacia-progreso";

    const titulo = document.createElement("h2");
    titulo.textContent = "Todavía no hay progreso";

    const texto = document.createElement("p");
    texto.textContent = "Registra tu primer entrenamiento para ver la evolución del 1RM y del volumen por grupo muscular.";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton-primario boton-ancho";
    boton.dataset.accion = "ir-entrenar";
    boton.textContent = "Registrar entrenamiento";

    tarjeta.append(titulo, texto, boton);
    return tarjeta;
}

function crearSeccionFuerza(resumen) {
    const seccion = document.createElement("section");
    seccion.className = "tarjeta tarjeta-grafica";
    seccion.setAttribute("aria-labelledby", "titulo-grafica-fuerza");

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-grafica";

    const bloque = document.createElement("div");
    const titulo = document.createElement("h2");
    titulo.id = "titulo-grafica-fuerza";
    titulo.textContent = "Evolución de fuerza";

    const subtitulo = document.createElement("p");
    subtitulo.className = "subtitulo-grafica";
    subtitulo.textContent = "1RM estimado con la fórmula de Epley.";

    bloque.append(titulo, subtitulo);
    cabecera.appendChild(bloque);
    seccion.appendChild(cabecera);

    if (resumen.ejerciciosFuerza.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = "Todavía no hay series válidas para mostrar la evolución del 1RM.";
        seccion.appendChild(vacio);
        return seccion;
    }

    const campo = document.createElement("div");
    campo.className = "campo campo-selector-progreso";

    const label = document.createElement("label");
    label.htmlFor = "selector-ejercicio-progreso";
    label.textContent = "Ejercicio";

    const selector = document.createElement("select");
    selector.id = "selector-ejercicio-progreso";

    GRUPOS.forEach((grupo) => {
        const ejerciciosDelGrupo = resumen.ejerciciosFuerza
            .filter((ejercicio) => ejercicio.grupo === grupo)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

        if (ejerciciosDelGrupo.length === 0) {
            return;
        }

        const optgroup = document.createElement("optgroup");
        optgroup.label = grupo;

        ejerciciosDelGrupo.forEach((ejercicio) => {
            const opcion = document.createElement("option");
            opcion.value = ejercicio.id;
            opcion.textContent = ejercicio.rankeable
                ? ejercicio.nombre
                : `${ejercicio.nombre} · No puntúa`;
            optgroup.appendChild(opcion);
        });

        selector.appendChild(optgroup);
    });

    const seleccionado = resumen.ejerciciosFuerza.some(
        (ejercicio) => ejercicio.id === ejercicioSeleccionado
    )
        ? ejercicioSeleccionado
        : resumen.ejercicioPredeterminado;

    selector.value = seleccionado;
    ejercicioSeleccionado = seleccionado;

    campo.append(label, selector);
    seccion.appendChild(campo);

    const detalle = document.createElement("div");
    detalle.id = "detalle-fuerza";
    detalle.className = "detalle-grafica";
    seccion.appendChild(detalle);

    renderizarDetalleFuerza(detalle, resumen, seleccionado);
    return seccion;
}

function renderizarDetalleFuerza(contenedor, resumen, ejercicioId) {
    const ejercicio = resumen.ejerciciosFuerza.find((item) => item.id === ejercicioId)
        ?? resumen.ejerciciosFuerza[0];

    contenedor.replaceChildren();

    if (!ejercicio) {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = "No hay datos para este ejercicio.";
        contenedor.appendChild(vacio);
        return;
    }

    const cambio = ejercicio.puntos.length > 1
        ? formatearCambio(ejercicio.cambio, "kg")
        : "Primer registro";

    const metricas = document.createElement("div");
    metricas.className = "metricas-grafica";
    metricas.append(
        crearMetrica("1RM actual", `${formatearNumero(ejercicio.actual, 1)} kg`),
        crearMetrica("Mejor 1RM", `${formatearNumero(ejercicio.mejor, 1)} kg`),
        crearMetrica(
            "Cambio",
            cambio,
            ejercicio.cambio > 0 ? "cambio-positivo" : ejercicio.cambio < 0 ? "cambio-negativo" : ""
        )
    );
    contenedor.appendChild(metricas);

    if (!ejercicio.rankeable) {
        const aviso = document.createElement("p");
        aviso.className = "aviso-grafica";
        aviso.textContent = "Este ejercicio no puntúa en rangos. El 1RM se muestra solo como referencia de tu carga registrada.";
        contenedor.appendChild(aviso);
    }

    const figura = document.createElement("div");
    figura.className = "contenedor-grafica";

    const etiqueta = `Evolución del 1RM de ${ejercicio.nombre} desde ${formatearFecha(ejercicio.puntos[0].fecha)} hasta ${formatearFecha(ejercicio.puntos[ejercicio.puntos.length - 1].fecha)}. Valor actual ${formatearNumero(ejercicio.actual, 1)} kilogramos.`;

    const grafica = crearGraficoLinea({
        puntos: ejercicio.puntos.map((punto) => ({
            fecha: punto.fecha,
            valor: punto.rm,
            detalle: `${formatearNumero(punto.peso, 1)} kg × ${punto.reps}`
        })),
        etiqueta,
        color: "acento",
        formatearValor: (valor) => `${formatearNumero(valor, 1)} kg`
    });

    if (grafica) {
        figura.appendChild(grafica);
        contenedor.appendChild(figura);
    }

    if (ejercicio.puntos.length === 1) {
        const nota = document.createElement("p");
        nota.className = "nota-grafica";
        nota.textContent = "Solo hay un registro. La línea mostrará la evolución con el próximo entrenamiento.";
        contenedor.appendChild(nota);
    }

    const tabla = crearTablaDatos({
        resumen: "Ver datos de fuerza",
        columnas: ["Fecha", "1RM", "Mejor serie"],
        filas: ejercicio.puntos.map((punto) => [
            formatearFecha(punto.fecha),
            `${formatearNumero(punto.rm, 1)} kg`,
            `${formatearNumero(punto.peso, 1)} kg × ${punto.reps}`
        ])
    });

    if (tabla) {
        contenedor.appendChild(tabla);
    }
}

function crearSeccionGrupos(resumen) {
    const seccion = document.createElement("section");
    seccion.className = "tarjeta tarjeta-grafica";
    seccion.setAttribute("aria-labelledby", "titulo-grafica-grupos");

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-grafica";

    const bloque = document.createElement("div");
    const titulo = document.createElement("h2");
    titulo.id = "titulo-grafica-grupos";
    titulo.textContent = "Volumen por grupo muscular";

    const subtitulo = document.createElement("p");
    subtitulo.className = "subtitulo-grafica";
    subtitulo.textContent = "Peso total levantado en todas tus sesiones.";

    bloque.append(titulo, subtitulo);
    cabecera.appendChild(bloque);
    seccion.appendChild(cabecera);

    if (resumen.gruposVolumen.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = "El volumen aparecerá cuando registres series en tus ejercicios.";
        seccion.appendChild(vacio);
        return seccion;
    }

    const grafica = crearGraficoBarras({
        datos: resumen.gruposVolumen.map((grupo) => ({
            nombre: grupo.nombre,
            valor: grupo.volumen,
            valorTexto: `${formatearNumero(grupo.volumen, 0)} kg`,
            detalle: `${grupo.series} ${grupo.series === 1 ? "serie" : "series"}`
        })),
        etiqueta: "Volumen total por grupo muscular"
    });

    if (grafica) {
        seccion.appendChild(grafica);
    }

    const nota = document.createElement("p");
    nota.className = "nota-grafica";
    nota.textContent = `El volumen suma peso × repeticiones. ${resumen.gruposConVolumen} de ${GRUPOS.length} grupos con datos.`;
    seccion.appendChild(nota);

    return seccion;
}

function crearSeccionPeso(resumen) {
    const seccion = document.createElement("section");
    seccion.className = "tarjeta tarjeta-grafica";
    seccion.setAttribute("aria-labelledby", "titulo-grafica-peso");

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-grafica";

    const bloque = document.createElement("div");
    const titulo = document.createElement("h2");
    titulo.id = "titulo-grafica-peso";
    titulo.textContent = "Peso corporal";

    const subtitulo = document.createElement("p");
    subtitulo.className = "subtitulo-grafica";
    subtitulo.textContent = "Registros guardados desde tus ajustes.";

    bloque.append(titulo, subtitulo);
    cabecera.appendChild(bloque);

    const botonActualizar = document.createElement("button");
    botonActualizar.type = "button";
    botonActualizar.className = "boton boton-texto";
    botonActualizar.dataset.accion = "ir-ajustes";
    botonActualizar.textContent = "Actualizar";
    cabecera.appendChild(botonActualizar);

    seccion.appendChild(cabecera);

    if (!resumen.peso.tieneHistorial) {
        const vacio = document.createElement("p");
        vacio.className = "texto-vacio";
        vacio.textContent = resumen.peso.actual === null
            ? "Todavía no hay registros de peso. Añade tu peso corporal desde Ajustes."
            : `Peso actual: ${formatearNumero(resumen.peso.actual, 1)} kg. Aún no hay historial de cambios.`;
        seccion.appendChild(vacio);
        return seccion;
    }

    const cambio = resumen.peso.puntos.length > 1
        ? formatearCambio(resumen.peso.cambio, "kg")
        : "Primer registro";

    const metricas = document.createElement("div");
    metricas.className = "metricas-grafica";
    metricas.append(
        crearMetrica("Peso actual", `${formatearNumero(resumen.peso.actual, 1)} kg`),
        crearMetrica(
            "Cambio",
            cambio,
            resumen.peso.cambio > 0 ? "cambio-neutro" : resumen.peso.cambio < 0 ? "cambio-neutro" : ""
        )
    );
    seccion.appendChild(metricas);

    const figura = document.createElement("div");
    figura.className = "contenedor-grafica";

    const etiqueta = `Evolución del peso corporal desde ${formatearFecha(resumen.peso.puntos[0].fecha)} hasta ${formatearFecha(resumen.peso.puntos[resumen.peso.puntos.length - 1].fecha)}. Peso actual ${formatearNumero(resumen.peso.actual, 1)} kilogramos.`;

    const grafica = crearGraficoLinea({
        puntos: resumen.peso.puntos,
        etiqueta,
        color: "naranja",
        formatearValor: (valor) => `${formatearNumero(valor, 1)} kg`
    });

    if (grafica) {
        figura.appendChild(grafica);
        seccion.appendChild(figura);
    }

    if (resumen.peso.puntos.length === 1) {
        const nota = document.createElement("p");
        nota.className = "nota-grafica";
        nota.textContent = "Solo hay un registro. La línea mostrará la evolución con el próximo peso guardado.";
        seccion.appendChild(nota);
    }

    const tabla = crearTablaDatos({
        resumen: "Ver datos de peso",
        columnas: ["Fecha", "Peso"],
        filas: resumen.peso.puntos.map((punto) => [
            formatearFecha(punto.fecha),
            `${formatearNumero(punto.valor, 1)} kg`
        ])
    });

    if (tabla) {
        seccion.appendChild(tabla);
    }

    return seccion;
}

function crearMetrica(etiqueta, valor, clase = "") {
    const bloque = document.createElement("div");
    bloque.className = clase ? `metrica-grafica ${clase}` : "metrica-grafica";

    const textoEtiqueta = document.createElement("span");
    textoEtiqueta.textContent = etiqueta;

    const textoValor = document.createElement("strong");
    textoValor.textContent = valor;

    bloque.append(textoEtiqueta, textoValor);
    return bloque;
}

function formatearCambio(valor, unidad) {
    if (!Number.isFinite(valor) || Math.abs(valor) < 0.05) {
        return "Sin cambios";
    }

    return `${valor > 0 ? "+" : "-"}${formatearNumero(Math.abs(valor), 1)} ${unidad}`;
}
