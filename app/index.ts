import { ExchangePojectorService } from "../src/service/exchProjector.basic.service";

const projector = new ExchangePojectorService();

const maxDays = 365;



const results: any[] = [];
for (let nDays = 1; nDays <= maxDays; nDays++) {
    const date = new Date(new Date(Date.now() + 86400000 * nDays)).toISOString().substring(0, 10);
    projector.proyectarCotizacion(date).then(res => {
        const data = { fecha: date, ...res };
        results.push(data);
        console.log(data)
    }).catch(err => {
        const errorData = { fecha: date, compra: 0, venta: 0, error: err.message || "Error desconocido" };
        results.push(errorData);
        console.error(errorData);
    })
}


