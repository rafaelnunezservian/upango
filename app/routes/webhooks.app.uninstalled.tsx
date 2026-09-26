import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import { contenedor } from "../composition/contenedor.server.js";
import { procesarDesinstalacion } from "../application/use-cases/procesarDesinstalacion.js";

export const action = ({ request }: ActionFunctionArgs) =>
  contenedor.conContextoPeticion(request, async () => {
    const { shop, session, topic } = await authenticate.webhook(request);
    contenedor.registro.info("webhook.recibido", { topic, tienda: shop });

    // Los webhooks pueden llegar varias veces y después de que la app ya
    // esté desinstalada; si no hay sesión, no hay nada que borrar.
    if (session) {
      await procesarDesinstalacion(shop, {
        sessionStorage: contenedor.sessionStorage,
        cachePuntos: contenedor.cachePuntos,
        registro: contenedor.registro,
      });
    }

    return new Response();
  });
