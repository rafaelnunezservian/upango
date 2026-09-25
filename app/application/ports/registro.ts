/** Datos estructurados adjuntos a un evento de log. Nunca secretos ni PII. */
export type DatosEvento = Readonly<Record<string, unknown>>;

/**
 * Puerto de logging (constitución VI, NFR-14). Los casos de uso y
 * adaptadores registran eventos con nombre (`evento`) y datos
 * estructurados; la implementación decide el formato de salida.
 */
export interface Registro {
  debug(evento: string, datos?: DatosEvento): void;
  info(evento: string, datos?: DatosEvento): void;
  warn(evento: string, datos?: DatosEvento): void;
  error(evento: string, datos?: DatosEvento): void;
}
