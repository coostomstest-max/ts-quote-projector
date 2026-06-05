import fetch from 'node-fetch';
import { Cotizacion } from './types';
import { RateAdjustService } from './rateAdjust.service';
import { InterpolationService } from './interpolation.service';

export type AlgoritmoProyeccion = 'ses' | 'crecimiento_compuesto' | 'spline_monotono';

export class ExchangePojectorService {
  private interpolationService: InterpolationService;

  constructor(interpolationService?: InterpolationService) {
    this.interpolationService = interpolationService ?? new InterpolationService();
  }

  /**
   * Obtiene o proyecta una cotización para una fecha específica.
   * Si la fecha existe en el historial, retorna sus valores reales directamente.
   * Si no existe, aplica el algoritmo de proyección seleccionado sobre los datos históricos
   * anteriores o iguales a la fecha objetivo.
   * 
   * @param historial - Array de Cotizacion (no mutado).
   * @param fechaObjetivo - Fecha a consultar/proyectar en formato ISO ("YYYY-MM-DD").
   * @param algoritmo - Algoritmo a utilizar: 'ses' (default) o 'crecimiento_compuesto'.
   * @returns Objeto con compra y venta proyectados.
   */
  private obtenerOProyectarCotizacion(
    historial: Cotizacion[],
    fechaObjetivo: string,
    algoritmo: AlgoritmoProyeccion = 'ses'
  ): { compra: number; venta: number } {
    // 1. Ordenar historial por fecha ascendente (copia para no mutar el original)
    const historialOrdenado = [...historial].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    // 2. Buscar coincidencia exacta de fecha
    const matchExacto = historialOrdenado.find(c => c.fecha === fechaObjetivo);
    if (matchExacto) {
      return { compra: matchExacto.compra, venta: matchExacto.venta };
    }

    // 3. Filtrar solo cotizaciones con fecha ANTERIOR o IGUAL a la fecha objetivo
    const historialFiltrado = historialOrdenado.filter(
      c => c.fecha <= fechaObjetivo
    );

    // 4. Si no hay datos históricos, no se puede proyectar
    if (historialFiltrado.length === 0) {
      throw new Error('No hay datos históricos anteriores o iguales a la fecha objetivo para proyectar');
    }

    // 5. Extraer vectores numéricos
    const compras = historialFiltrado.map(c => c.compra);
    const ventas = historialFiltrado.map(c => c.venta);

    // 6. Aplicar algoritmo seleccionado
    let resultadoCompra: number;
    let resultadoVenta: number;

    if (algoritmo === 'crecimiento_compuesto') {
      resultadoCompra = this.interpolationService.calcularCrecimientoCompuesto(compras);
      resultadoVenta = this.interpolationService.calcularCrecimientoCompuesto(ventas);
    } else if (algoritmo === 'spline_monotono') {
      resultadoCompra = this.interpolationService.calcularSplineMonotono(compras);
      resultadoVenta = this.interpolationService.calcularSplineMonotono(ventas);
    } else {
      // Default: SES
      resultadoCompra = this.interpolationService.calcularSES(compras, 0.3);
      resultadoVenta = this.interpolationService.calcularSES(ventas, 0.3);
    }

    return { compra: resultadoCompra, venta: resultadoVenta };
  }

  async obtenerCotizacionesUltimoMes(): Promise<Cotizacion[]> {
    // Ejemplo usando la API de series de datos del BCRA / datos.gob.ar
    const monthFrom = new Date();
    monthFrom.setMonth(monthFrom.getMonth() - 12);
    const startDate = monthFrom.toISOString().substring(0, 10); // "YYYY-MM-DD"
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=168.1_T_CAMBIOR_D_0_0_26&start_date=${startDate.substring(0, 7)}&limit=320`;

    const resp = await fetch(url);
    const data = await resp.json();

    const cotizaciones: Cotizacion[] = data?.data.map((d: any) => {
      const compra = Array.isArray(d) ? d[1] : d?.valor;
      return {
        fecha: Array.isArray(d) ? d[0] : d.fecha,
        compra,
        venta: compra * 1.025
      }
    });

    const dolarApiUri='https://dolarapi.com/v1/dolares/oficial'
    try {      const respDolarApi = await fetch(dolarApiUri);
      const dataDolarApi = await respDolarApi.json();
      if (dataDolarApi?.compra && dataDolarApi?.venta) {
        cotizaciones.push({
          fecha: new Date().toISOString().substring(0, 10),
          compra: dataDolarApi.compra,
          venta: dataDolarApi.venta
        });
      }
    } catch (error) {
      console.warn('No se pudo obtener cotización actualizada de DolarAPI:', error instanceof Error ? error.message : error);
    }

    return cotizaciones;
  }

  /**
   * Proyecta una cotización para una fecha futura usando el algoritmo indicado.
   * Es el método público principal que orquesta el flujo.
   * 
   * @param fechaFutura - Fecha objetivo en formato ISO ("YYYY-MM-DD").
   * @param algoritmo - Algoritmo a utilizar: 'ses' (default), 'crecimiento_compuesto' o 'spline_monotono'.
   * @returns Objeto con compra, venta proyectados y secuencias diarias.
   */
  async proyectarCotizacion(fechaFutura: string, algoritmo: AlgoritmoProyeccion = 'ses'): Promise<{
    compra: number;
    venta: number;
    secuenciaCompra: number[];
    secuenciaVenta: number[];
    intervalo: number;
    dias: number;
  }> {
    const cotizaciones = await this.obtenerCotizacionesUltimoMes();
    const cotizacionesAjustadas = RateAdjustService.getInstance().adjustExchanges(cotizaciones);

    const historialOrdenado = [...cotizacionesAjustadas].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    // Última fecha real disponible
    const ultimaFechaReal = historialOrdenado[historialOrdenado.length - 1]!.fecha;
    const ultimaDate = new Date(ultimaFechaReal);
    const objetivoDate = new Date(fechaFutura);
    const diffMs = objetivoDate.getTime() - ultimaDate.getTime();
    const pasos = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    // Extraer vectores históricos
    const comprasHist = historialOrdenado.map(c => c.compra);
    const ventasHist = historialOrdenado.map(c => c.venta);

    if (pasos <= 0) {
      // Fecha igual o anterior a la última real → usar búsqueda directa
      const resultado = this.obtenerOProyectarCotizacion(cotizacionesAjustadas, fechaFutura, algoritmo);
      return { ...resultado, secuenciaCompra: [], secuenciaVenta: [], intervalo: 0, dias: 0 };
    }

    // Generar secuencias diarias iterativas optimizadas (submuestreo)
    const optCompra = this.interpolationService.calcularSecuenciaProyeccionOptimizada(comprasHist, pasos, algoritmo, 0.3);
    const optVenta = this.interpolationService.calcularSecuenciaProyeccionOptimizada(ventasHist, pasos, algoritmo, 0.3);

    return {
      compra: optCompra.secuencia[optCompra.secuencia.length - 1]!,
      venta: optVenta.secuencia[optVenta.secuencia.length - 1]!,
      secuenciaCompra: optCompra.secuencia,
      secuenciaVenta: optVenta.secuencia,
      intervalo: optCompra.intervalo,
      dias: pasos
    };
  }
}