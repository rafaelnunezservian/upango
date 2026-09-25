import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { Configuracion } from "../config/config.server.js";
import { cargarConfiguracionOSalir } from "../config/config.server.js";
import type { Registro } from "../application/ports/registro.js";
import type { Reloj } from "../application/ports/reloj.js";
import { crearSessionStorage } from "../infrastructure/sesiones/fabricaSessionStorage.server.js";
import { RegistroJson } from "../infrastructure/observabilidad/registroJson.server.js";
import { RelojSistema } from "../infrastructure/observabilidad/relojSistema.server.js";

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
}

async function construirContenedor(): Promise<Contenedor> {
  const config = cargarConfiguracionOSalir();
  const registro: Registro = new RegistroJson(config.logLevel);
  const reloj: Reloj = new RelojSistema();
  const sessionStorage = await crearSessionStorage(config);

  return Object.freeze({ config, sessionStorage, registro, reloj });
}

export const contenedor: Contenedor = await construirContenedor();
