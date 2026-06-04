import fetch from 'node-fetch';
import { Cotizacion } from './types';
import { RateAdjustService } from './rateAdjust.service';



export class ExchangePojectorService {
  async obtenerCotizacionesUltimoMes(): Promise<Cotizacion[]> {
    // Ejemplo usando la API de series de datos del BCRA / datos.gob.ar
    const monthFrom = new Date();
    monthFrom.setMonth(monthFrom.getMonth() - 12);
    const startDate = monthFrom.toISOString().substring(0, 10); // "YYYY-MM-DD"
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=168.1_T_CAMBIOR_D_0_0_26&start_date=${startDate.substring(0, 7)}&limit=320`;
    // Nota: deberías ajustar ids, el parámetro para compra y venta si existe, etc.

    const resp = await fetch(url);
    const data = await resp.json();
    // Procesar según estructura de la API
    // Aquí suponemos que data tiene array con valores tipo {fecha, valor}, pero necesitarás adaptar según lo que tenga la API

    const cotizaciones: Cotizacion[] = data?.data.map((d: any) => {
      const compra = Array.isArray(d) ? d[1] : d?.valor;
      return {
        fecha: Array.isArray(d) ? d[0] : d.fecha,
        compra, // si es sólo un valor, quizás sea promedio o venta; si tienes ambos, separar
        venta: compra * 1.025 // Ejemplo: asumimos margen del 2% entre venta/compra; ajustar si tienes datos reales
      }
    });

    return cotizaciones;
  }

  calcularTasaDiariaPromedio(cotizaciones: Cotizacion[]): { tasaCompra: number, tasaVenta: number } {
    if (cotizaciones.length < 2) {
      throw new Error("No hay suficientes datos para estimar la tasa");
    }

    let sumaLogsCompra = 0;
    let sumaLogsVenta = 0;
    let conteo = 0;

    for (let i = 1; i < cotizaciones.length; i++) {
      const anterior = cotizaciones[i - 1];
      const actual = cotizaciones[i];

      if (!actual || !anterior) { console.warn("actual or anterior undefined"); continue; }
      const dias = (new Date(actual.fecha).getTime() - new Date(anterior.fecha).getTime()) / (1000 * 60 * 60 * 24);
      if (dias <= 0) continue;

      const factorCompra = actual.compra / anterior.compra;
      const factorVenta = actual.venta / anterior.venta;

      sumaLogsCompra += Math.log(factorCompra) / dias;
      sumaLogsVenta += Math.log(factorVenta) / dias;
      conteo++;
    }

    const tasaCompra = Math.exp(sumaLogsCompra / conteo) - 1;  // tasa diaria promedio
    const tasaVenta = Math.exp(sumaLogsVenta / conteo) - 1;

    return { tasaCompra, tasaVenta };
  }

  determineWithPastDate(cotizaciones: Cotizacion[], fecha: string): { compra: number, venta: number } {
    let aproxCotizacion = cotizaciones.filter(c => c.fecha === fecha)
    if (Array.isArray(aproxCotizacion) && aproxCotizacion.length > 0) {
      return {
        compra: aproxCotizacion[0]?.compra ?? 0,
        venta: aproxCotizacion[0]?.venta ?? 0
      };
    }
    aproxCotizacion = cotizaciones.filter(c => c.fecha?.substring(0, 7) <= fecha)
      ?.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());;
    if (Array.isArray(aproxCotizacion) && aproxCotizacion.length > 0) {
      const ultimaCotizacion = aproxCotizacion[aproxCotizacion.length - 1];
      return {
        compra: ultimaCotizacion?.compra ?? 0,
        venta: ultimaCotizacion?.venta ?? 0
      };
    }

    throw new Error("No se puede determinar la tasa para la fecha dada");
  }

  async proyectarCotizacion(fechaFutura: string): Promise<{ compra: number, venta: number }> {
    const cotizaciones = await this.obtenerCotizacionesUltimoMes();
    const { tasaCompra, tasaVenta } = this.calcularTasaDiariaPromedio(RateAdjustService.getInstance().adjustExchanges(cotizaciones));

    const hoy = new Date();
    const futuro = new Date(fechaFutura);
    const diffDias = (futuro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDias < 0) {
      return this.determineWithPastDate(cotizaciones, fechaFutura);
    }

    // última cotización conocida
    const ultima = cotizaciones[cotizaciones.length - 1];

    if (!ultima) {
      throw new Error("No se pudo obtener la última cotización");
    }
    const proyCompra = ultima.compra * Math.pow(1 + tasaCompra, diffDias);
    const proyVenta = ultima.venta * Math.pow(1 + tasaVenta, diffDias);

    return {
      compra: proyCompra,
      venta: proyVenta
    };
  }
}
