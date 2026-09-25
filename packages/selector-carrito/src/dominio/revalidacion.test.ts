import { describe, expect, it } from "vitest";
import { evaluarSeleccion } from "./revalidacion.js";
import type { PuntoRecogidaDto, SeleccionPunto } from "@puntos-recogida/contratos";

const punto: PuntoRecogidaDto = {
  id: "PR-001",
  gid: "gid://shopify/Metaobject/1",
  nombre: "Kiosko Sol",
  direccion: "Puerta del Sol 1, Madrid",
  direccionCorta: "Pta. del Sol 1, Madrid",
  lat: 40.416775,
  lng: -3.70379,
};

function seleccionDe(punto: PuntoRecogidaDto): SeleccionPunto {
  return {
    puntoId: punto.id,
    puntoGid: punto.gid,
    puntoNombre: punto.nombre,
    puntoDireccion: punto.direccion,
    puntoDireccionCorta: punto.direccionCorta,
    puntoLat: String(punto.lat),
    puntoLng: String(punto.lng),
  };
}

describe("evaluarSeleccion", () => {
  it("es vigente cuando todos los datos coinciden con el punto actual", () => {
    expect(evaluarSeleccion(seleccionDe(punto), [punto]).tipo).toBe("vigente");
  });

  it("es inexistente cuando el punto ya no está en la lista", () => {
    expect(evaluarSeleccion(seleccionDe(punto), []).tipo).toBe("inexistente");
  });

  it("es desactualizada cuando el punto sigue pero cambió algún dato", () => {
    const puntoRenombrado = { ...punto, nombre: "Kiosko Sol (renovado)" };
    const resultado = evaluarSeleccion(seleccionDe(punto), [puntoRenombrado]);
    expect(resultado).toEqual({ tipo: "desactualizada", punto: puntoRenombrado });
  });
});
