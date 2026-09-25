import { TITULO_TARIFA_RECOGIDA } from "@puntos-recogida/contratos";
import type { ConsultaConfiguracionTienda } from "../ports/consultaConfiguracionTienda.js";
import type { GatewayPersonalizaciones } from "../ports/gatewayPersonalizaciones.js";
import { PERSONALIZACIONES_ENTREGA } from "./activarPersonalizacionesEntrega.js";

/** Handle de la theme app extension del embed "Punto de recogida" (§17.1). */
const HANDLE_APP_EMBED = "selector-punto";

export type EstadoPersonalizacion = "activa" | "inactiva" | "inexistente";

export interface EnlacesConfiguracion {
  /** Deep link (App Bridge) a las entradas del metaobjeto (paso "Puntos", FR-056). */
  readonly entradasPuntos: string;
  /** URL externa al editor de temas con el embed preseleccionado (paso "App embed", FR-058). */
  readonly editorTemas: string;
  /** Deep link (App Bridge) a Configuración → Envío y entrega (paso "Tarifa", FR-059). */
  readonly ajustesEnvio: string;
  /** Deep link (App Bridge) a Configuración → Checkout (paso "Bloque de pedido", FR-060). */
  readonly ajustesCheckout: string;
}

export interface EstadoConfiguracion {
  readonly puntos: { readonly total: number; readonly tipoResuelto: string | null };
  /** Estado de cada delivery customization de esta app, indexado por `handle`. */
  readonly personalizaciones: Readonly<Record<string, EstadoPersonalizacion>>;
  readonly enlaces: EnlacesConfiguracion;
  readonly tarifa: { readonly titulo: string };
  readonly semillaHabilitada: boolean;
}

export interface DependenciasObtenerEstadoConfiguracion {
  readonly consulta: ConsultaConfiguracionTienda;
  readonly gateway: GatewayPersonalizaciones;
  readonly apiKey: string;
  readonly habilitarSemilla: boolean;
}

/**
 * Caso de uso del FR-055 a FR-060 (US-5.1 a US-5.5): junta el conteo de
 * puntos, el estado real de las 2 delivery customizations de esta app y los
 * enlaces de cada paso de configuración en un único `EstadoConfiguracion`
 * que consume la página de admin (`app/routes/app._index.tsx`).
 */
export async function obtenerEstadoConfiguracion(
  tienda: string,
  { consulta, gateway, apiKey, habilitarSemilla }: DependenciasObtenerEstadoConfiguracion,
): Promise<EstadoConfiguracion> {
  const [puntos, existentes] = await Promise.all([
    consulta.contarPuntos(),
    gateway.listarDeEstaApp(),
  ]);

  const personalizaciones: Record<string, EstadoPersonalizacion> = {};
  for (const { handle } of PERSONALIZACIONES_ENTREGA) {
    const existente = existentes.find((personalizacion) => personalizacion.handle === handle);
    personalizaciones[handle] = !existente
      ? "inexistente"
      : existente.activa
        ? "activa"
        : "inactiva";
  }

  return {
    puntos,
    personalizaciones,
    enlaces: {
      entradasPuntos: puntos.tipoResuelto
        ? `shopify:admin/content/metaobjects/entries/${puntos.tipoResuelto}`
        : "shopify:admin/content/metaobjects",
      editorTemas: `https://${tienda}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/${HANDLE_APP_EMBED}`,
      ajustesEnvio: "shopify:admin/settings/shipping",
      ajustesCheckout: "shopify:admin/settings/checkout",
    },
    tarifa: { titulo: TITULO_TARIFA_RECOGIDA },
    semillaHabilitada: habilitarSemilla,
  };
}
