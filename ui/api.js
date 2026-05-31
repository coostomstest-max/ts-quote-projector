/**
 * API Bridge - Conecta la UI con la lógica de servicios
 * Reutiliza la lógica original del proyector de cotizaciones
 */

const API_URL = 'https://apis.datos.gob.ar/series/api/series/?ids=168.1_T_CAMBIOR_D_0_0_26&limit=320';

/**
 * Obtiene cotizaciones del último año desde la API del BCRA
 * @returns {Promise<Array>} Array de cotizaciones {fecha, compra, venta}
 */
async function obtenerCotizaciones() {
    const monthFrom = new Date();
    monthFrom.setFullYear(monthFrom.getFullYear() - 1);
    const startDate = monthFrom.toISOString().substring(0, 10);
    const url = `${API_URL}&start_date=${startDate.substring(0, 7)}`;

    const resp = await fetch(url);
    const data = await resp.json();

    const cotizaciones = data?.data?.map(d => {
        const compra = Array.isArray(d) ? d[1] : d?.valor;
        return {
            fecha: Array.isArray(d) ? d[0] : d.fecha,
            compra,
            venta: compra * 1.025
        };
    }) || [];

    return cotizaciones;
}

/**
 * Calcula la tasa diaria promedio usando logaritmos
 * @param {Array} cotizaciones - Array de cotizaciones
 * @returns {{ tasaCompra: number, tasaVenta: number }}
 */
function calcularTasaDiariaPromedio(cotizaciones) {
    if (cotizaciones.length < 2) {
        throw new Error('No hay suficientes datos para estimar la tasa');
    }

    let sumaLogsCompra = 0;
    let sumaLogsVenta = 0;
    let conteo = 0;

    for (let i = 1; i < cotizaciones.length; i++) {
        const anterior = cotizaciones[i - 1];
        const actual = cotizaciones[i];

        if (!actual || !anterior) continue;
        const dias = (new Date(actual.fecha).getTime() - new Date(anterior.fecha).getTime()) / (1000 * 60 * 60 * 24);
        if (dias <= 0) continue;

        const factorCompra = actual.compra / anterior.compra;
        const factorVenta = actual.venta / anterior.venta;

        sumaLogsCompra += Math.log(factorCompra) / dias;
        sumaLogsVenta += Math.log(factorVenta) / dias;
        conteo++;
    }

    const tasaCompra = Math.exp(sumaLogsCompra / conteo) - 1;
    const tasaVenta = Math.exp(sumaLogsVenta / conteo) - 1;

    return { tasaCompra, tasaVenta };
}

/**
 * Proyecta la cotización para una fecha futura
 * @param {Array} cotizaciones - Array de cotizaciones históricas
 * @param {string} fechaFutura - Fecha futura en formato YYYY-MM-DD
 * @returns {{ proyCompra: number, proyVenta: number, diffDias: number, ultima: Object }}
 */
function calcularProyeccion(cotizaciones, fechaFutura) {
    const { tasaCompra, tasaVenta } = calcularTasaDiariaPromedio(cotizaciones);

    const hoy = new Date();
    const futuro = new Date(fechaFutura);
    const diffDias = (futuro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDias < 0) {
        throw new Error('La fecha futura debe ser posterior al día de hoy');
    }

    const ultima = cotizaciones[cotizaciones.length - 1];
    if (!ultima) {
        throw new Error('No se pudo obtener la última cotización');
    }

    const proyCompra = ultima.compra * Math.pow(1 + tasaCompra, diffDias);
    const proyVenta = ultima.venta * Math.pow(1 + tasaVenta, diffDias);

    return {
        proyCompra,
        proyVenta,
        diffDias,
        ultima
    };
}

/**
 * Obtiene todos los datos necesarios para la UI
 * @param {string} fechaFutura - Fecha futura seleccionada
 * @returns {Promise<{cotizaciones: Array, proyeccion: Object}>}
 */
async function obtenerDatosProyeccion(fechaFutura) {
    const cotizaciones = await obtenerCotizaciones();
    const proyeccion = calcularProyeccion(cotizaciones, fechaFutura);
    return { cotizaciones, proyeccion };
}

// Exportar funciones
export {
    obtenerCotizaciones,
    calcularTasaDiariaPromedio,
    calcularProyeccion,
    obtenerDatosProyeccion
};
