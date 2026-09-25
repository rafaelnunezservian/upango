import { procesarDesinstalacion } from "./procesarDesinstalacion.js";
import type { DependenciasProcesarDesinstalacion } from "./procesarDesinstalacion.js";

export type TopicPrivacidad =
  | "CUSTOMERS_DATA_REQUEST"
  | "CUSTOMERS_REDACT"
  | "SHOP_REDACT";

/**
 * Atiende los webhooks obligatorios de privacidad (FR-067). La app no
 * guarda datos de compradores, así que `customers/*` solo se registra;
 * `shop/redact` borra cualquier dato que quede de la tienda (sesiones).
 */
export async function procesarSolicitudPrivacidad(
  topic: TopicPrivacidad,
  shop: string,
  dependencias: DependenciasProcesarDesinstalacion,
): Promise<void> {
  const { registro } = dependencias;
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      registro.info("webhook.recibido", {
        topic,
        tienda: shop,
        nota: "la app no guarda datos de compradores",
      });
      return;
    case "SHOP_REDACT":
      await procesarDesinstalacion(shop, dependencias);
      return;
  }
}
