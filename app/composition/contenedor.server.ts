import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import type { Configuracion } from "../config/config.server.js";
import { cargarConfiguracionOSalir } from "../config/config.server.js";
import type { Registro } from "../application/ports/registro.js";
import type { Reloj } from "../application/ports/reloj.js";
import type { EscritorPuntos } from "../application/ports/escritorPuntos.js";
import type { FuentePuntos } from "../application/ports/fuentePuntos.js";
import type { CachePuntos } from "../application/ports/cachePuntos.js";
import { crearSessionStorage } from "../infrastructure/sesiones/fabricaSessionStorage.server.js";
import { RegistroJson } from "../infrastructure/observabilidad/registroJson.server.js";
import { RelojSistema } from "../infrastructure/observabilidad/relojSistema.server.js";
import { EscritorPuntosShopify } from "../infrastructure/shopify/escritorPuntosShopify.server.js";
import { FuentePuntosShopify } from "../infrastructure/shopify/fuentePuntosShopify.server.js";
import { CachePuntosMemoria } from "../infrastructure/cache/cachePuntosMemoria.server.js";
import { ListarPuntosRecogida } from "../application/use-cases/listarPuntosRecogida.js";

/**
 * Composition root del backend (constitución I, DIP): el único lugar que
 * instancia infraestructura y la conecta con los puertos que necesitan los
 * casos de uso. `shopify.server.ts` y las rutas solo consumen `contenedor`,
 * nunca instancian adaptadores directamente.
 */
export interface Contenedor {
  readonly config: Configuracion;
  readonly sessionStorage: SessionStorage;
  readonly registro: Registro;
  readonly reloj: Reloj;
  readonly cachePuntos: CachePuntos;
  readonly listarPuntosRecogida: ListarPuntosRecogida;
  /** Fábrica por petición (T042): solo la usa la herramienta de semilla (FR-005). */
  readonly crearEscritorPuntos: (admin: AdminGraphqlClient) => EscritorPuntos;
  /** Fábrica por petición (T048): liga la lectura de puntos al cliente Admin de la tienda. */
  readonly crearFuentePuntos: (admin: AdminGraphqlClient) => FuentePuntos;
}

async function construirContenedor(): Promise<Contenedor> {
  const config = cargarConfiguracionOSalir();
  const registro: Registro = new RegistroJson(config.logLevel);
  const reloj: Reloj = new RelojSistema();
  const sessionStorage = await crearSessionStorage(config);
  const cachePuntos: CachePuntos = new CachePuntosMemoria(
    reloj,
    config.puntosCacheTtlSegundos,
    config.puntosCacheStaleMaxSegundos,
  );
  const listarPuntosRecogida = new ListarPuntosRecogida({ cache: cachePuntos, registro, reloj });
  const crearEscritorPuntos = (admin: AdminGraphqlClient): EscritorPuntos =>
    new EscritorPuntosShopify(admin);
  const crearFuentePuntos = (admin: AdminGraphqlClient): FuentePuntos =>
    new FuentePuntosShopify(admin, registro, config.puntosTamanoPagina);

  return Object.freeze({
    config,
    sessionStorage,
    registro,
    reloj,
    cachePuntos,
    listarPuntosRecogida,
    crearEscritorPuntos,
    crearFuentePuntos,
  });
}

export const contenedor: Contenedor = await construirContenedor();
