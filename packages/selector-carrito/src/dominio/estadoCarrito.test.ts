import { describe, expect, it } from "vitest";
import {
  debeBloquearCheckout,
  estadoCargando,
  estadoConSeleccion,
  estadoErrorGuardado,
  estadoInactivo,
  estadoSinSeleccion,
  estadoVacio,
  tienePuntos,
} from "./estadoCarrito.js";
import type { PuntoRecogidaDto, SeleccionPunto } from "@puntos-recogida/contratos";

const punto: PuntoRecogidaDto = {
  id: "PR-001",
  gid: "gid://shopify/Metaobject/1",
  nombre: "Kiosko Sol",
  direccion: "Puerta del Sol 1",
  direccionCorta: "Pta. del Sol 1",
  lat: 40.4,
  lng: -3.7,
};

const seleccion: SeleccionPunto = {
  puntoId: punto.id,
  puntoGid: punto.gid,
  puntoNombre: punto.nombre,
  puntoDireccion: punto.direccion,
  puntoDireccionCorta: punto.direccionCorta,
  puntoLat: String(punto.lat),
  puntoLng: String(punto.lng),
};

describe("debeBloquearCheckout", () => {
  it("no bloquea en inactivo (sin cambios)", () => {
    expect(debeBloquearCheckout(estadoInactivo())).toBe(false);
  });

  it("no bloquea con selección vigente", () => {
    expect(debeBloquearCheckout(estadoConSeleccion([punto], seleccion))).toBe(false);
  });

  it("bloquea en cargando, vacío, sin_seleccion y error_guardado", () => {
    expect(debeBloquearCheckout(estadoCargando())).toBe(true);
    expect(debeBloquearCheckout(estadoVacio())).toBe(true);
    expect(debeBloquearCheckout(estadoSinSeleccion([punto]))).toBe(true);
    expect(debeBloquearCheckout(estadoErrorGuardado([punto], punto, "falló"))).toBe(true);
  });
});

describe("tienePuntos", () => {
  it("es verdadero solo para los estados que conservan la lista", () => {
    expect(tienePuntos(estadoSinSeleccion([punto]))).toBe(true);
    expect(tienePuntos(estadoConSeleccion([punto], seleccion))).toBe(true);
    expect(tienePuntos(estadoInactivo())).toBe(false);
    expect(tienePuntos(estadoCargando())).toBe(false);
    expect(tienePuntos(estadoVacio())).toBe(false);
  });
});
