/**
 * App - Lógica de la interfaz de usuario
 * UI sin clases, solo funciones
 */

import { obtenerDatosProyeccion } from './api.js';

// Referencias DOM
let elements = {};
let chartData = {
    cotizaciones: [],
    proyeccion: null
};

/**
 * Inicializa la aplicación
 */
function init() {
    cacheElements();
    setupDatePicker();
    loadInitialData();
}

/**
 * Obtiene referencias a elementos del DOM
 */
function cacheElements() {
    elements = {
        datePicker: document.getElementById('datePicker'),
        currentValue: document.getElementById('currentValue'),
        projectedValue: document.getElementById('projectedValue'),
        difference: document.getElementById('difference'),
        daysUntil: document.getElementById('daysUntil'),
        chartWrapper: document.getElementById('chartWrapper'),
        chart: document.getElementById('chart')
    };
}

/**
 * Configura el selector de fecha
 */
function setupDatePicker() {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 6);

    elements.datePicker.min = formatDate(today);
    elements.datePicker.max = formatDate(maxDate);
    elements.datePicker.value = formatDate(today);

    elements.datePicker.addEventListener('change', handleDateChange);
}

/**
 * Formatea fecha a YYYY-MM-DD
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Maneja el cambio de fecha
 */
async function handleDateChange() {
    const fechaFutura = elements.datePicker.value;
    if (!fechaFutura) return;

    showLoading();

    try {
        console.log('Fetching data for date:', fechaFutura);
        const { cotizaciones, proyeccion } = await obtenerDatosProyeccion(fechaFutura);
        console.log('Data received:', { cotizaciones: cotizaciones?.length, proyeccion });
        chartData = { cotizaciones, proyeccion };
        updateIndicators(proyeccion);
        drawChart(cotizaciones, proyeccion, fechaFutura);
        showChart();
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

/**
 * Carga los datos iniciales
 */
async function loadInitialData() {
    showLoading();

    try {
        const today = formatDate(new Date());
        console.log('Loading initial data for today:', today);
        const { cotizaciones, proyeccion } = await obtenerDatosProyeccion(today);
        console.log('Data received:', { cotizaciones: cotizaciones?.length, proyeccion });
        chartData = { cotizaciones, proyeccion };
        updateIndicators(proyeccion);
        drawChart(cotizaciones, proyeccion, today);
        showChart();
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

/**
 * Actualiza los indicadores de tarjetas
 */
function updateIndicators(proyeccion) {
    const current = proyeccion.ultima.compra;
    const projected = proyeccion.proyCompra;
    const diff = projected - current;
    const diffPercent = (diff / current) * 100;

    elements.currentValue.textContent = formatCurrency(current);
    elements.projectedValue.textContent = formatCurrency(projected);
    elements.difference.textContent = formatPercent(diffPercent);
    elements.daysUntil.textContent = formatDays(Math.round(proyeccion.diffDias));

    // Color según variación
    const diffClass = diff >= 0 ? 'indicator__value--positive' : 'indicator__value--negative';
    elements.difference.className = `indicator__value ${diffClass}`;
}

/**
 * Formatea valor como moneda
 */
function formatCurrency(value) {
    return '$' + value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formatea valor como porcentaje
 */
function formatPercent(value) {
    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
}

/**
 * Formatea días
 */
function formatDays(days) {
    return days + (days === 1 ? ' día' : ' días');
}

/**
 * Muestra el estado de carga
 */
function showLoading() {
    // Mantener el canvas pero ocultarlo
    if (elements.chart) {
        elements.chart.style.display = 'none';
    }
    // Mostrar spinner
    let spinner = elements.chartWrapper.querySelector('.loading');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.className = 'loading';
        spinner.innerHTML = '<div class="spinner"></div><span class="loading-text">Cargando datos...</span>';
        elements.chartWrapper.appendChild(spinner);
    }
    spinner.style.display = 'flex';
}

/**
 * Muestra un mensaje de error
 */
function showError(message) {
    // Ocultar canvas y spinner
    if (elements.chart) {
        elements.chart.style.display = 'none';
    }
    const spinner = elements.chartWrapper.querySelector('.loading');
    if (spinner) {
        spinner.style.display = 'none';
    }
    // Mostrar error
    let errorEl = elements.chartWrapper.querySelector('.error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'error';
        elements.chartWrapper.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

/**
 * Muestra el canvas del gráfico
 */
function showChart() {
    if (elements.chart) {
        elements.chart.style.display = 'block';
    }
    const spinner = elements.chartWrapper.querySelector('.loading');
    if (spinner) {
        spinner.style.display = 'none';
    }
    const errorEl = elements.chartWrapper.querySelector('.error');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

/**
 * Dibuja el gráfico en canvas
 */
function drawChart(historicalData, projectedData, projectedDate) {
    const canvas = elements.chart;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Resize canvas
    resizeCanvas(canvas);
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 30, right: 30, bottom: 50, left: 70 };

    ctx.clearRect(0, 0, width, height);

    if (historicalData.length === 0) {
        showError('No hay datos disponibles');
        return;
    }

    // Calcular rangos
    const allDates = [...historicalData.map(d => new Date(d.fecha)), new Date(projectedDate)];
    const allValues = [...historicalData.map(d => d.compra), projectedData.proyCompra];
    
    const minDate = Math.min(...allDates.map(d => d.getTime()));
    const maxDate = Math.max(...allDates.map(d => d.getTime()));
    const minValue = Math.min(...allValues) * 0.97;
    const maxValue = Math.max(...allValues) * 1.03;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Funciones de escala
    const xScale = (date) => padding.left + ((date.getTime() - minDate) / (maxDate - minDate)) * chartWidth;
    const yScale = (value) => padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

    // Líneas de grid
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

    // Línea de datos históricos
    ctx.beginPath();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    historicalData.forEach((d, i) => {
        const x = xScale(new Date(d.fecha));
        const y = yScale(d.compra);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Puntos de datos históricos (muestreo)
    historicalData.forEach((d, i) => {
        if (i % 15 !== 0 && i !== historicalData.length - 1) return;
        const x = xScale(new Date(d.fecha));
        const y = yScale(d.compra);
        ctx.beginPath();
        ctx.fillStyle = '#6366f1';
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Línea de proyección (discontinua)
    const lastHistorical = historicalData[historicalData.length - 1];
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    
    const projStartX = xScale(new Date(lastHistorical.fecha));
    const projStartY = yScale(lastHistorical.compra);
    const projEndX = xScale(new Date(projectedDate));
    const projEndY = yScale(projectedData.proyCompra);
    
    ctx.moveTo(projStartX, projStartY);
    ctx.lineTo(projEndX, projEndY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Punto de proyección
    ctx.beginPath();
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.arc(projEndX, projEndY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Etiquetas del eje X
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    
    const labelCount = Math.min(5, historicalData.length);
    const step = Math.max(1, Math.floor(historicalData.length / labelCount));
    for (let i = 0; i < historicalData.length; i += step) {
        const d = historicalData[i];
        const x = xScale(new Date(d.fecha));
        const date = new Date(d.fecha);
        ctx.fillText(date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), x, height - 15);
    }

    // Etiqueta de fecha de proyección
    ctx.fillStyle = '#10b981';
    ctx.fillText(new Date(projectedDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), projEndX, height - 15);

    // Etiqueta eje Y
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
 * Redimensiona el canvas para alta resolución
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

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);

// Handle resize
window.addEventListener('resize', () => {
    if (chartData.cotizaciones.length > 0 && chartData.proyeccion) {
        const fechaFutura = elements.datePicker.value;
        drawChart(chartData.cotizaciones, chartData.proyeccion, fechaFutura);
    }
});
