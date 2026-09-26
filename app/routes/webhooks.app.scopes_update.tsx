import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import { contenedor } from "../composition/contenedor.server.js";
import { actualizarScopesSesion } from "../application/use-cases/actualizarScopesSesion.js";

export const action = ({ request }: ActionFunctionArgs) =>
  contenedor.conContextoPeticion(request, async () => {
    const { payload, session, shop, topic } = await authenticate.webhook(request);
    contenedor.registro.info("webhook.recibido", { topic, tienda: shop });

    if (session) {
      const current = (payload.current as string[]) ?? [];
      await actualizarScopesSesion(session, current, contenedor.sessionStorage);
    }

    return new Response();
  });
