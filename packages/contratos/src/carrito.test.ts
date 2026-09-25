import { describe, expect, it } from "vitest";
import { esCarritoResolado, VALOR_TIPO_RESOLADO } from "./carrito.js";

describe("esCarritoResolado", () => {
  it("es true para el valor exacto", () => {
    expect(esCarritoResolado(VALOR_TIPO_RESOLADO)).toBe(true);
  });

  it("tolera mayúsculas y espacios en los extremos (EC-05)", () => {
    expect(esCarritoResolado(" Resolado ")).toBe(true);
    expect(esCarritoResolado("RESOLADO")).toBe(true);
  });

  it("es false para cualquier otro valor, vacío, null o undefined", () => {
    expect(esCarritoResolado("normal")).toBe(false);
    expect(esCarritoResolado("")).toBe(false);
    expect(esCarritoResolado(null)).toBe(false);
    expect(esCarritoResolado(undefined)).toBe(false);
  });
});
