import { describe, expect, it, vi, beforeEach } from "vitest";
import { Session } from "@shopify/shopify-api";
import { es } from "../i18n/es.js";

vi.mock("../shopify.server.js", () => ({
  authenticate: { admin: vi.fn() },
}));

const { authenticate } = await import("../shopify.server.js");
const { loader, action } = await import("./app._index.js");

function crearSesion(shop: string): Session {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: "estado",
    isOnline: false,
    accessToken: "token",
    scope: "write_delivery_customizations,write_app_proxy",
  });
}

function respuestaGraphql(cuerpo: unknown) {
  return { json: async () => cuerpo };
}

function peticion(method: "GET" | "POST" = "GET", formData?: FormData): Request {
  return new Request("https://example.com/app", {
    method,
    ...(formData ? { body: formData } : {}),
  });
}

describe("app._index loader", () => {
  beforeEach(() => {
    vi.mocked(authenticate.admin).mockReset();
  });

  it("responde con error (para el banner con reintento) si la carga del estado falla", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: crearSesion("tienda.myshopify.com"),
      admin: { graphql: vi.fn().mockRejectedValue(new Error("boom")) },
    } as never);

    const resultado = await loader({ request: peticion() } as never);

    expect(resultado).toEqual({ estado: null, error: es.errores.cargaFallida });
  });

  it("responde con el estado de configuración si la carga tiene éxito", async () => {
    const graphql = vi.fn(async (query: string) => {
      if (query.includes("DefinicionPuntosRecogida")) {
        return respuestaGraphql({
          data: { metaobjectDefinitionByType: { type: "app--1--punto_recogida", metaobjectsCount: 3 } },
        });
      }
      if (query.includes("DeliveryCustomizationsDeEstaApp")) {
        return respuestaGraphql({ data: { deliveryCustomizations: { nodes: [] } } });
      }
      throw new Error(`query inesperada: ${query}`);
    });
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: crearSesion("tienda.myshopify.com"),
      admin: { graphql },
    } as never);

    const resultado = await loader({ request: peticion() } as never);

    expect(resultado.error).toBeNull();
    expect(resultado.estado?.puntos).toEqual({ total: 3, tipoResuelto: "app--1--punto_recogida" });
    expect(resultado.estado?.personalizaciones).toEqual({
      "ocultar-envios": "inexistente",
      "renombrar-recogida": "inexistente",
    });
  });
});

describe("app._index action", () => {
  beforeEach(() => {
    vi.mocked(authenticate.admin).mockReset();
  });

  it("devuelve los userErrors de Shopify al activar (para el banner de errores)", async () => {
    const graphql = vi.fn(async (query: string) => {
      if (query.includes("DeliveryCustomizationsDeEstaApp")) {
        return respuestaGraphql({ data: { deliveryCustomizations: { nodes: [] } } });
      }
      if (query.includes("crearPersonalizacionEntrega")) {
        return respuestaGraphql({
          data: {
            deliveryCustomizationCreate: {
              deliveryCustomization: null,
              userErrors: [{ field: null, message: "Ya existen 25 personalizaciones de entrega." }],
            },
          },
        });
      }
      throw new Error(`query inesperada: ${query}`);
    });
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: crearSesion("tienda.myshopify.com"),
      admin: { graphql },
    } as never);

    const formData = new FormData();
    formData.set("intencion", "activar");

    const resultado = await action({ request: peticion("POST", formData) } as never);

    expect(resultado).toEqual({
      activado: {
        creadas: 0,
        activadas: 0,
        errores: [
          { field: null, message: "Ya existen 25 personalizaciones de entrega." },
          { field: null, message: "Ya existen 25 personalizaciones de entrega." },
        ],
      },
    });
  });

  it("activa sin errores cuando Shopify crea las 2 personalizaciones", async () => {
    const graphql = vi.fn(async (query: string) => {
      if (query.includes("DeliveryCustomizationsDeEstaApp")) {
        return respuestaGraphql({ data: { deliveryCustomizations: { nodes: [] } } });
      }
      if (query.includes("crearPersonalizacionEntrega")) {
        return respuestaGraphql({
          data: {
            deliveryCustomizationCreate: {
              deliveryCustomization: { id: "gid://shopify/DeliveryCustomization/1" },
              userErrors: [],
            },
          },
        });
      }
      throw new Error(`query inesperada: ${query}`);
    });
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: crearSesion("tienda.myshopify.com"),
      admin: { graphql },
    } as never);

    const formData = new FormData();
    formData.set("intencion", "activar");

    const resultado = await action({ request: peticion("POST", formData) } as never);

    expect(resultado).toEqual({ activado: { creadas: 2, activadas: 0, errores: [] } });
  });

  it("responde 400 ante una intención desconocida", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: crearSesion("tienda.myshopify.com"),
      admin: { graphql: vi.fn() },
    } as never);

    const formData = new FormData();
    formData.set("intencion", "otra-cosa");

    await expect(action({ request: peticion("POST", formData) } as never)).rejects.toMatchObject({
      status: 400,
    });
  });
});
