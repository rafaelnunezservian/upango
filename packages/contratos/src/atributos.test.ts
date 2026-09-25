import { describe, expect, it } from "vitest";
import {
  atributosDeSeleccion,
  atributosVaciosSeleccion,
  CLAVES_ATRIBUTO,
  CLAVES_ATRIBUTO_PUNTO,
  CLAVE_TIPO_CARRITO,
  leerSeleccionDeAtributos,
} from "./atributos.js";
import type { PuntoRecogidaDto } from "./dto.js";

const PUNTO: PuntoRecogidaDto = {
  id: "PR-MAD-001",
  gid: "gid://shopify/Metaobject/1001",
  nombre: "Kiosko Sol",
  direccion: "Puerta del Sol 1, 28013 Madrid",
  direccionCorta: "Pta. del Sol 1, Madrid",
  lat: 40.416775,
  lng: -3.70379,
};

describe("CLAVES_ATRIBUTO", () => {
  it("tiene 8 claves: tipo_carrito más las 7 punto_*", () => {
    expect(CLAVES_ATRIBUTO).toHaveLength(8);
    expect(CLAVES_ATRIBUTO[0]).toBe(CLAVE_TIPO_CARRITO);
  });

  it("CLAVES_ATRIBUTO_PUNTO tiene exactamente 7 claves", () => {
    expect(CLAVES_ATRIBUTO_PUNTO).toHaveLength(7);
    expect(CLAVES_ATRIBUTO_PUNTO).not.toContain(CLAVE_TIPO_CARRITO);
  });
});

describe("atributosDeSeleccion", () => {
  it("mapea el punto a los 7 atributos punto_* como texto", () => {
    const atributos = atributosDeSeleccion(PUNTO);
    expect(atributos).toEqual({
      punto_id: "PR-MAD-001",
      punto_gid: "gid://shopify/Metaobject/1001",
      punto_nombre: "Kiosko Sol",
      punto_direccion: "Puerta del Sol 1, 28013 Madrid",
      punto_direccion_corta: "Pta. del Sol 1, Madrid",
      punto_lat: "40.416775",
      punto_lng: "-3.70379",
    });
  });
});

describe("atributosVaciosSeleccion", () => {
  it("las 7 claves quedan con valor vacío", () => {
    const atributos = atributosVaciosSeleccion();
    for (const clave of CLAVES_ATRIBUTO_PUNTO) {
      expect(atributos[clave]).toBe("");
    }
  });
});

describe("leerSeleccionDeAtributos", () => {
  it("devuelve null si punto_id está ausente", () => {
    expect(leerSeleccionDeAtributos({})).toBeNull();
    expect(leerSeleccionDeAtributos(null)).toBeNull();
  });

  it("devuelve null si punto_id está vacío o solo tiene espacios", () => {
    expect(leerSeleccionDeAtributos({ punto_id: "   " })).toBeNull();
  });

  it("devuelve la selección cuando punto_id tiene valor", () => {
    const seleccion = leerSeleccionDeAtributos(atributosDeSeleccion(PUNTO));
    expect(seleccion).toEqual({
      puntoId: "PR-MAD-001",
      puntoGid: "gid://shopify/Metaobject/1001",
      puntoNombre: "Kiosko Sol",
      puntoDireccion: "Puerta del Sol 1, 28013 Madrid",
      puntoDireccionCorta: "Pta. del Sol 1, Madrid",
      puntoLat: "40.416775",
      puntoLng: "-3.70379",
    });
  });
});
