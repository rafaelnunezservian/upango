import type { EjecutorComandos, ProveedorDespliegue } from "../puertos/index.js";
import { ProveedorGcp } from "./gcp/ProveedorGcp.js";

/**
 * Mapa nombre → fábrica del proveedor (OCP, §20.3). En v1 solo registra
 * `gcp`; `plantilla/` es a propósito el esqueleto que NO está aquí (§20.7).
 * Agregar un proveedor nuevo es agregar una línea a este mapa, sin tocar el
 * orquestador ni el resto de la CLI.
 */
export function crearRegistroProveedores(
  ejecutor: EjecutorComandos,
): ReadonlyMap<string, () => ProveedorDespliegue> {
  return new Map<string, () => ProveedorDespliegue>([["gcp", () => new ProveedorGcp(ejecutor)]]);
}
