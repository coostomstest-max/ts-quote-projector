/**
 * API Bridge - Cliente que consume el endpoint TypeScript
 * Solo hace fetch, no contiene lógica de negocio
 */

const API_BASE = 'http://localhost:3001/api';

/**
 * Obtiene cotizaciones históricas del servidor
 * @returns {Promise<Array>} Array de cotizaciones
 */
async function obtenerCotizaciones() {
    const resp = await fetch(`${API_BASE}/cotizaciones`);
    const json = await resp.json();

    if (!json.success) {
        throw new Error(json.error || 'Error al obtener cotizaciones');
    }

    return json.data;
}

/**
 * Obtiene proyección para una fecha futura
 * @param {string} fechaFutura - Fecha en formato YYYY-MM-DD
 * @param {string} algoritmo - Algoritmo: 'ses' o 'crecimiento_compuesto'
 * @returns {Promise<Object>} Datos de proyección
 */
async function obtenerProyeccion(fechaFutura, algoritmo = 'ses') {
    const resp = await fetch(`${API_BASE}/proyeccion?fecha=${fechaFutura}&algoritmo=${algoritmo}`);
    const json = await resp.json();

    if (!json.success) {
        throw new Error(json.error || 'Error al obtener proyección');
    }

    return json.data;
}

/**
 * Obtiene todos los datos necesarios para la UI
 * @param {string} fechaFutura - Fecha futura seleccionada
 * @param {string} algoritmo - Algoritmo: 'ses' o 'crecimiento_compuesto'
 * @returns {Promise<{cotizaciones: Array, proyeccion: Object}>}
 */
async function obtenerDatosProyeccion(fechaFutura, algoritmo = 'ses') {
    const proyeccion = await obtenerProyeccion(fechaFutura, algoritmo);
    return {
        cotizaciones: proyeccion.cotizaciones,
        proyeccion: {
            proyCompra: proyeccion.compraProyectada,
            proyVenta: proyeccion.ventaProyectada,
            diffDias: proyeccion.diffDias,
            secuenciaCompra: proyeccion.secuenciaCompra || [],
            secuenciaVenta: proyeccion.secuenciaVenta || [],
            interval: proyeccion.intervalo || 1,
            dias: proyeccion.dias || 0,
            ultima: {
                fecha: proyeccion.fechaActual,
                compra: proyeccion.compraActual,
                venta: proyeccion.ventaActual
            }
        }
    };
}

// Exportar funciones
export {
    obtenerCotizaciones,
    obtenerProyeccion,
    obtenerDatosProyeccion
};
