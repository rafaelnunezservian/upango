import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { Registro } from "../ports/registro.js";

export interface DependenciasProcesarDesinstalacion {
  readonly sessionStorage: SessionStorage;
  readonly registro: Registro;
}

/**
 * Atiende `app/uninstalled` (FR-065): borra las sesiones de la tienda y
 * registra cuántas borró. La limpieza de la caché de puntos se conecta
 * cuando exista `CachePuntos` (Fase 4, US-2).
 */
export async function procesarDesinstalacion(
  shop: string,
  { sessionStorage, registro }: DependenciasProcesarDesinstalacion,
): Promise<void> {
  const sesiones = await sessionStorage.findSessionsByShop(shop);
  if (sesiones.length > 0) {
    await sessionStorage.deleteSessions(sesiones.map((sesion) => sesion.id));
  }
  registro.info("sesiones.borradas", {
    tienda: shop,
    cantidad: sesiones.length,
  });
}
