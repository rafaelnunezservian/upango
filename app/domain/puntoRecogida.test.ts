import { describe, expect, it } from "vitest";
import { crearPuntoRecogida, PuntoInvalidoError } from "./puntoRecogida.js";
import type { DatosPuntoRecogida } from "./puntoRecogida.js";

function datosValidos(sobrescribir: Partial<DatosPuntoRecogida> = {}): DatosPuntoRecogida {
  return {
    id: "PR-MAD-001",
    gid: "gid://shopify/Metaobject/1001",
    nombre: "Kiosko Sol",
    direccion: "Puerta del Sol 1, 28013 Madrid",
    direccionCorta: "Pta. del Sol 1, Madrid",
    lat: 40.416775,
    lng: -3.70379,
    ...sobrescribir,
  };
}

describe("crearPuntoRecogida", () => {
  it("construye un punto válido con todos los campos", () => {
    const punto = crearPuntoRecogida(datosValidos());

    expect(punto).toEqual({
      id: "PR-MAD-001",
      gid: "gid://shopify/Metaobject/1001",
      nombre: "Kiosko Sol",
      direccion: "Puerta del Sol 1, 28013 Madrid",
      direccionCorta: "Pta. del Sol 1, Madrid",
      coordenadas: { lat: 40.416775, lng: -3.70379 },
    });
  });

  it.each([
    ["id", ""],
    ["nombre", ""],
    ["direccion", ""],
    ["direccionCorta", ""],
    ["id", "   "],
  ] as const)("rechaza el campo obligatorio %s vacío", (campo, valor) => {
    expect(() => crearPuntoRecogida(datosValidos({ [campo]: valor }))).toThrow(
      PuntoInvalidoError,
    );
  });

  it("rechaza un identificador de más de 40 caracteres", () => {
    expect(() =>
      crearPuntoRecogida(datosValidos({ id: "a".repeat(41) })),
    ).toThrow(PuntoInvalidoError);
  });

  it("rechaza un identificador con caracteres fuera de [A-Za-z0-9_-]", () => {
    expect(() => crearPuntoRecogida(datosValidos({ id: "PR MAD 001" }))).toThrow(
      PuntoInvalidoError,
    );
  });

  it("rechaza un nombre de más de 100 caracteres", () => {
    expect(() =>
      crearPuntoRecogida(datosValidos({ nombre: "a".repeat(101) })),
    ).toThrow(PuntoInvalidoError);
  });

  it("rechaza una dirección de más de 255 caracteres", () => {
    expect(() =>
      crearPuntoRecogida(datosValidos({ direccion: "a".repeat(256) })),
    ).toThrow(PuntoInvalidoError);
  });

  it("rechaza una dirección corta de más de 60 caracteres", () => {
    expect(() =>
      crearPuntoRecogida(datosValidos({ direccionCorta: "a".repeat(61) })),
    ).toThrow(PuntoInvalidoError);
  });

  it.each([-90.1, 90.1, Number.NaN])("rechaza una latitud fuera de rango (%s)", (lat) => {
    expect(() => crearPuntoRecogida(datosValidos({ lat }))).toThrow(PuntoInvalidoError);
  });

  it.each([-180.1, 180.1, Number.NaN])("rechaza una longitud fuera de rango (%s)", (lng) => {
    expect(() => crearPuntoRecogida(datosValidos({ lng }))).toThrow(PuntoInvalidoError);
  });

  it("acepta los extremos de los rangos de coordenadas", () => {
    expect(() => crearPuntoRecogida(datosValidos({ lat: -90, lng: -180 }))).not.toThrow();
    expect(() => crearPuntoRecogida(datosValidos({ lat: 90, lng: 180 }))).not.toThrow();
  });

  it("acepta los límites máximos exactos de longitud", () => {
    expect(() =>
      crearPuntoRecogida(
        datosValidos({
          id: "a".repeat(40),
          nombre: "a".repeat(100),
          direccion: "a".repeat(255),
          direccionCorta: "a".repeat(60),
        }),
      ),
    ).not.toThrow();
  });

  it("devuelve un objeto congelado (inmutable)", () => {
    const punto = crearPuntoRecogida(datosValidos());
    expect(Object.isFrozen(punto)).toBe(true);
    expect(Object.isFrozen(punto.coordenadas)).toBe(true);
  });
});
