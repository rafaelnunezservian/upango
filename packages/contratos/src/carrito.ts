import { normalizarTexto } from "./normalizacion.js";

/** Valor normalizado que identifica un carrito resolado (CT-02). */
export const VALOR_TIPO_RESOLADO = "resolado";

/**
 * `true` si el atributo `tipo_carrito` corresponde a un carrito resolado,
 * tolerando mayúsculas, tildes y espacios en los extremos (EC-05).
 */
export function esCarritoResolado(valor: string | null | undefined): boolean {
  return normalizarTexto(valor) === VALOR_TIPO_RESOLADO;
}
