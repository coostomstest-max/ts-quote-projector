import { ExchangePojectorService } from "../src/service/exchProjector.basic.sercice";

const projector=new ExchangePojectorService();

projector.proyectarCotizacion("2025-09-30").then(res=>{
    console.log("Proyección para 2025-09-30:", res);
}).catch(err=>{
    console.error("Error en proyección:", err);
});