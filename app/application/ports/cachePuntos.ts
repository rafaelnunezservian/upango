import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";

/**
 * Copia cacheada de la lista de puntos de una tienda (FR-016). `fresca`
 * indica si sigue dentro del TTL configurado; cuando es `false` la copia
 * está vencida pero todavía dentro del máximo de vejez permitido
 * (`PUNTOS_CACHE_STALE_MAX_SEGUNDOS`), apta para *stale-while-revalidate* y
 * *stale-if-error*.
 */
export interface EntradaCachePuntos {
  readonly respuesta: RespuestaPuntosDto;
  readonly fresca: boolean;
}

/**
 * Puerto de caché de puntos por tienda (FR-016, §15.3). `leer` no devuelve
 * nada si la tienda nunca se cacheó o si la copia superó el máximo de vejez
 * permitido: más allá de ese límite la copia deja de ser válida incluso como
 * respaldo ante errores de la fuente. El TTL, el máximo de vejez y la
 * coordinación de cargas simultáneas (*single-flight*) son responsabilidad
 * de quien usa este puerto (`ListarPuntosRecogida`), no del propio puerto.
 */
export interface CachePuntos {
  leer(tienda: string): EntradaCachePuntos | undefined;
  guardar(tienda: string, respuesta: RespuestaPuntosDto): void;
  borrar(tienda: string): void;
}
