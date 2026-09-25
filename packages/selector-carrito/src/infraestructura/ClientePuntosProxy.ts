import type { PuntoRecogidaDto, RespuestaPuntosDto } from "@puntos-recogida/contratos";
import type { ClientePuntos } from "../aplicacion/puertos.js";

const TIMEOUT_MS = 8000;

/** Adaptador de `GET /apps/puntos-recogida/puntos` (CT-03): timeout de 8 s y 1 reintento. */
export class ClientePuntosProxy implements ClientePuntos {
  constructor(private readonly url: string) {}

  async listar(): Promise<readonly PuntoRecogidaDto[]> {
    try {
      return await this.intentar();
    } catch {
      return await this.intentar();
    }
  }

  private async intentar(): Promise<readonly PuntoRecogidaDto[]> {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
    try {
      const respuesta = await fetch(this.url, {
        headers: { Accept: "application/json" },
        signal: controlador.signal,
      });
      if (!respuesta.ok) {
        throw new Error(`No se pudieron obtener los puntos de recogida (${respuesta.status})`);
      }
      const cuerpo = (await respuesta.json()) as RespuestaPuntosDto;
      return cuerpo.puntos;
    } finally {
      clearTimeout(temporizador);
    }
  }
}
