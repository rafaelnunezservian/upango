import { describe, expect, it } from "vitest";
import { atributosModoDemo } from "./modoDemo.js";

describe("atributosModoDemo", () => {
  it("al activar, escribe solo tipo_carrito=resolado", () => {
    expect(atributosModoDemo(true)).toEqual({ tipo_carrito: "resolado" });
  });

  it("al desactivar, limpia tipo_carrito y los 7 punto_*", () => {
    expect(atributosModoDemo(false)).toEqual({
      tipo_carrito: "",
      punto_id: "",
      punto_gid: "",
      punto_nombre: "",
      punto_direccion: "",
      punto_direccion_corta: "",
      punto_lat: "",
      punto_lng: "",
    });
  });
});
