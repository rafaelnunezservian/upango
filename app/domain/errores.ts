/** Error de dominio: los datos crudos no forman un `PuntoRecogida` válido (CT-01, FR-014). */
export class PuntoInvalidoError extends Error {
  constructor(
    readonly motivo: string,
    readonly identificador?: string,
  ) {
    super(motivo);
    this.name = "PuntoInvalidoError";
  }
}

/**
 * Error de dominio: no hay ninguna copia válida (fresca o vencida dentro del
 * máximo permitido) de la lista de puntos de una tienda porque la fuente
 * falló (FR-016). Las rutas lo traducen a 502 (CT-03).
 */
export class PuntosNoDisponiblesError extends Error {
  constructor(readonly tienda: string) {
    super(`No se pudieron obtener los puntos de recogida para "${tienda}".`);
    this.name = "PuntosNoDisponiblesError";
  }
}
