import { describe, expect, it } from "vitest";
import { decidirOcultamiento } from "./decidirOcultamiento.js";
import type { GrupoEntrega } from "./decidirOcultamiento.js";

const TITULO_RECOGIDA = "Recogida en punto de entrega";
const TITULO_ESTANDAR = "Estándar";

function unGrupo(...titulos: readonly (string | null)[]): readonly GrupoEntrega[] {
  return [
    {
      opciones: titulos.map((titulo, indice) => ({ handle: `handle-${indice}`, titulo })),
    },
  ];
}

describe("decidirOcultamiento (CT-04)", () => {
  it("carrito normal + es la tarifa de recogida → se oculta", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "normal",
      puntoId: null,
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(handles).toEqual(["handle-0"]);
  });

  it("carrito normal + no es la tarifa de recogida → nada", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "normal",
      puntoId: null,
      grupos: unGrupo(TITULO_ESTANDAR),
    });
    expect(handles).toEqual([]);
  });

  it("resolado + punto presente + es la tarifa de recogida → queda visible", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(handles).toEqual([]);
  });

  it("resolado + punto presente + no es la tarifa de recogida → se oculta", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      grupos: unGrupo(TITULO_ESTANDAR),
    });
    expect(handles).toEqual(["handle-0"]);
  });

  it("resolado + sin punto + es la tarifa de recogida → se oculta (fail-closed)", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "resolado",
      puntoId: null,
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(handles).toEqual(["handle-0"]);
  });

  it("resolado + sin punto + no es la tarifa de recogida → se oculta", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "resolado",
      puntoId: null,
      grupos: unGrupo(TITULO_ESTANDAR),
    });
    expect(handles).toEqual(["handle-0"]);
  });

  it("tipo_carrito con mayúsculas y espacios se reconoce igual como resolado", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "  RESOLADO  ",
      puntoId: "PR-001",
      grupos: unGrupo(TITULO_ESTANDAR),
    });
    expect(handles).toEqual(["handle-0"]);
  });

  it("tipo_carrito vacío se trata como carrito normal", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "",
      puntoId: "PR-001",
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(handles).toEqual(["handle-0"]);
  });

  it("punto_id de solo espacios cuenta como ausente (FR-047)", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "resolado",
      puntoId: "   ",
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(handles).toEqual(["handle-0"]);
  });

  it("varios grupos de entrega se procesan todos (FR-044)", () => {
    const grupos: readonly GrupoEntrega[] = [
      { opciones: [{ handle: "g1-recogida", titulo: TITULO_RECOGIDA }] },
      { opciones: [{ handle: "g2-estandar", titulo: TITULO_ESTANDAR }] },
      {
        opciones: [
          { handle: "g3-recogida", titulo: TITULO_RECOGIDA },
          { handle: "g3-estandar", titulo: TITULO_ESTANDAR },
        ],
      },
    ];
    const handles = decidirOcultamiento({ tipoCarrito: "normal", puntoId: null, grupos });
    expect(handles).toEqual(["g1-recogida", "g3-recogida"]);
  });

  it("un título nulo no es la tarifa de recogida", () => {
    const handles = decidirOcultamiento({
      tipoCarrito: "normal",
      puntoId: null,
      grupos: unGrupo(null),
    });
    expect(handles).toEqual([]);
  });
});
