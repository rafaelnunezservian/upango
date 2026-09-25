import { describe, expect, it, vi } from "vitest";
import { obtenerEstadoConfiguracion } from "./obtenerEstadoConfiguracion.js";
import type { ConsultaConfiguracionTienda } from "../ports/consultaConfiguracionTienda.js";
import type { GatewayPersonalizaciones, PersonalizacionEntrega } from "../ports/gatewayPersonalizaciones.js";

const TIENDA = "mi-tienda.myshopify.com";
const API_KEY = "clave-de-la-app";

function crearConsultaFalsa(total: number, tipoResuelto: string | null): ConsultaConfiguracionTienda {
  return { contarPuntos: vi.fn(async () => ({ total, tipoResuelto })) };
}

function crearGatewayFalso(existentes: readonly PersonalizacionEntrega[]): GatewayPersonalizaciones {
  return {
    listarDeEstaApp: vi.fn(async () => existentes),
    crear: vi.fn(),
    activar: vi.fn(),
  };
}

describe("obtenerEstadoConfiguracion", () => {
  it("junta el total de puntos, el estado de las personalizaciones y los enlaces", async () => {
    const consulta = crearConsultaFalsa(12, "app--123--punto_recogida");
    const gateway = crearGatewayFalso([
      { id: "gid://shopify/DeliveryCustomization/1", handle: "ocultar-envios", activa: true },
    ]);

    const estado = await obtenerEstadoConfiguracion(TIENDA, {
      consulta,
      gateway,
      apiKey: API_KEY,
      habilitarSemilla: false,
    });

    expect(estado.puntos).toEqual({ total: 12, tipoResuelto: "app--123--punto_recogida" });
    expect(estado.personalizaciones).toEqual({
      "ocultar-envios": "activa",
      "renombrar-recogida": "inexistente",
    });
    expect(estado.enlaces.entradasPuntos).toBe(
      "shopify:admin/content/metaobjects/entries/app--123--punto_recogida",
    );
    expect(estado.enlaces.editorTemas).toBe(
      `https://${TIENDA}/admin/themes/current/editor?context=apps&activateAppId=${API_KEY}/selector-punto`,
    );
    expect(estado.enlaces.ajustesEnvio).toBe("shopify:admin/settings/shipping");
    expect(estado.enlaces.ajustesCheckout).toBe("shopify:admin/settings/checkout");
    expect(estado.tarifa.titulo).toBe("Recogida en punto de entrega");
    expect(estado.semillaHabilitada).toBe(false);
  });

  it("marca una personalización inactiva como 'inactiva', no 'inexistente'", async () => {
    const gateway = crearGatewayFalso([
      { id: "gid://shopify/DeliveryCustomization/1", handle: "renombrar-recogida", activa: false },
    ]);

    const estado = await obtenerEstadoConfiguracion(TIENDA, {
      consulta: crearConsultaFalsa(0, null),
      gateway,
      apiKey: API_KEY,
      habilitarSemilla: true,
    });

    expect(estado.personalizaciones["renombrar-recogida"]).toBe("inactiva");
    expect(estado.personalizaciones["ocultar-envios"]).toBe("inexistente");
  });

  it("usa un enlace genérico a metaobjetos si la definición todavía no existe", async () => {
    const estado = await obtenerEstadoConfiguracion(TIENDA, {
      consulta: crearConsultaFalsa(0, null),
      gateway: crearGatewayFalso([]),
      apiKey: API_KEY,
      habilitarSemilla: false,
    });

    expect(estado.puntos).toEqual({ total: 0, tipoResuelto: null });
    expect(estado.enlaces.entradasPuntos).toBe("shopify:admin/content/metaobjects");
  });
});
