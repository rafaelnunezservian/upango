/** Datos de un punto de recogida a crear/actualizar en el metaobjeto (CT-01). */
export interface DatosNuevoPunto {
  readonly handle: string;
  readonly identificador: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly direccionCorta: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * Puerto de escritura de puntos de recogida. Solo lo usa la herramienta de
 * semilla (FR-005); el CRUD real lo hace el comerciante desde el admin
 * nativo de metaobjetos (US-1).
 */
export interface EscritorPuntos {
  upsert(punto: DatosNuevoPunto): Promise<void>;
}
