import { ExchangePojectorService } from "../src/service/exchProjector.basic.sercice";

const projector = new ExchangePojectorService();

const nDays = 1;
const today = new Date(new Date(Date.now() + 86400000 * nDays)).toISOString().substring(0, 10);
projector.proyectarCotizacion(today).then(res => {
    console.log("Proyección para ", today, ": ", res);
}).catch(err => {
    console.error("Error en proyección:", err);
});