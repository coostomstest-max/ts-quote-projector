/**
 * App - Lógica de la interfaz de usuario
 * Maneja el gráfico con zoom, scrollbar, tooltips y todos los puntos visibles
 */

import { obtenerDatosProyeccion } from './api.js';

// Referencias DOM
let elements = {};
let chartData = {
    cotizaciones: [],
    proyeccion: null
};

// Estado de la vista
let viewState = {
    dataMin: null,      // límite absoluto mínimo (ms)
    dataMax: null,      // límite absoluto máximo (ms)
    viewStart: null,    // inicio de la ventana visible (ms)
    viewEnd: null,      // fin de la ventana visible (ms)
    totalRange: 0,
    viewRange: 0
};

// Cache de todos los puntos (fecha ms, valor, tipo)
let allPointsCache = [];

/**
 * Inicializa la aplicación
 */
function init() {
    cacheElements();
    setupDatePicker();
    setupStrategySelector();
    setupZoomControls();
    setupTimelineScrollbar();
    setupChartMouseEvents();
    loadInitialData();
}

/**
 * Obtiene referencias a elementos del DOM
 */
function cacheElements() {
    elements = {
        datePicker: document.getElementById('datePicker'),
        strategySelect: document.getElementById('strategySelect'),
        currentValue: document.getElementById('currentValue'),
        projectedValue: document.getElementById('projectedValue'),
        difference: document.getElementById('difference'),
        daysUntil: document.getElementById('daysUntil'),
        chartWrapper: document.getElementById('chartWrapper'),
        chart: document.getElementById('chart'),
        timelineSlider: document.getElementById('timelineSlider'),
        tooltip: document.getElementById('chartTooltip'),
        zoomBtns: document.querySelectorAll('.zoom-btn[data-range]'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn')
    };
}

/**
 * Obtiene la estrategia seleccionada actualmente
 */
function getEstrategia() {
    return elements.strategySelect ? elements.strategySelect.value : 'ses';
}

/**
 * Configura el selector de fecha
 */
function setupDatePicker() {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    elements.datePicker.max = formatDate(maxDate);
    elements.datePicker.value = formatDate(today);
    elements.datePicker.addEventListener('change', handleDateChange);
}

/**
 * Configura el selector de estrategia
 */
function setupStrategySelector() {
    if (elements.strategySelect) {
        elements.strategySelect.addEventListener('change', handleStrategyChange);
    }
}

function setupZoomControls() {
    // Botones de rango rápido
    elements.zoomBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.zoomBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyZoomRange(btn.dataset.range);
        });
    });

    // Zoom in / out
    if (elements.zoomInBtn) {
        elements.zoomInBtn.addEventListener('click', () => zoomStep(1.5));
    }
    if (elements.zoomOutBtn) {
        elements.zoomOutBtn.addEventListener('click', () => zoomStep(0.666));
    }
}

/**
 * Aplica un rango de zoom predefinido
 */
function applyZoomRange(range) {
    if (!viewState.dataMin || !viewState.dataMax) return;

    const now = new Date().getTime();
    let viewEnd = viewState.dataMax;
    let viewStart;

    switch (range) {
        case '1m':
            viewStart = now - 30 * 24 * 60 * 60 * 1000;
            break;
        case '3m':
            viewStart = now - 90 * 24 * 60 * 60 * 1000;
            break;
        case '6m':
            viewStart = now - 180 * 24 * 60 * 60 * 1000;
            break;
        case '1y':
            viewStart = now - 365 * 24 * 60 * 60 * 1000;
            break;
        case 'all':
        default:
            viewStart = viewState.dataMin;
            break;
    }

    viewState.viewStart = Math.max(viewState.dataMin, viewStart);
    viewState.viewEnd = Math.min(viewState.dataMax, viewEnd);
    syncSliderFromView();
    redrawChart();
}

/**
 * Zoom in/out centrado en el punto medio actual
 */
function zoomStep(factor) {
    if (!viewState.viewStart || !viewState.viewEnd) return;
    const center = (viewState.viewStart + viewState.viewEnd) / 2;
    const halfRange = ((viewState.viewEnd - viewState.viewStart) / factor) / 2;
    const newStart = Math.max(viewState.dataMin, center - halfRange);
    const newEnd = Math.min(viewState.dataMax, center + halfRange);
    viewState.viewStart = newStart;
    viewState.viewEnd = newEnd;
    syncSliderFromView();
    redrawChart();
}

/**
 * Configura el slider de timeline
 */
function setupTimelineScrollbar() {
    if (elements.timelineSlider) {
        elements.timelineSlider.addEventListener('input', handleSliderChange);
    }
}

/**
 * Maneja el cambio en el slider
 */
function handleSliderChange() {
    if (!viewState.dataMin || !viewState.dataMax) return;
    const ratio = parseInt(elements.timelineSlider.value) / 1000;
    const viewRange = viewState.viewEnd - viewState.viewStart;
    const maxScroll = viewState.dataMax - viewState.dataMin - viewRange;
    if (maxScroll <= 0) return;
    const scrollPos = maxScroll * ratio;
    viewState.viewStart = viewState.dataMin + scrollPos;
    viewState.viewEnd = viewState.viewStart + viewRange;
    redrawChart();
}

/**
 * Sincroniza el slider con la ventana de vista actual
 */
function syncSliderFromView() {
    if (!elements.timelineSlider) return;
    if (!viewState.dataMin || !viewState.dataMax) return;
    const viewRange = viewState.viewEnd - viewState.viewStart;
    const maxScroll = viewState.dataMax - viewState.dataMin - viewRange;
    if (maxScroll <= 0) {
        elements.timelineSlider.value = 0;
        return;
    }
    const scrollPos = viewState.viewStart - viewState.dataMin;
    const ratio = scrollPos / maxScroll;
    elements.timelineSlider.value = Math.round(ratio * 1000);
}

/**
 * Configura eventos de mouse para tooltips en el chart
 */
function setupChartMouseEvents() {
    const canvas = elements.chart;
    if (!canvas) return;

    canvas.addEventListener('mousemove', handleChartMouseMove);
    canvas.addEventListener('mouseleave', () => {
        if (elements.tooltip) elements.tooltip.style.display = 'none';
    });
}

/**
 * Busca el punto más cercano bajo el cursor y muestra tooltip
 */
function handleChartMouseMove(event) {
    if (!elements.tooltip || !allPointsCache.length) return;
    if (!viewState.viewStart || !viewState.viewEnd) return;

    const rect = elements.chart.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const padding = { top: 30, right: 50, bottom: 50, left: 70 };
    const canvas = elements.chart;
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width * dpr;
    const height = rect.height * dpr;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Solo consultar si está dentro del área del gráfico (coordenadas CSS / lógicas)
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;
    if (mouseX < padding.left || mouseX > (logicalWidth - padding.right) ||
        mouseY < padding.top || mouseY > (logicalHeight - padding.bottom)) {
        elements.tooltip.style.display = 'none';
        return;
    }

    // Escala inversa (mouseX, mouseY están en coordenadas lógicas CSS)
    const chartLogicalWidth = logicalWidth - padding.left - padding.right;
    const dateAtMouse = viewState.viewStart + ((mouseX - padding.left) / chartLogicalWidth) * (viewState.viewEnd - viewState.viewStart);

    // Encontrar punto más cercano
    let closest = null;
    let minDist = Infinity;
    for (const p of allPointsCache) {
        const dist = Math.abs(p.date - dateAtMouse);
        if (dist < minDist) {
            minDist = dist;
            closest = p;
        }
    }

    if (closest && minDist < (viewState.viewEnd - viewState.viewStart) * 0.02) {
        const label = closest.isProjected ? 'Proyectado' : 'Histórico';
        const fecha = new Date(closest.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        elements.tooltip.innerHTML = `
            <div class="tooltip-date">${fecha} · ${label}</div>
            <div class="tooltip-value">$${closest.value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        `;
        elements.tooltip.style.display = 'block';
        elements.tooltip.style.left = (event.clientX - rect.left + 15) + 'px';
        elements.tooltip.style.top = (event.clientY - rect.top - 40) + 'px';
    } else {
        elements.tooltip.style.display = 'none';
    }
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Construye fechas proyectadas
 */
function buildProjectedDates(lastRealDate, targetDate, count) {
    const dates = [];
    const start = new Date(lastRealDate);
    for (let i = 1; i <= count; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/**
 * Maneja el cambio de fecha
 */
async function handleDateChange() {
    const fechaFutura = elements.datePicker.value;
    if (!fechaFutura) return;
    showLoading();
    try {
        const algoritmo = getEstrategia();
        const { cotizaciones, proyeccion } = await obtenerDatosProyeccion(fechaFutura, algoritmo);
        chartData = { cotizaciones, proyeccion };
        updateIndicators(proyeccion);
        prepareAndDraw(cotizaciones, proyeccion, fechaFutura);
        showChart();
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

/**
 * Maneja el cambio de estrategia
 */
async function handleStrategyChange() {
    const fechaFutura = elements.datePicker.value;
    if (!fechaFutura) return;
    showLoading();
    try {
        const algoritmo = getEstrategia();
        const { cotizaciones, proyeccion } = await obtenerDatosProyeccion(fechaFutura, algoritmo);
        chartData = { cotizaciones, proyeccion };
        updateIndicators(proyeccion);
        prepareAndDraw(cotizaciones, proyeccion, fechaFutura);
        showChart();
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

/**
 * Carga inicial
 */
async function loadInitialData() {
    showLoading();
    try {
        const today = formatDate(new Date());
        const algoritmo = getEstrategia();
        const { cotizaciones, proyeccion } = await obtenerDatosProyeccion(today, algoritmo);
        chartData = { cotizaciones, proyeccion };
        updateIndicators(proyeccion);
        prepareAndDraw(cotizaciones, proyeccion, today);
        showChart();
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

/**
 * Prepara los datos (caches, viewport) y dibuja
 */
function prepareAndDraw(historicalData, projectedData, projectedDate) {
    const secuencia = projectedData.secuenciaVenta || [];
    const lastHistoricalDate = new Date(historicalData[historicalData.length - 1].fecha);
    const projectedDates = buildProjectedDates(lastHistoricalDate, projectedDate, secuencia.length);

    // Construir cache de todos los puntos
    allPointsCache = [];
    for (const d of historicalData) {
        allPointsCache.push({ date: new Date(d.fecha).getTime(), value: d.venta, isProjected: false });
    }
    for (let i = 0; i < secuencia.length; i++) {
        allPointsCache.push({ date: projectedDates[i].getTime(), value: secuencia[i], isProjected: true });
    }

    // Calcular límites absolutos
    viewState.dataMin = allPointsCache[0].date;
    viewState.dataMax = allPointsCache[allPointsCache.length - 1].date;
    viewState.totalRange = viewState.dataMax - viewState.dataMin;

    // Viewport inicial: todo
    viewState.viewStart = viewState.dataMin;
    viewState.viewEnd = viewState.dataMax;
    viewState.viewRange = viewState.totalRange;

    // Activar botón "Todo"
    elements.zoomBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.zoom-btn[data-range="all"]')?.classList.add('active');

    syncSliderFromView();
    drawChart(historicalData, projectedData, projectedDate);
}

/**
 * Actualiza los indicadores
 */
function updateIndicators(proyeccion) {
    const current = proyeccion.ultima.venta;
    const projected = proyeccion.proyVenta;
    const diff = projected - current;
    const diffPercent = (diff / current) * 100;

    elements.currentValue.textContent = formatCurrency(current);
    elements.projectedValue.textContent = formatCurrency(projected);
    elements.difference.textContent = formatPercent(diffPercent);
    elements.daysUntil.textContent = formatDays(Math.round(proyeccion.diffDias));

    const diffClass = diff >= 0 ? 'indicator__value--positive' : 'indicator__value--negative';
    elements.difference.className = `indicator__value ${diffClass}`;
}

function formatCurrency(value) {
    return '$' + value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
}

function formatDays(days) {
    return days + (days === 1 ? ' día' : ' días');
}

/**
 * Redibujar (wrapper para respetar viewport)
 */
function redrawChart() {
    drawChart(chartData.cotizaciones, chartData.proyeccion, elements.datePicker.value);
}

function showLoading() {
    if (elements.chart) elements.chart.style.display = 'none';
    let spinner = elements.chartWrapper.querySelector('.loading');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.className = 'loading';
        spinner.innerHTML = '<div class="spinner"></div><span class="loading-text">Cargando datos...</span>';
        elements.chartWrapper.appendChild(spinner);
    }
    spinner.style.display = 'flex';
}

function showError(message) {
    if (elements.chart) elements.chart.style.display = 'none';
    const spinner = elements.chartWrapper.querySelector('.loading');
    if (spinner) spinner.style.display = 'none';
    let errorEl = elements.chartWrapper.querySelector('.error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'error';
        elements.chartWrapper.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function showChart() {
    if (elements.chart) elements.chart.style.display = 'block';
    const spinner = elements.chartWrapper.querySelector('.loading');
    if (spinner) spinner.style.display = 'none';
    const errorEl = elements.chartWrapper.querySelector('.error');
    if (errorEl) errorEl.style.display = 'none';
}

/**
 * Dibuja el gráfico respetando la ventana visible (viewStart/viewEnd)
 * Solo muestra el valor del punto final proyectado; los intermedios se ven en tooltip.
 */
function drawChart(historicalData, projectedData, projectedDate) {
    const canvas = elements.chart;
    if (!canvas || !viewState.viewStart || !viewState.viewEnd) return;

    const ctx = canvas.getContext('2d');
    resizeCanvas(canvas);

    const rect = canvas.parentElement.getBoundingClientRect();
    const width = rect.width;    // logical pixels (ctx is already scaled by dpr)
    const height = rect.height;
    const padding = { top: 30, right: 50, bottom: 50, left: 70 };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (historicalData.length === 0) {
        showError('No hay datos disponibles');
        return;
    }

    const viewStart = viewState.viewStart;
    const viewEnd = viewState.viewEnd;
    const viewRange = viewEnd - viewStart;

    const secuencia = projectedData.secuenciaVenta || [];
    const lastHistoricalDate = new Date(historicalData[historicalData.length - 1].fecha);
    const projectedDates = buildProjectedDates(lastHistoricalDate, projectedDate, secuencia.length);

    // Filtrar puntos visibles
    const histVisible = historicalData.filter(d => {
        const t = new Date(d.fecha).getTime();
        return t >= viewStart && t <= viewEnd;
    });
    const projVisible = [];
    for (let i = 0; i < secuencia.length; i++) {
        const t = projectedDates[i].getTime();
        if (t >= viewStart && t <= viewEnd) {
            projVisible.push({ date: projectedDates[i], value: secuencia[i], idx: i });
        }
    }

    // Valores min/max dentro de la ventana visible
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (const d of histVisible) {
        if (d.venta < minValue) minValue = d.venta;
        if (d.venta > maxValue) maxValue = d.venta;
    }
    for (const p of projVisible) {
        if (p.value < minValue) minValue = p.value;
        if (p.value > maxValue) maxValue = p.value;
    }
    // Fallback si no hay visibles
    if (!isFinite(minValue)) {
        minValue = Math.min(...historicalData.map(d => d.venta));
        maxValue = Math.max(...historicalData.map(d => d.venta));
    }
    const valuePadding = Math.max((maxValue - minValue) * 0.05, 1);
    minValue -= valuePadding;
    maxValue += valuePadding;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Escalas (basadas en viewport)
    const xScale = (dateMs) => padding.left + ((dateMs - viewStart) / viewRange) * chartWidth;
    const yScale = (val) => padding.top + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;

    // ---- GRID ----
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        const value = maxValue - ((maxValue - minValue) / 5) * i;
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(value).toLocaleString(), padding.left - 10, y + 4);
    }

    // ---- LÍNEA HISTÓRICA ----
    ctx.beginPath();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    // Dibujar todos los puntos históricos (incluyendo fuera de vista para conectar bordes)
    let started = false;
    for (const d of historicalData) {
        const t = new Date(d.fecha).getTime();
        // Clamp: puntos fuera de vista se dibujan en el borde para conectar la línea
        const clampedT = Math.max(viewStart, Math.min(viewEnd, t));
        const x = xScale(clampedT);
        const y = yScale(d.venta);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ---- PUNTOS HISTÓRICOS VISIBLES (TODOS) ----
    for (const d of histVisible) {
        const x = xScale(new Date(d.fecha).getTime());
        const y = yScale(d.venta);
        ctx.beginPath();
        ctx.fillStyle = '#6366f1';
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ---- PROYECCIÓN ----
    if (projVisible.length > 0) {
        // Línea discontinua (conecta cada punto submuestreado para 
        // mantener la forma de la curva proyectada)
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);

        const lastHist = historicalData[historicalData.length - 1];
        const lastHistT = new Date(lastHist.fecha).getTime();
        ctx.moveTo(xScale(lastHistT), yScale(lastHist.venta));

        for (const p of projVisible) {
            ctx.lineTo(xScale(p.date.getTime()), yScale(p.value));
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Solo mostrar el valor del ÚLTIMO punto proyectado
        const lastProj = projVisible[projVisible.length - 1];
        const lastX = xScale(lastProj.date.getTime());
        const lastY = yScale(lastProj.value);

        // Punto final
        ctx.beginPath();
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Valor del punto final
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            '$' + Math.round(lastProj.value).toLocaleString('es-AR'),
            lastX,
            lastY - 14
        );
    }

    // Si no hay proyección pero hay fecha seleccionada → marcador ámbar
    if (projVisible.length === 0) {
        const match = historicalData.find(d => d.fecha === projectedDate);
        if (match) {
            const x = xScale(new Date(match.fecha).getTime());
            const y = yScale(match.venta);
            ctx.beginPath();
            ctx.fillStyle = '#f59e0b';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#f59e0b';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('$' + Math.round(match.venta).toLocaleString('es-AR'), x, y - 12);
        }
    }

    // ---- ETIQUETAS EJE X ----
    const numLabels = Math.min(10, Math.max(3, Math.round(viewRange / (30 * 86400000))));
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= numLabels; i++) {
        const t = viewStart + (viewRange / numLabels) * i;
        const x = xScale(t);
        const d = new Date(t);

        ctx.fillStyle = '#64748b';
        ctx.fillText(
            d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
            x,
            height - padding.bottom + 18
        );

        // Pequeña marca en el grid
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
    }

    // ---- ETIQUETA EJE Y ----
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARS', 0, 0);
    ctx.restore();
}

/**
 * Redimensiona el canvas
 */
function resizeCanvas(canvas) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvas.getContext('2d').scale(dpr, dpr);
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', () => {
    if (chartData.cotizaciones.length > 0 && chartData.proyeccion) {
        drawChart(chartData.cotizaciones, chartData.proyeccion, elements.datePicker.value);
    }
});