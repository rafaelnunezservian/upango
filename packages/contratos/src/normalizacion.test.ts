import { describe, expect, it } from "vitest";
import {
  normalizarTexto,
  quitarCaracteresDeControl,
  tieneValor,
  truncarConElipsis,
} from "./normalizacion.js";

describe("normalizarTexto", () => {
  it("recorta, colapsa espacios y pasa a minúsculas", () => {
    expect(normalizarTexto("  Hola   Mundo  ")).toBe("hola mundo");
  });

  it("quita tildes, diéresis, ñ y ç con la tabla explícita", () => {
    expect(normalizarTexto("Ñandú Über Piña Façade")).toBe(
      "nandu uber pina facade",
    );
  });

  it("devuelve una cadena vacía para null o undefined", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
  });

  it("trata RESOLADO, Resolado y ' resolado ' como iguales tras normalizar", () => {
    const variantes = ["RESOLADO", "Resolado", " resolado ", "ResoladO"];
    for (const variante of variantes) {
      expect(normalizarTexto(variante)).toBe("resolado");
    }
  });
});

describe("tieneValor", () => {
  it("es false para vacío, solo espacios, null o undefined", () => {
    expect(tieneValor("")).toBe(false);
    expect(tieneValor("   ")).toBe(false);
    expect(tieneValor(null)).toBe(false);
    expect(tieneValor(undefined)).toBe(false);
  });

  it("es true si queda contenido tras recortar", () => {
    expect(tieneValor("  PR-MAD-001  ")).toBe(true);
  });
});

describe("quitarCaracteresDeControl", () => {
  it("quita caracteres de control pero conserva el resto del texto", () => {
    expect(quitarCaracteresDeControl("Madrid\u0000\u001F\u007F Centro")).toBe(
      "Madrid Centro",
    );
  });
});

describe("truncarConElipsis", () => {
  it("no trunca si el texto ya cabe en el límite", () => {
    expect(truncarConElipsis("Pta. del Sol 1, Madrid", 60)).toBe(
      "Pta. del Sol 1, Madrid",
    );
  });

  it("trunca a N caracteres y agrega … si es más largo", () => {
    const largo = "a".repeat(70);
    const resultado = truncarConElipsis(largo, 60);
    expect(resultado).toHaveLength(60);
    expect(resultado.endsWith("…")).toBe(true);
  });

  it("colapsa espacios y quita caracteres de control antes de truncar", () => {
    expect(truncarConElipsis("  Pta.   del  Sol\u0000 1  ", 60)).toBe(
      "Pta. del Sol 1",
    );
  });
});
