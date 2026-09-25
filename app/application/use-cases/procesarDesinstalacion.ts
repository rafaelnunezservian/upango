import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { CachePuntos } from "../ports/cachePuntos.js";
import type { Registro } from "../ports/registro.js";

export interface DependenciasProcesarDesinstalacion {
  readonly sessionStorage: SessionStorage;
  readonly cachePuntos: CachePuntos;
  readonly registro: Registro;
}

/**
 * Atiende `app/uninstalled` (FR-065): borra las sesiones de la tienda, vacía
 * su caché de puntos y registra cuántas sesiones borró.
 */
export async function procesarDesinstalacion(
  shop: string,
  { sessionStorage, cachePuntos, registro }: DependenciasProcesarDesinstalacion,
): Promise<void> {
  const sesiones = await sessionStorage.findSessionsByShop(shop);
  if (sesiones.length > 0) {
    await sessionStorage.deleteSessions(sesiones.map((sesion) => sesion.id));
  }
  cachePuntos.borrar(shop);
  registro.info("sesiones.borradas", {
    tienda: shop,
    cantidad: sesiones.length,
  });
}
