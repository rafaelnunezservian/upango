import { normalizarTexto, truncarConElipsis } from "./normalizacion.js";
import { LIMITES } from "./limites.js";

/** Título exacto que el comerciante DEBE dar a la tarifa manual de recogida. */
export const TITULO_TARIFA_RECOGIDA = "Recogida en punto de entrega";

/**
 * Compara el título de una opción de entrega, normalizado, contra
 * `TITULO_TARIFA_RECOGIDA` (DEC-08). Un título nulo no es la tarifa de
 * recogida.
 */
export function esTarifaRecogida(titulo: string | null | undefined): boolean {
  if (titulo === null || titulo === undefined) {
    return false;
  }
  return normalizarTexto(titulo) === normalizarTexto(TITULO_TARIFA_RECOGIDA);
}

/**
 * Limpia una dirección corta para usarla en el título renombrado de la
 * tarifa (CT-05): recorta los extremos, quita caracteres de control,
 * colapsa espacios y trunca a `LIMITES.direccionCorta` con "…".
 */
export function formatearTituloRecogida(
  direccionCorta: string | null | undefined,
): string {
  if (direccionCorta === null || direccionCorta === undefined) {
    return "";
  }
  return truncarConElipsis(direccionCorta, LIMITES.direccionCorta);
}
