import { CompraVenta, Cotizacion } from "./types";
import dolaritoAjustment from '../infra/datasets/dolaritoAdjustment.json';
const dolaritoAjustmentTyped: { [key: string]: DolaritoAdjustmentEntry } = dolaritoAjustment;
type DolaritoAdjustmentEntry = {
    informal?: CompraVenta,
    mep?: CompraVenta,
    bancos?: CompraVenta,
    oficial?: CompraVenta,
    ccl?: CompraVenta
};
export class RateAdjustService {
    private static instance?: RateAdjustService;
    private RegexYYYYMMDD: RegExp;
    private RegexDDMMYY: RegExp;
    constructor() {
        this.RegexYYYYMMDD = /^\d{4}-\d{2}-\d{2}$/; // Formato ISO 8601
        this.RegexDDMMYY = /^\d{2}-\d{2}-\d{2}$/; // Formato DD-MM-YYYY
    }
    public static getInstance() {
        if (!this.instance) {
            this.instance = new RateAdjustService();
        }
        return this.instance;
    }
    parseDateToDDMMYY(date: string): string {
        if (!date.match(this.RegexYYYYMMDD)) return date;
        const [year, month, day] = date.split("-");
        const current = (new Date()).toISOString().split("T")[0]?.split("-")[0] ?? "2025";
        return `${day}-${month}-${(year ?? current).slice(2)}`;
    }

    parseDateToISO(date: string): string {
        if (!date.match(this.RegexDDMMYY)) return date;
        const [day, month, subyear] = date.split("-");
        const current = (new Date()).toISOString().split("T")[0]?.split("-")[0] ?? "2025";
        const year = current.slice(0, 2) + subyear;
        return `${year}-${month}-${day}`;
    }

    public adjustExchanges(exchanges: Array<Cotizacion>): Array<Cotizacion> {
        const adjustArray =
            Object.keys(dolaritoAjustment).map(k => {
                return {
                    fecha: this.parseDateToISO(k),
                    ...(
                        dolaritoAjustmentTyped[k]?.oficial ??
                        dolaritoAjustmentTyped[k]?.ccl ??
                        dolaritoAjustmentTyped[k]?.mep ??
                        dolaritoAjustmentTyped[k]?.bancos ??
                        { compra: 100000, venta: 102500 })
                }
            }) ?? [];
        return exchanges.concat(adjustArray as Array<Cotizacion>).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }
}