export type CompraVenta = { compra: number, venta: number };

export type Cotizacion = {
    fecha: string;        // ISO string, ej "2025-09-17"
    compra: number;
    venta: number;
    CompraVenta
    currency?: string; // opcional, por si se maneja más de una moneda
};
