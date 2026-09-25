import { describe, expect, it, vi } from "vitest";
import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";
import { ListarPuntosRecogida } from "./listarPuntosRecogida.js";
import type { CachePuntos, EntradaCachePuntos } from "../ports/cachePuntos.js";
import type { FuentePuntos } from "../ports/fuentePuntos.js";
import type { Registro } from "../ports/registro.js";
import type { Reloj } from "../ports/reloj.js";
import type { DatosPuntoRecogida } from "../../domain/puntoRecogida.js";
import { PuntosNoDisponiblesError } from "../../domain/errores.js";

function crearRegistroFalso(): Registro {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function crearRelojFalso(): Reloj {
  return { ahora: () => new Date("2026-09-25T10:00:00.000Z") };
}

function crearCacheFalso(entrada?: EntradaCachePuntos): CachePuntos & {
  guardadas: RespuestaPuntosDto[];
} {
  const guardadas: RespuestaPuntosDto[] = [];
  return {
    guardadas,
    leer: vi.fn(() => entrada),
    guardar: vi.fn((_tienda: string, respuesta: RespuestaPuntosDto) => {
      guardadas.push(respuesta);
    }),
    borrar: vi.fn(),
  };
}

const PUNTO_A: DatosPuntoRecogida = {
  id: "PR-BCN-002",
  gid: "gid://shopify/Metaobject/2",
  nombre: "Librería Gràcia",
  direccion: "Carrer Gran de Gràcia 10, 08012 Barcelona",
  direccionCorta: "Gran de Gràcia 10, BCN",
  lat: 41.3989,
  lng: 2.1566,
};

const PUNTO_B: DatosPuntoRecogida = {
  id: "PR-MAD-001",
  gid: "gid://shopify/Metaobject/1",
  nombre: "Kiosko Sol",
  direccion: "Puerta del Sol 1, 28013 Madrid",
  direccionCorta: "Pta. del Sol 1, Madrid",
  lat: 40.416775,
  lng: -3.70379,
};

const PUNTO_INVALIDO: DatosPuntoRecogida = {
  ...PUNTO_A,
  id: "",
};

function fuenteCon(puntos: readonly DatosPuntoRecogida[]): FuentePuntos {
  return { obtenerTodos: vi.fn(async () => puntos) };
}

describe("ListarPuntosRecogida", () => {
  it("devuelve la copia fresca de la caché sin llamar a la fuente", async () => {
    const cache = crearCacheFalso({
      respuesta: { version: 1, generadoEn: "x", stale: false, total: 0, puntos: [] },
      fresca: true,
    });
    const fuente = fuenteCon([PUNTO_A]);
    const caso = new ListarPuntosRecogida({
      cache,
      registro: crearRegistroFalso(),
      reloj: crearRelojFalso(),
    });

    const respuesta = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(respuesta.stale).toBe(false);
    expect(fuente.obtenerTodos).not.toHaveBeenCalled();
  });

  it("devuelve la copia vencida marcada stale y dispara un refresco en segundo plano", async () => {
    const respuestaVieja: RespuestaPuntosDto = {
      version: 1,
      generadoEn: "vieja",
      stale: false,
      total: 1,
      puntos: [],
    };
    const cache = crearCacheFalso({ respuesta: respuestaVieja, fresca: false });
    let resolverFuente: (() => void) | undefined;
    const fuente: FuentePuntos = {
      obtenerTodos: vi.fn(
        () =>
          new Promise<readonly DatosPuntoRecogida[]>((resolve) => {
            resolverFuente = () => resolve([PUNTO_A]);
          }),
      ),
    };
    const caso = new ListarPuntosRecogida({
      cache,
      registro: crearRegistroFalso(),
      reloj: crearRelojFalso(),
    });

    const respuesta = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(respuesta).toEqual({ ...respuestaVieja, stale: true });
    expect(fuente.obtenerTodos).toHaveBeenCalledTimes(1);

    resolverFuente?.();
    await vi.waitFor(() => expect(cache.guardar).toHaveBeenCalled());
  });

  it("no dispara un segundo refresco en segundo plano si ya hay uno en curso para la misma tienda", async () => {
    const respuestaVieja: RespuestaPuntosDto = {
      version: 1,
      generadoEn: "vieja",
      stale: false,
      total: 1,
      puntos: [],
    };
    const cache = crearCacheFalso({ respuesta: respuestaVieja, fresca: false });
    const fuente: FuentePuntos = {
      obtenerTodos: vi.fn(() => new Promise<readonly DatosPuntoRecogida[]>(() => {})),
    };
    const caso = new ListarPuntosRecogida({
      cache,
      registro: crearRegistroFalso(),
      reloj: crearRelojFalso(),
    });

    await caso.ejecutar("tienda.myshopify.com", fuente);
    await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(fuente.obtenerTodos).toHaveBeenCalledTimes(1);
  });

  it("sin copia en caché, carga desde la fuente, ordena, descarta inválidos y guarda el resultado", async () => {
    const cache = crearCacheFalso(undefined);
    const fuente = fuenteCon([PUNTO_A, PUNTO_B, PUNTO_INVALIDO]);
    const registro = crearRegistroFalso();
    const caso = new ListarPuntosRecogida({ cache, registro, reloj: crearRelojFalso() });

    const respuesta = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(respuesta.stale).toBe(false);
    expect(respuesta.total).toBe(2);
    expect(respuesta.puntos.map((p) => p.id)).toEqual(["PR-MAD-001", "PR-BCN-002"]);
    expect(registro.warn).toHaveBeenCalledWith(
      "puntos.invalido_descartado",
      expect.objectContaining({ tienda: "tienda.myshopify.com" }),
    );
    expect(cache.guardar).toHaveBeenCalledWith("tienda.myshopify.com", respuesta);
  });

  it("advierte de identificadores duplicados sin descartar los puntos", async () => {
    const cache = crearCacheFalso(undefined);
    const fuente = fuenteCon([PUNTO_A, { ...PUNTO_A, gid: "gid://shopify/Metaobject/99" }]);
    const registro = crearRegistroFalso();
    const caso = new ListarPuntosRecogida({ cache, registro, reloj: crearRelojFalso() });

    const respuesta = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(respuesta.total).toBe(2);
    expect(registro.warn).toHaveBeenCalledWith(
      "puntos.identificador_duplicado",
      expect.objectContaining({ id: PUNTO_A.id }),
    );
  });

  it("unifica cargas simultáneas de la misma tienda sin copia en caché (single-flight)", async () => {
    const cache = crearCacheFalso(undefined);
    const fuente = fuenteCon([PUNTO_A]);
    const caso = new ListarPuntosRecogida({
      cache,
      registro: crearRegistroFalso(),
      reloj: crearRelojFalso(),
    });

    const [a, b] = await Promise.all([
      caso.ejecutar("tienda.myshopify.com", fuente),
      caso.ejecutar("tienda.myshopify.com", fuente),
    ]);

    expect(fuente.obtenerTodos).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("lanza PuntosNoDisponiblesError si la fuente falla y no hay copia de respaldo", async () => {
    const cache = crearCacheFalso(undefined);
    const fuente: FuentePuntos = {
      obtenerTodos: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const registro = crearRegistroFalso();
    const caso = new ListarPuntosRecogida({ cache, registro, reloj: crearRelojFalso() });

    await expect(caso.ejecutar("tienda.myshopify.com", fuente)).rejects.toThrow(
      PuntosNoDisponiblesError,
    );
    expect(registro.error).toHaveBeenCalledWith(
      "puntos.carga_fallida",
      expect.objectContaining({ tienda: "tienda.myshopify.com" }),
    );
    expect(cache.guardar).not.toHaveBeenCalled();
  });
});
