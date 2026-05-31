import express from 'express';
import cors from 'cors';
import { ExchangePojectorService } from '../src/service/exchProjector.basic.sercice';
import { RateAdjustService } from '../src/service/rateAdjust.service';

const app = express();
const PORT = process.env.PORT || 3000;

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
 * GET /api/proyeccion?fecha=YYYY-MM-DD
 * Proyecta cotización para una fecha futura
 */
app.get('/api/proyeccion', async (req, res) => {
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
        const { tasaCompra, tasaVenta } = projector.calcularTasaDiariaPromedio(cotizacionesAjustadas);

        const hoy = new Date();
        const futuro = new Date(fecha);
        const diffDias = (futuro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDias < 0) {
            res.status(400).json({
                success: false,
                error: 'La fecha futura debe ser posterior al día de hoy'
            });
            return;
        }

        const ultima = cotizacionesAjustadas[cotizacionesAjustadas.length - 1];
        if (!ultima) {
            res.status(500).json({
                success: false,
                error: 'No se pudo obtener la última cotización'
            });
            return;
        }

        const proyCompra = ultima.compra * Math.pow(1 + tasaCompra, diffDias);
        const proyVenta = ultima.venta * Math.pow(1 + tasaVenta, diffDias);

        res.json({
            success: true,
            data: {
                fechaActual: ultima.fecha,
                fechaFutura: fecha,
                compraActual: ultima.compra,
                ventaActual: ultima.venta,
                compraProyectada: proyCompra,
                ventaProyectada: proyVenta,
                diffDias: Math.round(diffDias),
                variacionPorcentual: ((proyCompra - ultima.compra) / ultima.compra) * 100,
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
