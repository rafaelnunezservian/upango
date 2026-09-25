import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import { contenedor } from "../composition/contenedor.server.js";
import { procesarSolicitudPrivacidad } from "../application/use-cases/procesarSolicitudPrivacidad.js";
import type { TopicPrivacidad } from "../application/use-cases/procesarSolicitudPrivacidad.js";

const TOPICS_PRIVACIDAD: readonly string[] = [
  "CUSTOMERS_DATA_REQUEST",
  "CUSTOMERS_REDACT",
  "SHOP_REDACT",
];

function esTopicPrivacidad(topic: string): topic is TopicPrivacidad {
  return TOPICS_PRIVACIDAD.includes(topic);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  if (esTopicPrivacidad(topic)) {
    await procesarSolicitudPrivacidad(topic, shop, {
      sessionStorage: contenedor.sessionStorage,
      cachePuntos: contenedor.cachePuntos,
      registro: contenedor.registro,
    });
  } else {
    contenedor.registro.warn("webhook.recibido", {
      topic,
      tienda: shop,
      nota: "topic de cumplimiento no reconocido",
    });
  }

  return new Response();
};
