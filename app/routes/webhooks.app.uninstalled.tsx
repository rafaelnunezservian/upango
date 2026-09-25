import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import { contenedor } from "../composition/contenedor.server.js";
import { procesarDesinstalacion } from "../application/use-cases/procesarDesinstalacion.js";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session } = await authenticate.webhook(request);

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
};
