import { describe, expect, it, vi } from "vitest";
import { GatewayPersonalizacionesShopify } from "./gatewayPersonalizacionesShopify.server.js";

const API_KEY = "esta-app-api-key";

function respuestaGraphql(cuerpo: unknown) {
  return { json: async () => cuerpo };
}

function nodo(handle: string, appKey: string, enabled: boolean, id = `gid://shopify/DeliveryCustomization/${handle}`) {
  return { id, title: handle, enabled, shopifyFunction: { handle, appKey } };
}

describe("GatewayPersonalizacionesShopify", () => {
  describe("listarDeEstaApp", () => {
    it("filtra las delivery customizations por appKey (solo las de esta app)", async () => {
      const graphql = vi.fn().mockResolvedValue(
        respuestaGraphql({
          data: {
            deliveryCustomizations: {
              nodes: [
                nodo("ocultar-envios", API_KEY, true),
                nodo("otra-app", "otra-api-key", true),
                nodo("renombrar-recogida", API_KEY, false),
              ],
            },
          },
        }),
      );

      const gateway = new GatewayPersonalizacionesShopify(graphql as never, API_KEY);
      const resultado = await gateway.listarDeEstaApp();

      expect(resultado).toEqual([
        { id: "gid://shopify/DeliveryCustomization/ocultar-envios", handle: "ocultar-envios", activa: true },
        { id: "gid://shopify/DeliveryCustomization/renombrar-recogida", handle: "renombrar-recogida", activa: false },
      ]);
    });

    it("devuelve la lista vacía si no hay ninguna de esta app", async () => {
      const graphql = vi.fn().mockResolvedValue(
        respuestaGraphql({
          data: { deliveryCustomizations: { nodes: [nodo("de-otra-app", "otra-api-key", true)] } },
        }),
      );

      const gateway = new GatewayPersonalizacionesShopify(graphql as never, API_KEY);

      await expect(gateway.listarDeEstaApp()).resolves.toEqual([]);
    });
  });

  describe("crear", () => {
    it("envía functionHandle, título y enabled:true, y devuelve el id creado", async () => {
      const graphql = vi.fn().mockResolvedValue(
        respuestaGraphql({
          data: {
            deliveryCustomizationCreate: {
              deliveryCustomization: { id: "gid://shopify/DeliveryCustomization/1" },
              userErrors: [],
            },
          },
        }),
      );

      const gateway = new GatewayPersonalizacionesShopify(graphql as never, API_KEY);
      const resultado = await gateway.crear("ocultar-envios", "Puntos de recogida · ocultar envíos");

      expect(graphql).toHaveBeenCalledWith(
        expect.stringContaining("deliveryCustomizationCreate"),
        {
          variables: {
            deliveryCustomization: {
              functionHandle: "ocultar-envios",
              title: "Puntos de recogida · ocultar envíos",
              enabled: true,
            },
          },
        },
      );
      expect(resultado).toEqual({ id: "gid://shopify/DeliveryCustomization/1", userErrors: [] });
    });

    it("propaga los userErrors sin lanzar", async () => {
      const graphql = vi.fn().mockResolvedValue(
        respuestaGraphql({
          data: {
            deliveryCustomizationCreate: {
              deliveryCustomization: null,
              userErrors: [{ field: ["deliveryCustomization", "title"], message: "límite alcanzado" }],
            },
          },
        }),
      );

      const gateway = new GatewayPersonalizacionesShopify(graphql as never, API_KEY);
      const resultado = await gateway.crear("ocultar-envios", "Título");

      expect(resultado).toEqual({
        id: null,
        userErrors: [{ field: ["deliveryCustomization", "title"], message: "límite alcanzado" }],
      });
    });
  });

  describe("activar", () => {
    it("activa por id y devuelve los userErrors si los hay", async () => {
      const graphql = vi.fn().mockResolvedValue(
        respuestaGraphql({
          data: {
            deliveryCustomizationUpdate: {
              deliveryCustomization: { id: "gid://shopify/DeliveryCustomization/1" },
              userErrors: [],
            },
          },
        }),
      );

      const gateway = new GatewayPersonalizacionesShopify(graphql as never, API_KEY);
      const resultado = await gateway.activar("gid://shopify/DeliveryCustomization/1");

      expect(graphql).toHaveBeenCalledWith(
        expect.stringContaining("deliveryCustomizationUpdate"),
        {
          variables: {
            id: "gid://shopify/DeliveryCustomization/1",
            deliveryCustomization: { enabled: true },
          },
        },
      );
      expect(resultado).toEqual({ userErrors: [] });
    });
  });
});
