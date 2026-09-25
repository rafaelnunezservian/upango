import { describe, expect, it } from "vitest";
import { CachePuntosMemoria } from "./cachePuntosMemoria.server.js";
import type { Reloj } from "../../application/ports/reloj.js";
import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";

function crearRelojFalso(inicial: number): Reloj & { avanzar(segundos: number): void } {
  let ahoraMs = inicial;
  return {
    ahora: () => new Date(ahoraMs),
    avanzar(segundos: number) {
      ahoraMs += segundos * 1000;
    },
  };
}

function respuesta(total = 1): RespuestaPuntosDto {
  return {
    version: 1,
    generadoEn: new Date(0).toISOString(),
    stale: false,
    total,
    puntos: [],
  };
}

describe("CachePuntosMemoria", () => {
  it("devuelve la entrada como fresca dentro del TTL", () => {
    const reloj = crearRelojFalso(0);
    const cache = new CachePuntosMemoria(reloj, 300, 86400);

    cache.guardar("tienda-a.myshopify.com", respuesta());
    reloj.avanzar(299);

    expect(cache.leer("tienda-a.myshopify.com")).toEqual({
      respuesta: respuesta(),
      fresca: true,
    });
  });

  it("marca la entrada como no fresca una vez pasado el TTL, pero sigue devolviéndola dentro del máximo", () => {
    const reloj = crearRelojFalso(0);
    const cache = new CachePuntosMemoria(reloj, 300, 86400);

    cache.guardar("tienda-a.myshopify.com", respuesta());
    reloj.avanzar(301);

    expect(cache.leer("tienda-a.myshopify.com")).toEqual({
      respuesta: respuesta(),
      fresca: false,
    });
  });

  it("stale-if-error: deja de devolver la entrada una vez superado el máximo de vejez", () => {
    const reloj = crearRelojFalso(0);
    const cache = new CachePuntosMemoria(reloj, 300, 86400);

    cache.guardar("tienda-a.myshopify.com", respuesta());
    reloj.avanzar(86401);

    expect(cache.leer("tienda-a.myshopify.com")).toBeUndefined();
  });

  it("borrar elimina la entrada de la tienda", () => {
    const reloj = crearRelojFalso(0);
    const cache = new CachePuntosMemoria(reloj, 300, 86400);

    cache.guardar("tienda-a.myshopify.com", respuesta());
    cache.borrar("tienda-a.myshopify.com");

    expect(cache.leer("tienda-a.myshopify.com")).toBeUndefined();
  });

  it("LRU: al superar la capacidad máxima, descarta la tienda usada hace más tiempo", () => {
    const reloj = crearRelojFalso(0);
    const cache = new CachePuntosMemoria(reloj, 300, 86400, 2);

    cache.guardar("tienda-a.myshopify.com", respuesta(1));
    cache.guardar("tienda-b.myshopify.com", respuesta(2));
    cache.guardar("tienda-c.myshopify.com", respuesta(3));

    expect(cache.leer("tienda-a.myshopify.com")).toBeUndefined();
    expect(cache.leer("tienda-b.myshopify.com")).toBeDefined();
    expect(cache.leer("tienda-c.myshopify.com")).toBeDefined();
  });

  it("LRU: leer una tienda la marca como reciente y evita que se descarte", () => {
    const reloj = crearRelojFalso(0);
    const cache = new CachePuntosMemoria(reloj, 300, 86400, 2);

    cache.guardar("tienda-a.myshopify.com", respuesta(1));
    cache.guardar("tienda-b.myshopify.com", respuesta(2));
    cache.leer("tienda-a.myshopify.com");
    cache.guardar("tienda-c.myshopify.com", respuesta(3));

    expect(cache.leer("tienda-a.myshopify.com")).toBeDefined();
    expect(cache.leer("tienda-b.myshopify.com")).toBeUndefined();
    expect(cache.leer("tienda-c.myshopify.com")).toBeDefined();
  });
});
