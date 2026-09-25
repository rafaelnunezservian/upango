import { esCarritoResolado, esTarifaRecogida, tieneValor } from "@puntos-recogida/contratos";

/** Una opción de entrega de un grupo, tal como la expone la input query (CT-04). */
export interface OpcionEntrega {
  readonly handle: string;
  readonly titulo: string | null;
}

/** Un grupo de entrega del carrito, con sus opciones. */
export interface GrupoEntrega {
  readonly opciones: readonly OpcionEntrega[];
}

/** Entrada del núcleo puro, ya despojada de los tipos generados de Shopify. */
export interface EntradaDecidirOcultamiento {
  readonly tipoCarrito: string | null;
  readonly puntoId: string | null;
  readonly grupos: readonly GrupoEntrega[];
}

/**
 * Tabla de decisión del CT-04: qué handles de opciones de entrega hay que
 * ocultar. Fail-closed (FR-040, FR-047): un carrito resolado sin punto
 * presente oculta la tarifa de recogida igual que si no fuera esa tarifa,
 * en vez de dejarla visible por accidente.
 */
export function decidirOcultamiento(
  entrada: EntradaDecidirOcultamiento,
): readonly string[] {
  const resolado = esCarritoResolado(entrada.tipoCarrito);
  const puntoPresente = tieneValor(entrada.puntoId);
  const handles: string[] = [];

  for (const grupo of entrada.grupos) {
    for (const opcion of grupo.opciones) {
      const esRecogida = esTarifaRecogida(opcion.titulo);
      const ocultar = resolado ? !(puntoPresente && esRecogida) : esRecogida;
      if (ocultar) {
        handles.push(opcion.handle);
      }
    }
  }

  return handles;
}
