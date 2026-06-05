# [Wiki] Extensión de Modelos de Proyección: Suavizado Exponencial Simple (SES)

## 📋 Descripción General
El **Suavizado Exponencial Simple (SES)** es un algoritmo de pronóstico de series de tiempo que asigna ponderaciones exponencialmente decrecientes a las observaciones pasadas. A diferencia de los promedios móviles simples donde todos los datos históricos tienen el mismo peso, el SES prioriza los datos más recientes regulado por un factor de amortiguación llamado Alfa (α).

Este método se integra al sistema actual como una alternativa no lineal y robusta frente al ruido de mercado, ideal para activos financieros sin una tendencia marcada a largo plazo o para análisis de soporte/resistencia dinámicos.

---

## 📐 Especificación Matemática

El modelo se define por la siguiente relación de recurrencia:

\[\hat{Y}_{t+1} = \alpha Y_t + (1 - \alpha) \hat{Y}_t\]

Donde:
* **\(\hat{Y}_{t+1}\)**: Pronóstico o valor suavizado para el período siguiente.
* **\(Y_t\)**: Valor real observado en el período actual.
* **\(\hat{Y}_t\)**: Pronóstico o valor suavizado calculado para el período actual.
* **α (Alfa)**: Parámetro de suavizado (0 < α ≤ 1).

### 📌 Inicialización de la serie
Dado que el cálculo es recursivo, el primer valor de la serie suavizada se inicializa con el primer valor real de los datos:
\[\hat{Y}_1 = Y_1\]

---

## 🛠️ Requerimiento Técnico (Prompt / Task para la IA)

```text
TASK: Implementar el método de Suavizado Exponencial Simple (SES) en el módulo de cálculo de proyecciones actual.

CONTEXTO DE NEGOCIO:
El sistema requiere calcular curvas suavizadas históricas y la predicción del siguiente período (t+1) para series temporales de cotizaciones financieras.

ESPECIFICACIONES DEL ENFOQUE (Elegir según el stack tecnológico del archivo a modificar):

Si la implementación es en PYTHON:
1. El método debe aceptar un array, lista o Pandas Series de precios ('data') y un float 'alpha' (por defecto 0.3).
2. Opcional/Recomendado: Incluir un parámetro booleano 'optimize'. Si es True, utilizar `statsmodels.tsa.api.SimpleExpSmoothing` con `optimized=True` para ajustar automáticamente el alfa óptimo basado en la minimización del MSE histórico.
3. El retorno debe ser un objeto/diccionario con la serie histórica calculada y el float del valor futuro 'forecast_t_plus_1'.

Si la implementación es en JAVASCRIPT / TYPESCRIPT:
1. Crear una función pura `calcularSuavizadoExponencial(precios: number[], alfa: number = 0.3)`.
2. Validar que la longitud del array sea > 0 y que el alfa se encuentre estrictamente en el rango (0, 1].
3. Iterar la serie basándose en la fórmula: suavizados[i] = (alfa * precios[i - 1]) + ((1 - alfa) * suavizados[i - 1]).
4. Retornar un objeto estructurado: { historial: number[], prediccionSiguiente: number }.

CRITERIOS DE ACEPTACIÓN:
- No debe alterar ni mutar los arreglos o dataframes de precios originales de entrada.
- El script debe manejar la inicialización del primer elemento correctamente (suavizado = precio).
- Todos los cálculos numéricos de salida flotante deben mantener la precisión nativa del lenguaje (se recomienda no redondear dentro del bucle para evitar propagación de errores).
```

---

## 📊 Casos de Prueba para Validación (Test Cases)

Para verificar que la IA implementó el algoritmo correctamente, se deben usar los siguientes datos de control:

* **Entrada (`precios`)**: `[10, 10, 12, 11, 14, 13]`
* **Parámetro (`alpha`)**: `0.3`

### Resultados Esperados en el Historial Suavizado ($t$):
1. $\hat{Y}_1$ = **10.00** *(Inicialización)*
2. $\hat{Y}_2$ = $(0.3 \times 10) + (0.7 \times 10)$ = **10.00**
3. $\hat{Y}_3$ = $(0.3 \times 12) + (0.7 \times 10)$ = **10.60**
4. $\hat{Y}_4$ = $(0.3 \times 11) + (0.7 \times 10.60)$ = **10.72**
5. $\hat{Y}_5$ = $(0.3 \times 14) + (0.7 \times 10.72)$ = **11.704**

### Predicción para el periodo siguiente ($t+1$):
* $\hat{Y}_{t+1}$ = $(0.3 \times 13) + (0.7 \times 11.704)$ = **12.0928**
