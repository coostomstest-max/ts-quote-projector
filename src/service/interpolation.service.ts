export class InterpolationService {

  /**
   * Calcula la predicción del siguiente paso (t+1) usando Suavizado Exponencial Simple (SES).
   */
  calcularSES(datos: number[], alpha: number = 0.3): number {
    if (datos.length === 0) throw new Error('El array de datos no puede estar vacío');
    if (datos.length === 1) return datos[0]!;

    let prediccion = datos[0]!; // Ŷ_1 = Y_1
    for (let i = 1; i < datos.length; i++) {
      prediccion = alpha * datos[i]! + (1 - alpha) * prediccion;
    }
    return prediccion;
  }

  /**
   * Calcula la proyección del siguiente valor usando Spline Cúbico Monotónico (Steffen)
   * con extrapolación acotada.
   * 
   * Para la extrapolación, en lugar de extender la derivada linealmente (que crece sin cota),
   * calcula la tasa de crecimiento promedio ponderada de los últimos segmentos observados
   * (con mayor peso a los más recientes) y la aplica multiplicativamente.
   * 
   * Esto evita valores explosivos en proyecciones lejanas y mantiene coherencia con la serie.
   */
  calcularSplineMonotono(datos: number[]): number {
    if (datos.length === 0) throw new Error('El array de datos no puede estar vacío');
    if (datos.length === 1) return datos[0]!;
    if (datos.length === 2) {
      // Con solo 2 puntos, la tasa de cambio entre ellos es la mejor estimación
      return datos[1]! * (datos[1]! / datos[0]!);
    }

    const n = datos.length;
    const delta: number[] = [];

    // 1. Diferencias divididas (delta como factor relativo para acotar)
    for (let i = 0; i < n - 1; i++) {
      delta.push(datos[i + 1]! / datos[i]!);
    }

    // 2. Promedio ponderado de los últimos factores de crecimiento
    //    (más peso a los más recientes)
    const pesos: number[] = [];
    let sumaPesos = 0;
    for (let i = 0; i < delta.length; i++) {
      const peso = i + 1; // peso lineal creciente
      pesos.push(peso);
      sumaPesos += peso;
    }

    let factorPromedio = 0;
    for (let i = 0; i < delta.length; i++) {
      factorPromedio += (pesos[i]! / sumaPesos) * delta[i]!;
    }

    // 3. Aplicar el factor multiplicativamente al último valor conocido
    return datos[n - 1]! * factorPromedio;
  }

  /**
   * Calcula la proyección del siguiente valor usando crecimiento compuesto logarítmico.
   */
  calcularCrecimientoCompuesto(datos: number[]): number {
    if (datos.length === 0) throw new Error('El array de datos no puede estar vacío');
    if (datos.length === 1) return datos[0]!;

    let sumaLogs = 0;
    let conteo = 0;
    for (let i = 1; i < datos.length; i++) {
      const factor = datos[i]! / datos[i - 1]!;
      sumaLogs += Math.log(factor);
      conteo++;
    }
    const tasa = Math.exp(sumaLogs / conteo) - 1;
    return datos[datos.length - 1]! * (1 + tasa);
  }

  /**
   * Determina el paso de submuestreo óptimo según la cantidad de días proyectados.
   * - Si pasos%3===0 → paso = pasos/3 (3 puntos generados)
   * - Si pasos%5===0 → paso = pasos/5 (5 puntos generados)
   * - Si pasos%4===0 → paso = pasos/4 (4 puntos generados)
   * - default → paso = max(1, pasos/2) (2 puntos generados)
   */
  private calcularPasoSubmuestreo(pasos: number): number {
    if (pasos % 3 === 0) return Math.max(1, Math.floor(pasos / 3));
    if (pasos % 5 === 0) return Math.max(1, Math.floor(pasos / 5));
    if (pasos % 4 === 0) return Math.max(1, Math.floor(pasos / 4));
    return Math.max(1, Math.floor(pasos / 2));
  }

  /**
   * Computa una secuencia de proyecciones diarias iterativas,
   * submuestreada para optimizar la cantidad de puntos generados.
   * 
   * Internamente genera TODOS los pasos diarios (necesario para la realimentación
   * del algoritmo), pero solo retorna los puntos en el intervalo de submuestreo.
   * 
   * @param datos - Array de valores históricos (no mutado).
   * @param pasos - Cantidad de días a proyectar.
   * @param tipo - Tipo de algoritmo.
   * @param alpha - Factor alpha solo para SES.
   * @returns { secuencia: number[], intervalo: number } - Puntos submuestreados + paso usado.
   */
  calcularSecuenciaProyeccionOptimizada(
    datos: number[],
    pasos: number,
    tipo: 'ses' | 'spline_monotono' | 'crecimiento_compuesto' = 'ses',
    alpha: number = 0.3
  ): { secuencia: number[]; intervalo: number } {
    if (datos.length === 0) throw new Error('El array de datos no puede estar vacío');
    if (pasos <= 0) return { secuencia: [], intervalo: 1 };

    let fnProyectar: (d: number[]) => number;
    switch (tipo) {
      case 'crecimiento_compuesto':
        fnProyectar = (d) => this.calcularCrecimientoCompuesto(d);
        break;
      case 'spline_monotono':
        fnProyectar = (d) => this.calcularSplineMonotono(d);
        break;
      default:
        fnProyectar = (d) => this.calcularSES(d, alpha);
        break;
    }

    const intervalo = this.calcularPasoSubmuestreo(pasos);
    const datosTrabajo = [...datos];
    const resultado: number[] = [];

    for (let i = 0; i < pasos; i++) {
      const proyeccion = fnProyectar(datosTrabajo);
      datosTrabajo.push(proyeccion);
      // Solo guardar si estamos en un paso de submuestreo o es el último
      if ((i + 1) % intervalo === 0 || i === pasos - 1) {
        resultado.push(proyeccion);
      }
    }

    return { secuencia: resultado, intervalo };
  }

  /**
   * Computa una secuencia de proyecciones diarias iterativas.
   * 
   * En cada paso: aplica el algoritmo a los datos actuales, agrega el resultado
   * al array de trabajo y repite. Así cada día se basa en la proyección del día anterior.
   * 
   * @param datos - Array de valores históricos (no mutado).
   * @param pasos - Cantidad de días a proyectar.
   * @param tipo - Tipo de algoritmo: 'ses', 'spline_monotono', o 'crecimiento_compuesto'.
   * @param alpha - Factor alpha solo para SES (default 0.3).
   * @returns Array con las proyecciones diarias (longitud = pasos).
   */
  calcularSecuenciaProyeccion(
    datos: number[],
    pasos: number,
    tipo: 'ses' | 'spline_monotono' | 'crecimiento_compuesto' = 'ses',
    alpha: number = 0.3
  ): number[] {
    if (datos.length === 0) throw new Error('El array de datos no puede estar vacío');
    if (pasos <= 0) return [];

    // Seleccionar la función de proyección según el tipo
    let fnProyectar: (d: number[]) => number;
    switch (tipo) {
      case 'crecimiento_compuesto':
        fnProyectar = (d) => this.calcularCrecimientoCompuesto(d);
        break;
      case 'spline_monotono':
        fnProyectar = (d) => this.calcularSplineMonotono(d);
        break;
      default: // 'ses'
        fnProyectar = (d) => this.calcularSES(d, alpha);
        break;
    }

    // Trabajar sobre una copia para no mutar el original
    const datosTrabajo = [...datos];
    const resultado: number[] = [];

    for (let i = 0; i < pasos; i++) {
      const proyeccion = fnProyectar(datosTrabajo);
      resultado.push(proyeccion);
      datosTrabajo.push(proyeccion); // realimentar para el próximo paso
    }

    return resultado;
  }
}