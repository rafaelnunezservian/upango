import { describe, expect, it, vi } from "vitest";
import {
  activarPersonalizacionesEntrega,
  PERSONALIZACIONES_ENTREGA,
} from "./activarPersonalizacionesEntrega.js";
import type {
  GatewayPersonalizaciones,
  PersonalizacionEntrega,
  ResultadoActivarPersonalizacion,
  ResultadoCrearPersonalizacion,
} from "../ports/gatewayPersonalizaciones.js";
import type { Registro } from "../ports/registro.js";

function crearRegistroFalso(): Registro {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function crearGatewayFalso(
  existentes: readonly PersonalizacionEntrega[],
  opciones: {
    crear?: (handle: string, titulo: string) => Promise<ResultadoCrearPersonalizacion>;
    activar?: (id: string) => Promise<ResultadoActivarPersonalizacion>;
  } = {},
): GatewayPersonalizaciones {
  return {
    listarDeEstaApp: vi.fn(async () => existentes),
    crear:
      opciones.crear ??
      vi.fn(async (handle: string) => ({
        id: `gid://shopify/DeliveryCustomization/${handle}`,
        userErrors: [],
      })),
    activar: opciones.activar ?? vi.fn(async () => ({ userErrors: [] })),
  };
}

describe("activarPersonalizacionesEntrega", () => {
  it("crea las 2 delivery customizations cuando no existe ninguna", async () => {
    const gateway = crearGatewayFalso([]);

    const resultado = await activarPersonalizacionesEntrega({
      gateway,
      registro: crearRegistroFalso(),
    });

    expect(resultado).toEqual({ creadas: 2, activadas: 0, errores: [] });
    expect(gateway.crear).toHaveBeenCalledTimes(2);
    for (const { handle, titulo } of PERSONALIZACIONES_ENTREGA) {
      expect(gateway.crear).toHaveBeenCalledWith(handle, titulo);
    }
    expect(gateway.activar).not.toHaveBeenCalled();
  });

  it("activa las que existen pero están inactivas, sin volver a crearlas", async () => {
    const existentes: PersonalizacionEntrega[] = PERSONALIZACIONES_ENTREGA.map(({ handle }) => ({
      id: `gid://shopify/DeliveryCustomization/${handle}`,
      handle,
      activa: false,
    }));
    const gateway = crearGatewayFalso(existentes);

    const resultado = await activarPersonalizacionesEntrega({
      gateway,
      registro: crearRegistroFalso(),
    });

    expect(resultado).toEqual({ creadas: 0, activadas: 2, errores: [] });
    expect(gateway.crear).not.toHaveBeenCalled();
    expect(gateway.activar).toHaveBeenCalledTimes(2);
  });

  it("no hace nada con las que ya están activas (idempotente)", async () => {
    const existentes: PersonalizacionEntrega[] = PERSONALIZACIONES_ENTREGA.map(({ handle }) => ({
      id: `gid://shopify/DeliveryCustomization/${handle}`,
      handle,
      activa: true,
    }));
    const gateway = crearGatewayFalso(existentes);

    const resultado = await activarPersonalizacionesEntrega({
      gateway,
      registro: crearRegistroFalso(),
    });

    expect(resultado).toEqual({ creadas: 0, activadas: 0, errores: [] });
    expect(gateway.crear).not.toHaveBeenCalled();
    expect(gateway.activar).not.toHaveBeenCalled();
  });

  it("ejecutar dos veces seguidas no duplica ni reactiva de más", async () => {
    let existentes: PersonalizacionEntrega[] = [];
    const gateway: GatewayPersonalizaciones = {
      listarDeEstaApp: vi.fn(async () => existentes),
      crear: vi.fn(async (handle: string) => {
        existentes = [...existentes, { id: `gid://shopify/DeliveryCustomization/${handle}`, handle, activa: true }];
        return { id: `gid://shopify/DeliveryCustomization/${handle}`, userErrors: [] };
      }),
      activar: vi.fn(async () => ({ userErrors: [] })),
    };

    const primera = await activarPersonalizacionesEntrega({ gateway, registro: crearRegistroFalso() });
    const segunda = await activarPersonalizacionesEntrega({ gateway, registro: crearRegistroFalso() });

    expect(primera).toEqual({ creadas: 2, activadas: 0, errores: [] });
    expect(segunda).toEqual({ creadas: 0, activadas: 0, errores: [] });
    expect(gateway.crear).toHaveBeenCalledTimes(2);
  });

  it("recolecta los userErrors de Shopify sin lanzar (EC-22: 25 personalizaciones existentes)", async () => {
    const otrasPersonalizaciones: PersonalizacionEntrega[] = Array.from({ length: 25 }, (_, i) => ({
      id: `gid://shopify/DeliveryCustomization/otra-${i}`,
      handle: `otra-${i}`,
      activa: true,
    }));
    const gateway = crearGatewayFalso(otrasPersonalizaciones, {
      crear: vi.fn(async () => ({
        id: null,
        userErrors: [{ field: null, message: "Ya existen 25 personalizaciones de entrega." }],
      })),
    });

    const resultado = await activarPersonalizacionesEntrega({
      gateway,
      registro: crearRegistroFalso(),
    });

    expect(resultado.creadas).toBe(0);
    expect(resultado.errores).toHaveLength(2);
    expect(resultado.errores[0]).toEqual({
      field: null,
      message: "Ya existen 25 personalizaciones de entrega.",
    });
  });

  it("recolecta los userErrors de activar sin lanzar", async () => {
    const existentes: PersonalizacionEntrega[] = [
      { id: "gid://shopify/DeliveryCustomization/ocultar-envios", handle: "ocultar-envios", activa: false },
      { id: "gid://shopify/DeliveryCustomization/renombrar-recogida", handle: "renombrar-recogida", activa: false },
    ];
    const gateway = crearGatewayFalso(existentes, {
      activar: vi.fn(async () => ({ userErrors: [{ field: null, message: "no se pudo activar" }] })),
    });

    const resultado = await activarPersonalizacionesEntrega({
      gateway,
      registro: crearRegistroFalso(),
    });

    expect(resultado.activadas).toBe(0);
    expect(resultado.errores).toHaveLength(2);
  });
});
