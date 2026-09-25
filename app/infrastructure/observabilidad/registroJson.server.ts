import type { DatosEvento, Registro } from "../../application/ports/registro.js";

export type NivelLog = "debug" | "info" | "warn" | "error";

const SEVERIDAD: Record<NivelLog, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
};

const PRIORIDAD: Record<NivelLog, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Escribe una línea JSON por evento en stdout (NFR-14), con `severity`,
 * `message`, `evento` y los datos del evento. Nunca escribe tokens,
 * secretos ni datos personales: es responsabilidad de quien llama no pasar
 * esos valores en `datos` (constitución VI).
 */
export class RegistroJson implements Registro {
  constructor(private readonly nivelMinimo: NivelLog = "info") {}

  debug(evento: string, datos?: DatosEvento): void {
    this.escribir("debug", evento, datos);
  }

  info(evento: string, datos?: DatosEvento): void {
    this.escribir("info", evento, datos);
  }

  warn(evento: string, datos?: DatosEvento): void {
    this.escribir("warn", evento, datos);
  }

  error(evento: string, datos?: DatosEvento): void {
    this.escribir("error", evento, datos);
  }

  private escribir(nivel: NivelLog, evento: string, datos?: DatosEvento): void {
    if (PRIORIDAD[nivel] < PRIORIDAD[this.nivelMinimo]) {
      return;
    }
    const linea = {
      severity: SEVERIDAD[nivel],
      message: evento,
      evento,
      ...datos,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(linea));
  }
}
