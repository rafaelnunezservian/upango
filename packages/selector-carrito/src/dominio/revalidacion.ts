import type { PuntoRecogidaDto, SeleccionPunto } from "@puntos-recogida/contratos";

/**
 * Resultado de revalidar una `SeleccionPunto` guardada en el carrito contra
 * la lista vigente de puntos (FR-028): `vigente` si coincide dato a dato con
 * el punto actual, `desactualizada` (con el punto vigente) si el punto sigue
 * existiendo pero cambió algún dato, o `inexistente` si ya no está en la
 * lista.
 */
export type ResultadoRevalidacion =
  | { readonly tipo: "vigente" }
  | { readonly tipo: "desactualizada"; readonly punto: PuntoRecogidaDto }
  | { readonly tipo: "inexistente" };

function coincideConPunto(seleccion: SeleccionPunto, punto: PuntoRecogidaDto): boolean {
  return (
    seleccion.puntoGid === punto.gid &&
    seleccion.puntoNombre === punto.nombre &&
    seleccion.puntoDireccion === punto.direccion &&
    seleccion.puntoDireccionCorta === punto.direccionCorta &&
    seleccion.puntoLat === String(punto.lat) &&
    seleccion.puntoLng === String(punto.lng)
  );
}

export function evaluarSeleccion(
  seleccion: SeleccionPunto,
  puntos: readonly PuntoRecogidaDto[],
): ResultadoRevalidacion {
  const punto = puntos.find((candidato) => candidato.id === seleccion.puntoId);
  if (!punto) {
    return { tipo: "inexistente" };
  }
  if (coincideConPunto(seleccion, punto)) {
    return { tipo: "vigente" };
  }
  return { tipo: "desactualizada", punto };
}
