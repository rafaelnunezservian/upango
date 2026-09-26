import { describe, expect, it, vi } from "vitest";
import { GraphqlQueryError } from "@shopify/shopify-api";
import { FuentePuntosShopify } from "./fuentePuntosShopify.server.js";
import type { Registro } from "../../application/ports/registro.js";
import { FuentePuntosError } from "../../application/ports/fuentePuntos.js";

function crearRegistroFalso(): Registro {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function nodo(id: string, valores: Record<string, string>) {
  return {
    id,
    fields: Object.entries(valores).map(([key, value]) => ({ key, value })),
  };
}

function respuestaGraphql(
  nodos: unknown[],
  hasNextPage: boolean,
  endCursor: string | null,
  costo?: { requestedQueryCost: number; actualQueryCost?: number },
) {
  return {
    json: async () => ({
      data: { metaobjects: { nodes: nodos, pageInfo: { hasNextPage, endCursor } } },
      ...(costo ? { extensions: { cost: costo } } : {}),
    }),
  };
}

function errorGraphql(codigo: string): GraphqlQueryError {
  return new GraphqlQueryError({
    message: codigo,
    response: {},
    body: { errors: [{ message: codigo, extensions: { code: codigo } }] },
  });
}

const VALORES_PUNTO = {
  identificador: "PR-MAD-001",
  nombre: "Kiosko Sol",
  direccion: "Puerta del Sol 1, 28013 Madrid",
  direccion_corta: "Pta. del Sol 1, Madrid",
  lat: "40.416775",
  lng: "-3.70379",
};

describe("FuentePuntosShopify", () => {
  it("pagina siguiendo endCursor hasta agotar hasNextPage", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce(
        respuestaGraphql(
          [nodo("gid://shopify/Metaobject/1", VALORES_PUNTO)],
          true,
          "cursor-1",
        ),
      )
      .mockResolvedValueOnce(
        respuestaGraphql(
          [nodo("gid://shopify/Metaobject/2", { ...VALORES_PUNTO, identificador: "PR-BCN-002" })],
          false,
          null,
        ),
      );

    const fuente = new FuentePuntosShopify(graphql as never, crearRegistroFalso(), 250);
    const { puntos } = await fuente.obtenerTodos();

    expect(puntos).toHaveLength(2);
    expect(puntos[0]!.id).toBe("PR-MAD-001");
    expect(puntos[1]!.id).toBe("PR-BCN-002");
    expect(graphql).toHaveBeenCalledTimes(2);
    expect(graphql.mock.calls[1]![1]).toMatchObject({
      variables: { after: "cursor-1", first: 250 },
    });
  });

  it("convierte lat/lng a número y usa el id del metaobjeto como gid", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce(
        respuestaGraphql([nodo("gid://shopify/Metaobject/1", VALORES_PUNTO)], false, null),
      );

    const fuente = new FuentePuntosShopify(graphql as never, crearRegistroFalso());
    const {
      puntos: [punto],
    } = await fuente.obtenerTodos();

    expect(punto!.gid).toBe("gid://shopify/Metaobject/1");
    expect(punto!.lat).toBeCloseTo(40.416775);
    expect(punto!.lng).toBeCloseTo(-3.70379);
  });

  it("reintenta con espera exponencial ante THROTTLED y luego continúa", async () => {
    const graphql = vi
      .fn()
      .mockRejectedValueOnce(errorGraphql("THROTTLED"))
      .mockRejectedValueOnce(errorGraphql("THROTTLED"))
      .mockResolvedValueOnce(
        respuestaGraphql([nodo("gid://shopify/Metaobject/1", VALORES_PUNTO)], false, null),
      );
    const esperar = vi.fn(async () => {});

    const fuente = new FuentePuntosShopify(graphql as never, crearRegistroFalso(), 250, esperar);
    const { puntos } = await fuente.obtenerTodos();

    expect(puntos).toHaveLength(1);
    expect(esperar).toHaveBeenNthCalledWith(1, 500);
    expect(esperar).toHaveBeenNthCalledWith(2, 1000);
  });

  it("propaga el error si se agotan los reintentos de throttling", async () => {
    const graphql = vi.fn().mockRejectedValue(errorGraphql("THROTTLED"));
    const esperar = vi.fn(async () => {});

    const fuente = new FuentePuntosShopify(graphql as never, crearRegistroFalso(), 250, esperar);

    const error = await fuente.obtenerTodos().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FuentePuntosError);
    expect((error as FuentePuntosError).reintentos).toBe(4);
    expect((error as FuentePuntosError).cause).toBeInstanceOf(GraphqlQueryError);
    expect(graphql).toHaveBeenCalledTimes(5);
  });

  it("reduce el tamaño de página a la mitad ante MAX_COST_EXCEEDED y mantiene el tamaño reducido", async () => {
    const graphql = vi
      .fn()
      .mockRejectedValueOnce(errorGraphql("MAX_COST_EXCEEDED"))
      .mockResolvedValueOnce(
        respuestaGraphql(
          [nodo("gid://shopify/Metaobject/1", VALORES_PUNTO)],
          true,
          "cursor-1",
        ),
      )
      .mockResolvedValueOnce(
        respuestaGraphql([nodo("gid://shopify/Metaobject/2", VALORES_PUNTO)], false, null),
      );

    const fuente = new FuentePuntosShopify(graphql as never, crearRegistroFalso(), 250);
    const { puntos } = await fuente.obtenerTodos();

    expect(puntos).toHaveLength(2);
    expect(graphql.mock.calls[0]![1]).toMatchObject({ variables: { after: null, first: 250 } });
    expect(graphql.mock.calls[1]![1]).toMatchObject({ variables: { after: null, first: 125 } });
    expect(graphql.mock.calls[2]![1]).toMatchObject({
      variables: { after: "cursor-1", first: 125 },
    });
  });

  it("informa páginas, costo real (o pedido) y reintentos de la carga (puntos.carga, §22)", async () => {
    const graphql = vi
      .fn()
      .mockRejectedValueOnce(errorGraphql("THROTTLED"))
      .mockResolvedValueOnce(
        respuestaGraphql([nodo("gid://shopify/Metaobject/1", VALORES_PUNTO)], true, "cursor-1", {
          requestedQueryCost: 50,
          actualQueryCost: 20,
        }),
      )
      .mockResolvedValueOnce(
        respuestaGraphql([nodo("gid://shopify/Metaobject/2", VALORES_PUNTO)], false, null, {
          requestedQueryCost: 7,
        }),
      );

    const fuente = new FuentePuntosShopify(graphql as never, crearRegistroFalso(), 250, async () => {});
    const { metricas } = await fuente.obtenerTodos();

    expect(metricas).toEqual({ paginas: 2, costo: 27, reintentos: 1 });
  });
});
