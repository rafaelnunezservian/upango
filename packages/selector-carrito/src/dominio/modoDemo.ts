import {
  CLAVE_TIPO_CARRITO,
  VALOR_TIPO_RESOLADO,
  atributosVaciosSeleccion,
} from "@puntos-recogida/contratos";

/**
 * Atributos a escribir en el carrito al activar o desactivar el interruptor
 * de modo demo (§17.6, FR-033): activar solo agrega `tipo_carrito`;
 * desactivar también limpia los 7 `punto_*`, igual que un carrito que deja
 * de ser resolado (FR-029).
 */
export function atributosModoDemo(activo: boolean): Record<string, string> {
  if (activo) {
    return { [CLAVE_TIPO_CARRITO]: VALOR_TIPO_RESOLADO };
  }
  return { [CLAVE_TIPO_CARRITO]: "", ...atributosVaciosSeleccion() };
}
