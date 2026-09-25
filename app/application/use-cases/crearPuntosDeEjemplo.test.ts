import { describe, expect, it, vi } from "vitest";
import { GraphqlQueryError } from "@shopify/shopify-api";
import {
  crearPuntosDeEjemplo,
  generarPuntoDeEjemplo,
} from "./crearPuntosDeEjemplo.js";
import type { DatosNuevoPunto, EscritorPuntos } from "../ports/escritorPuntos.js";
import type { Registro } from "../ports/registro.js";

function crearRegistroFalso(): Registro {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function errorThrottled(): GraphqlQueryError {
  return new GraphqlQueryError({
    message: "Throttled",
    response: {},
    body: { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] },
  });
}

describe("generarPuntoDeEjemplo", () => {
  it("genera handles deterministas de 4 dígitos", () => {
    expect(generarPuntoDeEjemplo(1).handle).toBe("ejemplo-0001");
    expect(generarPuntoDeEjemplo(600).handle).toBe("ejemplo-0600");
  });

  it("es determinista: el mismo índice produce siempre el mismo punto", () => {
    expect(generarPuntoDeEjemplo(42)).toEqual(generarPuntoDeEjemplo(42));
  });

  it("genera coordenadas dentro de los rangos válidos", () => {
    for (const indice of [1, 250, 600]) {
      const punto = generarPuntoDeEjemplo(indice);
      expect(punto.lat).toBeGreaterThanOrEqual(-90);
      expect(punto.lat).toBeLessThanOrEqual(90);
      expect(punto.lng).toBeGreaterThanOrEqual(-180);
      expect(punto.lng).toBeLessThanOrEqual(180);
    }
  });
});

describe("crearPuntosDeEjemplo", () => {
  it("es idempotente: llama upsert con el mismo handle para el mismo índice", async () => {
    const llamadas: DatosNuevoPunto[] = [];
    const escritor: EscritorPuntos = {
      upsert: vi.fn(async (punto) => {
        llamadas.push(punto);
      }),
    };

    await crearPuntosDeEjemplo(
      { escritor, registro: crearRegistroFalso(), esperar: vi.fn() },
      3,
    );
    await crearPuntosDeEjemplo(
      { escritor, registro: crearRegistroFalso(), esperar: vi.fn() },
      3,
    );

    expect(llamadas).toHaveLength(6);
    expect(llamadas[0]!.handle).toBe(llamadas[3]!.handle);
    expect(llamadas[0]).toEqual(llamadas[3]);
  });

  it("crea la cantidad pedida de puntos", async () => {
    const escritor: EscritorPuntos = { upsert: vi.fn(async () => {}) };

    const resultado = await crearPuntosDeEjemplo(
      { escritor, registro: crearRegistroFalso(), esperar: vi.fn() },
      10,
    );

    expect(resultado.creados).toBe(10);
    expect(escritor.upsert).toHaveBeenCalledTimes(10);
  });

  it("reintenta con espera exponencial ante un error de throttling y luego termina", async () => {
    let intentos = 0;
    const escritor: EscritorPuntos = {
      upsert: vi.fn(async () => {
        intentos += 1;
        if (intentos <= 2) {
          throw errorThrottled();
        }
      }),
    };
    const esperar = vi.fn(async () => {});

    const resultado = await crearPuntosDeEjemplo(
      { escritor, registro: crearRegistroFalso(), esperar },
      1,
    );

    expect(resultado.creados).toBe(1);
    expect(resultado.reintentosPorThrottling).toBe(2);
    expect(esperar).toHaveBeenNthCalledWith(1, 500);
    expect(esperar).toHaveBeenNthCalledWith(2, 1000);
  });

  it("propaga el error de throttling si se agotan los reintentos", async () => {
    const escritor: EscritorPuntos = {
      upsert: vi.fn(async () => {
        throw errorThrottled();
      }),
    };

    await expect(
      crearPuntosDeEjemplo(
        { escritor, registro: crearRegistroFalso(), esperar: vi.fn() },
        1,
      ),
    ).rejects.toThrow(GraphqlQueryError);
  });

  it("propaga inmediatamente un error que no es de throttling", async () => {
    const escritor: EscritorPuntos = {
      upsert: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const esperar = vi.fn(async () => {});

    await expect(
      crearPuntosDeEjemplo({ escritor, registro: crearRegistroFalso(), esperar }, 1),
    ).rejects.toThrow("boom");
    expect(esperar).not.toHaveBeenCalled();
  });
});
