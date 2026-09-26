import { describe, expect, it } from "vitest";
import { PASOS, esPasoValido } from "./pasos.js";

describe("esPasoValido", () => {
  it.each(PASOS)("acepta el paso válido %s", (paso) => {
    expect(esPasoValido(paso)).toBe(true);
  });

  it("rechaza un paso desconocido", () => {
    expect(esPasoValido("no-existe")).toBe(false);
  });

  it("rechaza la cadena vacía", () => {
    expect(esPasoValido("")).toBe(false);
  });
});
