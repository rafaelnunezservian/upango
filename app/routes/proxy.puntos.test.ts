import { describe, expect, it, vi, beforeEach } from "vitest";
import { Session } from "@shopify/shopify-api";
import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";
import { PuntosNoDisponiblesError } from "../domain/errores.js";

vi.mock("../shopify.server.js", () => ({
  authenticate: { public: { appProxy: vi.fn() } },
}));

const { authenticate } = await import("../shopify.server.js");
const { contenedor } = await import("../composition/contenedor.server.js");
const { loader } = await import("./proxy.puntos.js");

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

function peticion(): Request {
  return new Request("https://example.com/proxy/puntos?shop=tienda.myshopify.com");
}

describe("proxy.puntos loader", () => {
  beforeEach(() => {
    vi.mocked(authenticate.public.appProxy).mockReset();
    vi.spyOn(contenedor.listarPuntosRecogida, "ejecutar").mockReset();
  });

  it("responde 404 con APP_NO_INSTALADA si no hay sesión (FR-012)", async () => {
    vi.mocked(authenticate.public.appProxy).mockResolvedValue({
      session: undefined,
      admin: undefined,
    } as never);

    const respuesta = await loader({ request: peticion() } as never);

    expect(respuesta.status).toBe(404);
    const cuerpo = await respuesta.json();
    expect(cuerpo).toEqual({
      error: "APP_NO_INSTALADA",
      mensaje: "La app no está instalada en esta tienda.",
    });
  });

  it("responde 200 con el JSON del CT-03 y el Cache-Control correcto", async () => {
    const sesion = crearSesion("tienda.myshopify.com");
    vi.mocked(authenticate.public.appProxy).mockResolvedValue({
      session: sesion,
      admin: { graphql: vi.fn() },
    } as never);
    const dto: RespuestaPuntosDto = {
      version: 1,
      generadoEn: "2026-09-25T10:00:00.000Z",
      stale: false,
      total: 0,
      puntos: [],
    };
    vi.spyOn(contenedor.listarPuntosRecogida, "ejecutar").mockResolvedValue(dto);

    const respuesta = await loader({ request: peticion() } as never);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Cache-Control")).toBe("public, max-age=60");
    await expect(respuesta.json()).resolves.toEqual(dto);
  });

  it("responde 502 con PUNTOS_NO_DISPONIBLES si el caso de uso falla por falta de copia (FR-016)", async () => {
    const sesion = crearSesion("tienda.myshopify.com");
    vi.mocked(authenticate.public.appProxy).mockResolvedValue({
      session: sesion,
      admin: { graphql: vi.fn() },
    } as never);
    vi.spyOn(contenedor.listarPuntosRecogida, "ejecutar").mockRejectedValue(
      new PuntosNoDisponiblesError("tienda.myshopify.com"),
    );

    const respuesta = await loader({ request: peticion() } as never);

    expect(respuesta.status).toBe(502);
    await expect(respuesta.json()).resolves.toEqual({
      error: "PUNTOS_NO_DISPONIBLES",
      mensaje: "No se pudieron obtener los puntos de recogida.",
    });
  });

  it("responde 500 con ERROR_INTERNO ante un error inesperado", async () => {
    const sesion = crearSesion("tienda.myshopify.com");
    vi.mocked(authenticate.public.appProxy).mockResolvedValue({
      session: sesion,
      admin: { graphql: vi.fn() },
    } as never);
    vi.spyOn(contenedor.listarPuntosRecogida, "ejecutar").mockRejectedValue(new Error("boom"));

    const respuesta = await loader({ request: peticion() } as never);

    expect(respuesta.status).toBe(500);
    await expect(respuesta.json()).resolves.toEqual({
      error: "ERROR_INTERNO",
      mensaje: "Error interno.",
    });
  });
});
