import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";
import type { DatosPuntoRecogida, PuntoRecogida } from "../../domain/puntoRecogida.js";
import { crearPuntoRecogida } from "../../domain/puntoRecogida.js";
import { PuntoInvalidoError, PuntosNoDisponiblesError } from "../../domain/errores.js";
import type { CachePuntos } from "../ports/cachePuntos.js";
import type { FuentePuntos } from "../ports/fuentePuntos.js";
import type { Registro } from "../ports/registro.js";
import type { Reloj } from "../ports/reloj.js";

export interface DependenciasListarPuntosRecogida {
  readonly cache: CachePuntos;
  readonly registro: Registro;
  readonly reloj: Reloj;
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Caso de uso del CT-03 (FR-016, §15.2): sirve la lista de puntos de una
 * tienda desde la caché cuando está fresca; si está vencida pero dentro del
 * máximo permitido, la sirve marcada `stale: true` y dispara como mucho un
 * refresco en segundo plano por tienda (*stale-while-revalidate*); si no hay
 * copia válida, carga desde `fuente` (con *single-flight* entre peticiones
 * simultáneas de la misma tienda) y lanza `PuntosNoDisponiblesError` si la
 * carga falla sin ninguna copia de respaldo (*stale-if-error*, hasta el
 * máximo del CachePuntos).
 */
export class ListarPuntosRecogida {
  private readonly cargasEnCurso = new Map<string, Promise<RespuestaPuntosDto>>();
  private readonly refrescosEnCurso = new Set<string>();

  constructor(private readonly deps: DependenciasListarPuntosRecogida) {}

  async ejecutar(tienda: string, fuente: FuentePuntos): Promise<RespuestaPuntosDto> {
    const entrada = this.deps.cache.leer(tienda);

    if (entrada?.fresca) {
      return entrada.respuesta;
    }

    if (entrada) {
      this.dispararRefrescoEnSegundoPlano(tienda, fuente);
      return { ...entrada.respuesta, stale: true };
    }

    return this.cargarConSingleFlight(tienda, fuente);
  }

  private cargarConSingleFlight(
    tienda: string,
    fuente: FuentePuntos,
  ): Promise<RespuestaPuntosDto> {
    const existente = this.cargasEnCurso.get(tienda);
    if (existente) {
      return existente;
    }

    const promesa = this.cargar(tienda, fuente).finally(() => {
      this.cargasEnCurso.delete(tienda);
    });
    this.cargasEnCurso.set(tienda, promesa);
    return promesa;
  }

  private dispararRefrescoEnSegundoPlano(tienda: string, fuente: FuentePuntos): void {
    if (this.refrescosEnCurso.has(tienda)) {
      return;
    }
    this.refrescosEnCurso.add(tienda);
    this.cargar(tienda, fuente)
      .catch(() => {
        // El error ya se registró dentro de `cargar`; es un refresco en
        // segundo plano, nadie más espera su resultado.
      })
      .finally(() => this.refrescosEnCurso.delete(tienda));
  }

  private async cargar(tienda: string, fuente: FuentePuntos): Promise<RespuestaPuntosDto> {
    let crudos;
    try {
      crudos = await fuente.obtenerTodos();
    } catch (error) {
      this.deps.registro.error("puntos.carga_fallida", {
        tienda,
        motivo: mensajeDeError(error),
      });
      throw new PuntosNoDisponiblesError(tienda);
    }

    const respuesta = this.construirRespuesta(tienda, crudos);
    this.deps.cache.guardar(tienda, respuesta);
    return respuesta;
  }

  private construirRespuesta(
    tienda: string,
    crudos: readonly DatosPuntoRecogida[],
  ): RespuestaPuntosDto {
    const validos: PuntoRecogida[] = [];
    const idsVistos = new Set<string>();

    for (const crudo of crudos) {
      try {
        const punto = crearPuntoRecogida(crudo);
        if (idsVistos.has(punto.id)) {
          this.deps.registro.warn("puntos.identificador_duplicado", { tienda, id: punto.id });
        }
        idsVistos.add(punto.id);
        validos.push(punto);
      } catch (error) {
        if (!(error instanceof PuntoInvalidoError)) {
          throw error;
        }
        this.deps.registro.warn("puntos.invalido_descartado", {
          tienda,
          identificador: error.identificador ?? crudo.id,
          motivo: error.motivo,
        });
      }
    }

    validos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    return {
      version: 1,
      generadoEn: this.deps.reloj.ahora().toISOString(),
      stale: false,
      total: validos.length,
      puntos: validos.map((punto) => ({
        id: punto.id,
        gid: punto.gid,
        nombre: punto.nombre,
        direccion: punto.direccion,
        direccionCorta: punto.direccionCorta,
        lat: punto.coordenadas.lat,
        lng: punto.coordenadas.lng,
      })),
    };
  }
}
