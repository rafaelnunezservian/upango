import type { DatosPuntoRecogida } from "../../domain/puntoRecogida.js";

/**
 * Puerto de lectura de puntos de recogida (CT-03). Devuelve los datos crudos
 * de todas las entradas del metaobjeto, sin paginar de cara al llamador; la
 * validación de dominio (FR-014) es responsabilidad de quien consume este
 * puerto, no del adaptador.
 */
export interface FuentePuntos {
  obtenerTodos(): Promise<readonly DatosPuntoRecogida[]>;
}
