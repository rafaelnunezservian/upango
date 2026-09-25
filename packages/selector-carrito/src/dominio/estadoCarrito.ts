import type { PuntoRecogidaDto, SeleccionPunto } from "@puntos-recogida/contratos";

/**
 * Máquina de 8 estados del selector (§17.3). El controlador es el único que
 * construye y reemplaza el estado; este módulo solo define su forma y las
 * consultas puras que se derivan de él (bloqueo del checkout).
 */
export type EstadoSelector =
  | { readonly tipo: "inactivo" }
  | { readonly tipo: "cargando" }
  | { readonly tipo: "error"; readonly mensaje: string }
  | { readonly tipo: "vacio" }
  | {
      readonly tipo: "sin_seleccion";
      readonly puntos: readonly PuntoRecogidaDto[];
      readonly aviso?: string;
    }
  | {
      readonly tipo: "guardando";
      readonly puntos: readonly PuntoRecogidaDto[];
      readonly puntoElegido: PuntoRecogidaDto;
    }
  | {
      readonly tipo: "con_seleccion";
      readonly puntos: readonly PuntoRecogidaDto[];
      readonly seleccion: SeleccionPunto;
    }
  | {
      readonly tipo: "error_guardado";
      readonly puntos: readonly PuntoRecogidaDto[];
      readonly puntoElegido: PuntoRecogidaDto;
      readonly mensaje: string;
    };

export function estadoInactivo(): EstadoSelector {
  return { tipo: "inactivo" };
}

export function estadoCargando(): EstadoSelector {
  return { tipo: "cargando" };
}

export function estadoError(mensaje: string): EstadoSelector {
  return { tipo: "error", mensaje };
}

export function estadoVacio(): EstadoSelector {
  return { tipo: "vacio" };
}

export function estadoSinSeleccion(
  puntos: readonly PuntoRecogidaDto[],
  aviso?: string,
): EstadoSelector {
  return aviso === undefined
    ? { tipo: "sin_seleccion", puntos }
    : { tipo: "sin_seleccion", puntos, aviso };
}

export function estadoGuardando(
  puntos: readonly PuntoRecogidaDto[],
  puntoElegido: PuntoRecogidaDto,
): EstadoSelector {
  return { tipo: "guardando", puntos, puntoElegido };
}

export function estadoConSeleccion(
  puntos: readonly PuntoRecogidaDto[],
  seleccion: SeleccionPunto,
): EstadoSelector {
  return { tipo: "con_seleccion", puntos, seleccion };
}

export function estadoErrorGuardado(
  puntos: readonly PuntoRecogidaDto[],
  puntoElegido: PuntoRecogidaDto,
  mensaje: string,
): EstadoSelector {
  return { tipo: "error_guardado", puntos, puntoElegido, mensaje };
}

/**
 * `true` si el checkout debe quedar bloqueado en este estado (§17.3). El
 * estado `inactivo` no bloquea porque significa "sin cambios": el
 * controlador no debe tocar la guardia en absoluto en ese caso.
 */
export function debeBloquearCheckout(estado: EstadoSelector): boolean {
  return estado.tipo !== "inactivo" && estado.tipo !== "con_seleccion";
}

/** `true` si el estado conserva la lista de puntos ya cargada. */
export function tienePuntos(
  estado: EstadoSelector,
): estado is EstadoSelector & { puntos: readonly PuntoRecogidaDto[] } {
  return (
    estado.tipo === "sin_seleccion" ||
    estado.tipo === "guardando" ||
    estado.tipo === "con_seleccion" ||
    estado.tipo === "error_guardado"
  );
}
