import {
  esCarritoResolado,
  esTarifaRecogida,
  formatearTituloRecogida,
  tieneValor,
} from "@puntos-recogida/contratos";

/** Una opción de entrega de un grupo, tal como la expone la input query (CT-05). */
export interface OpcionEntrega {
  readonly handle: string;
  readonly titulo: string | null;
}

/** Un grupo de entrega del carrito, con sus opciones. */
export interface GrupoEntrega {
  readonly opciones: readonly OpcionEntrega[];
}

/** Entrada del núcleo puro, ya despojada de los tipos generados de Shopify. */
export interface EntradaDecidirRenombre {
  readonly tipoCarrito: string | null;
  readonly puntoId: string | null;
  readonly direccionCorta: string | null;
  readonly grupos: readonly GrupoEntrega[];
}

/** Un handle a renombrar, con el título ya formateado. */
export interface DecisionRenombre {
  readonly handle: string;
  readonly titulo: string;
}

const LUGAR_POR_DEFECTO = "punto de entrega";
const SUFIJO_AVISO = "no se usará tu dirección";

/**
 * Tabla de decisión del CT-05: qué handles de la tarifa de recogida hay que
 * renombrar, y con qué título (`formatearTituloRecogida`, compartido con la
 * dirección corta que llega en `punto_direccion_corta`). Fuera de
 * "resolado con punto presente" no hay nada que renombrar.
 */
export function decidirRenombre(
  entrada: EntradaDecidirRenombre,
): readonly DecisionRenombre[] {
  const resolado = esCarritoResolado(entrada.tipoCarrito);
  const puntoPresente = tieneValor(entrada.puntoId);

  if (!resolado || !puntoPresente) {
    return [];
  }

  const direccionLimpia = formatearTituloRecogida(entrada.direccionCorta);
  const lugar = direccionLimpia.length > 0 ? direccionLimpia : LUGAR_POR_DEFECTO;
  const titulo = `Recogida en ${lugar} · ${SUFIJO_AVISO}`;

  const decisiones: DecisionRenombre[] = [];
  for (const grupo of entrada.grupos) {
    for (const opcion of grupo.opciones) {
      if (esTarifaRecogida(opcion.titulo)) {
        decisiones.push({ handle: opcion.handle, titulo });
      }
    }
  }

  return decisiones;
}
