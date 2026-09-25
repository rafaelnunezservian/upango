import { describe, expect, it } from "vitest";
import {
  esTarifaRecogida,
  formatearTituloRecogida,
  TITULO_TARIFA_RECOGIDA,
} from "./tarifa.js";

describe("esTarifaRecogida", () => {
  it("reconoce el título exacto", () => {
    expect(esTarifaRecogida(TITULO_TARIFA_RECOGIDA)).toBe(true);
  });

  it("tolera tildes, mayúsculas y espacios distintos", () => {
    expect(esTarifaRecogida("recogida  en  punto  de  entrega")).toBe(true);
    expect(esTarifaRecogida("RECOGIDA EN PUNTO DE ENTREGA")).toBe(true);
    expect(esTarifaRecogida("  Recogida en Punto de Entrega  ")).toBe(true);
  });

  it("es false para otros títulos, título nulo o indefinido", () => {
    expect(esTarifaRecogida("Envío estándar")).toBe(false);
    expect(esTarifaRecogida(null)).toBe(false);
    expect(esTarifaRecogida(undefined)).toBe(false);
  });
});

describe("formatearTituloRecogida", () => {
  it("recorta extremos y colapsa espacios", () => {
    expect(formatearTituloRecogida("  Pta.   del Sol 1, Madrid  ")).toBe(
      "Pta. del Sol 1, Madrid",
    );
  });

  it("quita caracteres de control", () => {
    expect(formatearTituloRecogida("Madrid\u0000 Centro")).toBe(
      "Madrid Centro",
    );
  });

  it("trunca a 60 caracteres con … si es más larga", () => {
    const larga = "Calle muy larga ".repeat(6).trim();
    const resultado = formatearTituloRecogida(larga);
    expect(resultado.length).toBeLessThanOrEqual(60);
    expect(resultado.endsWith("…")).toBe(true);
  });

  it("devuelve cadena vacía para null o undefined", () => {
    expect(formatearTituloRecogida(null)).toBe("");
    expect(formatearTituloRecogida(undefined)).toBe("");
  });
});
