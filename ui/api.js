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
 * @returns {Promise<Object>} Datos de proyección
 */
async function obtenerProyeccion(fechaFutura) {
    const resp = await fetch(`${API_BASE}/proyeccion?fecha=${fechaFutura}`);
    const json = await resp.json();

    if (!json.success) {
        throw new Error(json.error || 'Error al obtener proyección');
    }

    return json.data;
}

/**
 * Obtiene todos los datos necesarios para la UI
 * @param {string} fechaFutura - Fecha futura seleccionada
 * @returns {Promise<{cotizaciones: Array, proyeccion: Object}>}
 */
async function obtenerDatosProyeccion(fechaFutura) {
    const proyeccion = await obtenerProyeccion(fechaFutura);
    return {
        cotizaciones: proyeccion.cotizaciones,
        proyeccion: {
            proyCompra: proyeccion.compraProyectada,
            proyVenta: proyeccion.ventaProyectada,
            diffDias: proyeccion.diffDias,
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
