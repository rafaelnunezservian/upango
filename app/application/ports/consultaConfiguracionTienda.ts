/** Conteo de puntos y tipo resuelto del metaobjeto `$app:punto_recogida`. */
export interface ConteoPuntos {
  readonly total: number;
  /** Tipo resuelto (`app--{id}--punto_recogida`) para el deep link a las entradas; `null` si la definición no existe. */
  readonly tipoResuelto: string | null;
}

/**
 * Puerto de solo lectura sobre la definición del metaobjeto de puntos
 * (US-5, §15.3): evita paginar todas las entradas (como hace
 * `ListarPuntosRecogida`) solo para contarlas y resolver el tipo del deep
 * link del paso "Puntos" de la página de admin.
 */
export interface ConsultaConfiguracionTienda {
  contarPuntos(): Promise<ConteoPuntos>;
}
