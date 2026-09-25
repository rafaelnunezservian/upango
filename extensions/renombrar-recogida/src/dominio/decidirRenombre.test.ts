import { describe, expect, it } from "vitest";
import { decidirRenombre } from "./decidirRenombre.js";
import type { GrupoEntrega } from "./decidirRenombre.js";

const TITULO_RECOGIDA = "Recogida en punto de entrega";
const TITULO_ESTANDAR = "Estándar";

function unGrupo(...titulos: readonly (string | null)[]): readonly GrupoEntrega[] {
  return [
    {
      opciones: titulos.map((titulo, indice) => ({ handle: `handle-${indice}`, titulo })),
    },
  ];
}

describe("decidirRenombre (CT-05)", () => {
  it("resolado + punto + dirección corta presente → renombra con la dirección", () => {
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      direccionCorta: "Pta. del Sol 1, Madrid",
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(decisiones).toEqual([
      { handle: "handle-0", titulo: "Recogida en Pta. del Sol 1, Madrid · no se usará tu dirección" },
    ]);
  });

  it("resolado + punto + sin dirección corta → renombra con 'punto de entrega'", () => {
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      direccionCorta: null,
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(decisiones).toEqual([
      { handle: "handle-0", titulo: "Recogida en punto de entrega · no se usará tu dirección" },
    ]);
  });

  it("cualquier otra combinación (p. ej. resolado sin punto) → ninguna", () => {
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: null,
      direccionCorta: "Pta. del Sol 1, Madrid",
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(decisiones).toEqual([]);
  });

  it("carrito normal → ninguna, aunque haya punto y dirección", () => {
    const decisiones = decidirRenombre({
      tipoCarrito: "normal",
      puntoId: "PR-001",
      direccionCorta: "Pta. del Sol 1, Madrid",
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(decisiones).toEqual([]);
  });

  it("un título nulo no es la tarifa de recogida: no se renombra", () => {
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      direccionCorta: "Pta. del Sol 1, Madrid",
      grupos: unGrupo(null),
    });
    expect(decisiones).toEqual([]);
  });

  it("dirección corta de más de 60 caracteres se trunca con '…'", () => {
    const direccionLarga = "Calle Muy Larga Con Muchísimo Texto Para Superar El Límite De Sesenta Caracteres, Madrid";
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      direccionCorta: direccionLarga,
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    const titulo = decisiones[0]?.titulo ?? "";
    expect(titulo.endsWith("… · no se usará tu dirección")).toBe(true);
    const lugar = titulo.slice("Recogida en ".length, titulo.indexOf(" · no se usará"));
    expect(lugar.length).toBe(60);
  });

  it("caracteres de control en la dirección corta se eliminan", () => {
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      direccionCorta: "Pta.\u0000 del\u001F Sol 1, Madrid",
      grupos: unGrupo(TITULO_RECOGIDA),
    });
    expect(decisiones).toEqual([
      { handle: "handle-0", titulo: "Recogida en Pta. del Sol 1, Madrid · no se usará tu dirección" },
    ]);
  });

  it("reconoce el título de la tarifa con mayúsculas y tildes distintas", () => {
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      direccionCorta: null,
      grupos: unGrupo("RECOGIDA EN PUNTO DE ENTREGA"),
    });
    expect(decisiones).toEqual([
      { handle: "handle-0", titulo: "Recogida en punto de entrega · no se usará tu dirección" },
    ]);
  });

  it("no toca opciones que no son la tarifa de recogida, aunque renombre otras del mismo grupo", () => {
    const grupos: readonly GrupoEntrega[] = [
      {
        opciones: [
          { handle: "recogida", titulo: TITULO_RECOGIDA },
          { handle: "estandar", titulo: TITULO_ESTANDAR },
        ],
      },
    ];
    const decisiones = decidirRenombre({
      tipoCarrito: "resolado",
      puntoId: "PR-001",
      direccionCorta: "Pta. del Sol 1, Madrid",
      grupos,
    });
    expect(decisiones).toEqual([
      { handle: "recogida", titulo: "Recogida en Pta. del Sol 1, Madrid · no se usará tu dirección" },
    ]);
  });
});
