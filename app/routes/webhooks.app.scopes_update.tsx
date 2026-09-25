import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import { contenedor } from "../composition/contenedor.server.js";
import { actualizarScopesSesion } from "../application/use-cases/actualizarScopesSesion.js";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session } = await authenticate.webhook(request);

  if (session) {
    const current = (payload.current as string[]) ?? [];
    await actualizarScopesSesion(session, current, contenedor.sessionStorage);
  }

  return new Response();
};
