import { describe, expect, it, vi } from "vitest";
import {
  cargarConfiguracionOSalir,
  ConfiguracionInvalidaError,
  validarConfiguracion,
} from "./config.server.js";

const ENV_VALIDO = Object.freeze({
  SHOPIFY_API_KEY: "clave-dev",
  SHOPIFY_API_SECRET: "secreto-dev",
  SHOPIFY_APP_URL: "https://ejemplo.trycloudflare.com",
  SCOPES: "write_delivery_customizations,write_app_proxy",
});

describe("validarConfiguracion", () => {
  it("construye la configuración con los valores por defecto del CT-09", () => {
    const config = validarConfiguracion(ENV_VALIDO);
    expect(config.shopifyApiKey).toBe("clave-dev");
    expect(config.puerto).toBe(3000);
    expect(config.nodeEnv).toBe("development");
    expect(config.sessionStorageDriver).toBe("memoria");
    expect(config.puntosCacheTtlSegundos).toBe(300);
    expect(config.puntosCacheStaleMaxSegundos).toBe(86400);
    expect(config.puntosTamanoPagina).toBe(250);
    expect(config.logLevel).toBe("info");
    expect(config.habilitarSemilla).toBe(false);
    expect(config.scopes).toEqual([
      "write_delivery_customizations",
      "write_app_proxy",
    ]);
  });

  it("usa firestore por defecto cuando NODE_ENV=production", () => {
    const config = validarConfiguracion({ ...ENV_VALIDO, NODE_ENV: "production" });
    expect(config.sessionStorageDriver).toBe("firestore");
  });

  it("respeta SESSION_STORAGE_DRIVER explícito aunque difiera del entorno", () => {
    const config = validarConfiguracion({
      ...ENV_VALIDO,
      NODE_ENV: "production",
      SESSION_STORAGE_DRIVER: "memoria",
    });
    expect(config.sessionStorageDriver).toBe("memoria");
  });

  it("lanza ConfiguracionInvalidaError con los nombres de las variables faltantes", () => {
    expect(() => validarConfiguracion({})).toThrowError(ConfiguracionInvalidaError);
    try {
      validarConfiguracion({});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfiguracionInvalidaError);
      const err = error as ConfiguracionInvalidaError;
      expect(err.variablesFaltantesOInvalidas).toEqual(
        expect.arrayContaining([
          "SHOPIFY_API_KEY",
          "SHOPIFY_API_SECRET",
          "SHOPIFY_APP_URL",
          "SCOPES",
        ]),
      );
      // FR-076 / evento config.invalida: nunca se exponen valores, solo nombres.
      expect(err.message).not.toContain("secreto-dev");
    }
  });

  it("falla si HABILITAR_SEMILLA=true con NODE_ENV=production (FR-005)", () => {
    expect(() =>
      validarConfiguracion({
        ...ENV_VALIDO,
        NODE_ENV: "production",
        HABILITAR_SEMILLA: "true",
      }),
    ).toThrowError(ConfiguracionInvalidaError);
  });

  it("permite HABILITAR_SEMILLA=true fuera de producción", () => {
    const config = validarConfiguracion({
      ...ENV_VALIDO,
      HABILITAR_SEMILLA: "true",
    });
    expect(config.habilitarSemilla).toBe(true);
  });
});

describe("cargarConfiguracionOSalir", () => {
  it("termina el proceso con código distinto de 0 si la configuración es inválida", () => {
    const salir = vi.spyOn(process, "exit").mockImplementation(((): never => {
      throw new Error("process.exit llamado");
    }) as never);
    const errorConsola = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => cargarConfiguracionOSalir({})).toThrow("process.exit llamado");
    expect(salir).toHaveBeenCalledWith(1);
    expect(errorConsola).toHaveBeenCalled();

    salir.mockRestore();
    errorConsola.mockRestore();
  });

  it("devuelve la configuración cuando el entorno es válido", () => {
    expect(cargarConfiguracionOSalir(ENV_VALIDO).shopifyApiKey).toBe("clave-dev");
  });
});
