import express from 'express';
import cors from 'cors';
import { ExchangePojectorService } from '../src/service/exchProjector.basic.service';
import { RateAdjustService } from '../src/service/rateAdjust.service';

const app = express();
const PORT = process.env.PORT || 3001;

const projector = new ExchangePojectorService();
const rateAdjust = RateAdjustService.getInstance();

app.use(cors());
app.use(express.json());

/**
 * GET /api/cotizaciones
 * Obtiene cotizaciones históricas del último año
 */
app.get('/api/cotizaciones', async (_req, res) => {
    try {
        const cotizaciones = await projector.obtenerCotizacionesUltimoMes();
        const ajustadas = rateAdjust.adjustExchanges(cotizaciones);
        res.json({
            success: true,
            data: ajustadas
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});

/**
 * GET /api/proyeccion?fecha=YYYY-MM-DD&algoritmo=ses|crecimiento_compuesto
 * Proyecta cotización para una fecha futura
 */
app.get('/api/proyeccion', async (req, res) => {
    try {
        const { fecha, algoritmo } = req.query;

        if (!fecha || typeof fecha !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Parámetro "fecha" es requerido (YYYY-MM-DD)'
            });
            return;
        }

        const cotizaciones = await projector.obtenerCotizacionesUltimoMes();
        const cotizacionesAjustadas = rateAdjust.adjustExchanges(cotizaciones);

        const ultima = cotizacionesAjustadas[cotizacionesAjustadas.length - 1];
        if (!ultima) {
            res.status(500).json({
                success: false,
                error: 'No se pudo obtener la última cotización'
            });
            return;
        }

        const algo = (typeof algoritmo === 'string' && (algoritmo === 'ses' || algoritmo === 'crecimiento_compuesto' || algoritmo === 'spline_monotono'))
            ? algoritmo : 'ses';

        const resultado = await projector.proyectarCotizacion(fecha, algo);
        const compraProyectada = resultado.compra;
        const ventaProyectada = resultado.venta;
        const secuenciaCompra = resultado.secuenciaCompra;
        const secuenciaVenta = resultado.secuenciaVenta;
        const intervalo = resultado.intervalo;
        const dias = resultado.dias;

        const hoy = new Date();
        const futuro = new Date(fecha);
        const diffDias = (futuro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);

        res.json({
            success: true,
            data: {
                fechaActual: ultima.fecha,
                fechaFutura: fecha,
                compraActual: ultima.compra,
                ventaActual: ultima.venta,
                compraProyectada,
                ventaProyectada,
                secuenciaCompra,
                secuenciaVenta,
                dias,
                diffDias: Math.round(diffDias),
                variacionPorcentual: ((compraProyectada - ultima.compra) / ultima.compra) * 100,
                cotizaciones: cotizacionesAjustadas,
                algoritmo: algo
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});

/**
 * GET /api/proyeccion?fecha=YYYY-MM-DD
 * Proyecta cotización para una fecha futura
 */
app.get('/api/proyeccion/experimental', async (req, res) => {
    try {
        const { fecha } = req.query;

        if (!fecha || typeof fecha !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Parámetro "fecha" es requerido (YYYY-MM-DD)'
            });
            return;
        }

        const cotizaciones = await projector.obtenerCotizacionesUltimoMes();
        const cotizacionesAjustadas = rateAdjust.adjustExchanges(cotizaciones);

        const hoy = new Date();
        const futuro = new Date(fecha);
        const diffDias = (futuro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);



        const ultima = cotizacionesAjustadas[cotizacionesAjustadas.length - 1];
        if (!ultima) {
            res.status(500).json({
                success: false,
                error: 'No se pudo obtener la última cotización'
            });
            return;
        }

        const { compra, venta } = await projector.proyectarCotizacion(fecha);

        res.json({
            success: true,
            data: {
                fechaActual: ultima.fecha,
                fechaFutura: fecha,
                compraActual: ultima.compra,
                ventaActual: ultima.venta,
                compraProyectada: compra,
                ventaProyectada: venta,
                diffDias: Math.round(diffDias),
                variacionPorcentual: Math.abs((venta - ultima.compra) / ultima.compra) * 100,
                cotizaciones: cotizacionesAjustadas
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`   GET /api/cotizaciones - Lista de cotizaciones históricas`);
    console.log(`   GET /api/proyeccion?fecha=YYYY-MM-DD - Proyección para fecha futura`);
});
