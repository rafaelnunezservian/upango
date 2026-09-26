import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";
import type { DatosPuntoRecogida, PuntoRecogida } from "../../domain/puntoRecogida.js";
import { crearPuntoRecogida } from "../../domain/puntoRecogida.js";
import { PuntoInvalidoError, PuntosNoDisponiblesError } from "../../domain/errores.js";
import type { CachePuntos } from "../ports/cachePuntos.js";
import type { FuentePuntos, MetricasCargaPuntos } from "../ports/fuentePuntos.js";
import { FuentePuntosError } from "../ports/fuentePuntos.js";
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
 * De dónde salió la respuesta, para el evento `proxy.puntos.respuesta` (§22):
 * `fresca` (caché dentro del TTL), `vencida` (caché vencida servida mientras
 * se refresca), `cargada` (recién leída de Shopify) o `stale` (copia vencida
 * servida porque Shopify falló).
 */
export type EstadoCachePuntos = "fresca" | "vencida" | "cargada" | "stale";

export interface ResultadoListarPuntos {
  readonly respuesta: RespuestaPuntosDto;
  readonly estadoCache: EstadoCachePuntos;
}

/**
 * Caso de uso del CT-03 (FR-016, §15.2): sirve la lista de puntos de una
 * tienda desde la caché cuando está fresca; si está vencida pero dentro del
 * máximo permitido, la sirve y dispara como mucho un refresco en segundo
 * plano por tienda (*stale-while-revalidate*). Solo la marca `stale: true`
 * cuando el último refresco de esa tienda falló, es decir, cuando se sirve
 * porque Shopify falló (*stale-if-error*, CT-03). Si no hay copia válida,
 * carga desde `fuente` (con *single-flight* entre peticiones simultáneas de
 * la misma tienda) y lanza `PuntosNoDisponiblesError` si la carga falla.
 */
export class ListarPuntosRecogida {
  private readonly cargasEnCurso = new Map<string, Promise<RespuestaPuntosDto>>();
  private readonly refrescosEnCurso = new Set<string>();
  /** Tiendas cuya última carga desde Shopify falló (se limpia con la próxima que tenga éxito). */
  private readonly tiendasConFallo = new Set<string>();

  constructor(private readonly deps: DependenciasListarPuntosRecogida) {}

  async ejecutar(tienda: string, fuente: FuentePuntos): Promise<ResultadoListarPuntos> {
    const entrada = this.deps.cache.leer(tienda);

    if (entrada?.fresca) {
      return { respuesta: entrada.respuesta, estadoCache: "fresca" };
    }

    if (entrada) {
      this.dispararRefrescoEnSegundoPlano(tienda, fuente);
      if (this.tiendasConFallo.has(tienda)) {
        return { respuesta: { ...entrada.respuesta, stale: true }, estadoCache: "stale" };
      }
      return { respuesta: entrada.respuesta, estadoCache: "vencida" };
    }

    const respuesta = await this.cargarConSingleFlight(tienda, fuente);
    return { respuesta, estadoCache: "cargada" };
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
    const inicio = this.deps.reloj.ahora().getTime();
    let resultado;
    try {
      resultado = await fuente.obtenerTodos();
    } catch (error) {
      this.tiendasConFallo.add(tienda);
      this.deps.registro.error("puntos.carga.error", {
        tienda,
        error: mensajeDeError(error),
        reintentos: error instanceof FuentePuntosError ? error.reintentos : 0,
      });
      throw new PuntosNoDisponiblesError(tienda);
    }
    this.tiendasConFallo.delete(tienda);

    const { respuesta, invalidos, duplicados } = this.construirRespuesta(tienda, resultado.puntos);
    this.deps.cache.guardar(tienda, respuesta);
    this.registrarCarga(tienda, resultado.metricas, {
      total: respuesta.total,
      invalidos,
      duplicados,
      duracionMs: this.deps.reloj.ahora().getTime() - inicio,
    });
    return respuesta;
  }

  private registrarCarga(
    tienda: string,
    metricas: MetricasCargaPuntos,
    resumen: { total: number; invalidos: number; duplicados: number; duracionMs: number },
  ): void {
    this.deps.registro.info("puntos.carga", {
      tienda,
      paginas: metricas.paginas,
      total: resumen.total,
      invalidos: resumen.invalidos,
      duplicados: resumen.duplicados,
      costo: metricas.costo,
      duracionMs: resumen.duracionMs,
    });
  }

  private construirRespuesta(
    tienda: string,
    crudos: readonly DatosPuntoRecogida[],
  ): { respuesta: RespuestaPuntosDto; invalidos: number; duplicados: number } {
    const validos: PuntoRecogida[] = [];
    const gidsPorIdentificador = new Map<string, string[]>();
    let invalidos = 0;

    for (const crudo of crudos) {
      try {
        const punto = crearPuntoRecogida(crudo);
        const gids = gidsPorIdentificador.get(punto.id) ?? [];
        gids.push(punto.gid);
        gidsPorIdentificador.set(punto.id, gids);
        validos.push(punto);
      } catch (error) {
        if (!(error instanceof PuntoInvalidoError)) {
          throw error;
        }
        invalidos += 1;
        this.deps.registro.warn("puntos.invalido", {
          tienda,
          gid: crudo.gid,
          motivo: error.motivo,
        });
      }
    }

    let duplicados = 0;
    for (const [identificador, gids] of gidsPorIdentificador) {
      if (gids.length > 1) {
        duplicados += 1;
        this.deps.registro.warn("puntos.duplicado", { tienda, identificador, gids });
      }
    }

    validos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    const respuesta: RespuestaPuntosDto = {
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
    return { respuesta, invalidos, duplicados };
  }
}
