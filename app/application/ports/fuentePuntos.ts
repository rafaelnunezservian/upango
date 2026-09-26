import type { DatosPuntoRecogida } from "../../domain/puntoRecogida.js";

/** Métricas de una carga completa, para el evento `puntos.carga` (§22). */
export interface MetricasCargaPuntos {
  readonly paginas: number;
  /** Suma del costo real de las consultas (o el pedido, si la API no informa el real). */
  readonly costo: number;
  readonly reintentos: number;
}

export interface ResultadoFuentePuntos {
  readonly puntos: readonly DatosPuntoRecogida[];
  readonly metricas: MetricasCargaPuntos;
}

/**
 * Error de la fuente con los reintentos ya consumidos, para el evento
 * `puntos.carga.error` (§22). La causa original queda en `cause`.
 */
export class FuentePuntosError extends Error {
  constructor(
    mensaje: string,
    readonly reintentos: number,
    opciones?: { readonly cause?: unknown },
  ) {
    super(mensaje, opciones);
    this.name = "FuentePuntosError";
  }
}

/**
 * Puerto de lectura de puntos de recogida (CT-03). Devuelve los datos crudos
 * de todas las entradas del metaobjeto, sin paginar de cara al llamador; la
 * validación de dominio (FR-014) es responsabilidad de quien consume este
 * puerto, no del adaptador.
 */
export interface FuentePuntos {
  obtenerTodos(): Promise<ResultadoFuentePuntos>;
}
