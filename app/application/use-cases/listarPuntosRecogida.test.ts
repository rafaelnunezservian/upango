import { describe, expect, it, vi } from "vitest";
import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";
import { ListarPuntosRecogida } from "./listarPuntosRecogida.js";
import type { CachePuntos, EntradaCachePuntos } from "../ports/cachePuntos.js";
import type { FuentePuntos, ResultadoFuentePuntos } from "../ports/fuentePuntos.js";
import { FuentePuntosError } from "../ports/fuentePuntos.js";
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

const METRICAS = { paginas: 1, costo: 12, reintentos: 0 };

function resultado(puntos: readonly DatosPuntoRecogida[]): ResultadoFuentePuntos {
  return { puntos, metricas: METRICAS };
}

function fuenteCon(puntos: readonly DatosPuntoRecogida[]): FuentePuntos {
  return { obtenerTodos: vi.fn(async () => resultado(puntos)) };
}

const RESPUESTA_VIEJA: RespuestaPuntosDto = {
  version: 1,
  generadoEn: "vieja",
  stale: false,
  total: 1,
  puntos: [],
};

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

    const { respuesta, estadoCache } = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(respuesta.stale).toBe(false);
    expect(estadoCache).toBe("fresca");
    expect(fuente.obtenerTodos).not.toHaveBeenCalled();
  });

  it("devuelve la copia vencida sin marcar stale y dispara un refresco en segundo plano (SWR)", async () => {
    const cache = crearCacheFalso({ respuesta: RESPUESTA_VIEJA, fresca: false });
    let resolverFuente: (() => void) | undefined;
    const fuente: FuentePuntos = {
      obtenerTodos: vi.fn(
        () =>
          new Promise<ResultadoFuentePuntos>((resolve) => {
            resolverFuente = () => resolve(resultado([PUNTO_A]));
          }),
      ),
    };
    const caso = new ListarPuntosRecogida({
      cache,
      registro: crearRegistroFalso(),
      reloj: crearRelojFalso(),
    });

    const { respuesta, estadoCache } = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(respuesta).toEqual(RESPUESTA_VIEJA);
    expect(estadoCache).toBe("vencida");
    expect(fuente.obtenerTodos).toHaveBeenCalledTimes(1);

    resolverFuente?.();
    await vi.waitFor(() => expect(cache.guardar).toHaveBeenCalled());
  });

  it("marca stale: true la copia vencida solo mientras Shopify falla (stale-if-error)", async () => {
    const cache = crearCacheFalso({ respuesta: RESPUESTA_VIEJA, fresca: false });
    const obtenerTodos = vi
      .fn<FuentePuntos["obtenerTodos"]>()
      .mockRejectedValueOnce(new Error("Shopify caído"))
      .mockResolvedValue(resultado([PUNTO_A]));
    const fuente: FuentePuntos = { obtenerTodos };
    const registro = crearRegistroFalso();
    const caso = new ListarPuntosRecogida({ cache, registro, reloj: crearRelojFalso() });

    const primera = await caso.ejecutar("tienda.myshopify.com", fuente);
    expect(primera).toEqual({ respuesta: RESPUESTA_VIEJA, estadoCache: "vencida" });
    await vi.waitFor(() =>
      expect(registro.error).toHaveBeenCalledWith("puntos.carga.error", expect.anything()),
    );
    // Deja terminar el `finally` del refresco fallido para que el siguiente pueda arrancar.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const segunda = await caso.ejecutar("tienda.myshopify.com", fuente);
    expect(segunda).toEqual({ respuesta: { ...RESPUESTA_VIEJA, stale: true }, estadoCache: "stale" });
    await vi.waitFor(() => expect(cache.guardar).toHaveBeenCalled());

    const tercera = await caso.ejecutar("tienda.myshopify.com", fuente);
    expect(tercera.estadoCache).toBe("vencida");
    expect(tercera.respuesta.stale).toBe(false);
  });

  it("no dispara un segundo refresco en segundo plano si ya hay uno en curso para la misma tienda", async () => {
    const cache = crearCacheFalso({ respuesta: RESPUESTA_VIEJA, fresca: false });
    const fuente: FuentePuntos = {
      obtenerTodos: vi.fn(() => new Promise<ResultadoFuentePuntos>(() => {})),
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

    const { respuesta, estadoCache } = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(estadoCache).toBe("cargada");
    expect(respuesta.stale).toBe(false);
    expect(respuesta.total).toBe(2);
    expect(respuesta.puntos.map((p) => p.id)).toEqual(["PR-MAD-001", "PR-BCN-002"]);
    expect(registro.warn).toHaveBeenCalledWith("puntos.invalido", {
      tienda: "tienda.myshopify.com",
      gid: PUNTO_INVALIDO.gid,
      motivo: expect.any(String),
    });
    expect(cache.guardar).toHaveBeenCalledWith("tienda.myshopify.com", respuesta);
  });

  it("registra puntos.carga con páginas, total, inválidos, duplicados, costo y duración (§22)", async () => {
    const cache = crearCacheFalso(undefined);
    const fuente = fuenteCon([
      PUNTO_A,
      PUNTO_B,
      PUNTO_INVALIDO,
      { ...PUNTO_A, gid: "gid://shopify/Metaobject/99" },
    ]);
    const registro = crearRegistroFalso();
    const caso = new ListarPuntosRecogida({ cache, registro, reloj: crearRelojFalso() });

    await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(registro.info).toHaveBeenCalledWith("puntos.carga", {
      tienda: "tienda.myshopify.com",
      paginas: METRICAS.paginas,
      total: 3,
      invalidos: 1,
      duplicados: 1,
      costo: METRICAS.costo,
      duracionMs: 0,
    });
  });

  it("advierte de identificadores duplicados sin descartar los puntos", async () => {
    const cache = crearCacheFalso(undefined);
    const fuente = fuenteCon([PUNTO_A, { ...PUNTO_A, gid: "gid://shopify/Metaobject/99" }]);
    const registro = crearRegistroFalso();
    const caso = new ListarPuntosRecogida({ cache, registro, reloj: crearRelojFalso() });

    const { respuesta } = await caso.ejecutar("tienda.myshopify.com", fuente);

    expect(respuesta.total).toBe(2);
    expect(registro.warn).toHaveBeenCalledWith("puntos.duplicado", {
      tienda: "tienda.myshopify.com",
      identificador: PUNTO_A.id,
      gids: [PUNTO_A.gid, "gid://shopify/Metaobject/99"],
    });
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
    expect(registro.error).toHaveBeenCalledWith("puntos.carga.error", {
      tienda: "tienda.myshopify.com",
      error: "boom",
      reintentos: 0,
    });
    expect(cache.guardar).not.toHaveBeenCalled();
  });

  it("incluye en puntos.carga.error los reintentos que informa la fuente", async () => {
    const cache = crearCacheFalso(undefined);
    const fuente: FuentePuntos = {
      obtenerTodos: vi.fn(async () => {
        throw new FuentePuntosError("THROTTLED", 4);
      }),
    };
    const registro = crearRegistroFalso();
    const caso = new ListarPuntosRecogida({ cache, registro, reloj: crearRelojFalso() });

    await expect(caso.ejecutar("tienda.myshopify.com", fuente)).rejects.toThrow(
      PuntosNoDisponiblesError,
    );
    expect(registro.error).toHaveBeenCalledWith(
      "puntos.carga.error",
      expect.objectContaining({ error: "THROTTLED", reintentos: 4 }),
    );
  });
});
