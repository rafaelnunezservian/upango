import { describe, expect, it } from "vitest";
import {
  ComandoFallidoError,
  ConfiguracionInvalidaError,
  PrerrequisitoError,
  ProveedorNoImplementadoError,
} from "../dominio/errores.js";
import type {
  Consola,
  ContextoDespliegue,
  ProveedorDespliegue,
  ReferenciaImagen,
  ResultadoDespliegue,
} from "../puertos/index.js";
import { codigoSalidaParaError, ejecutarDespliegue } from "./OrquestadorDespliegue.js";
import type { EntradaOrquestador, FabricaProveedor } from "./OrquestadorDespliegue.js";

const CONSOLA_MUDA: Consola = {
  info: () => {},
  advertencia: () => {},
  error: () => {},
  comando: () => {},
};

const CONFIG_CRUDA_VALIDA = {
  servicio: "puntos-recogida",
  puerto: 8080,
  recursos: { cpu: 1, memoriaMiB: 512, instanciasMin: 0, instanciasMax: 3, concurrencia: 80 },
  variables: { NODE_ENV: "production" },
  variablesDesdeEntorno: ["SHOPIFY_API_KEY", "SHOPIFY_APP_URL"],
  secretos: { SHOPIFY_API_SECRET: "shopify-api-secret" },
  proveedores: { gcp: { proyecto: "proyecto-x", region: "europe-southwest1" } },
};

function entradaBase(sobrescribe: Partial<EntradaOrquestador> = {}): EntradaOrquestador {
  return {
    configCruda: CONFIG_CRUDA_VALIDA,
    nombreProveedor: "gcp",
    etiquetaImagen: "20260925-1530-a1b2c3d",
    simulacion: false,
    paso: "todo",
    secretos: { SHOPIFY_API_SECRET: "shh" },
    variablesEntorno: { SHOPIFY_API_KEY: "clave", SHOPIFY_APP_URL: "" },
    consola: CONSOLA_MUDA,
    ...sobrescribe,
  };
}

const IMAGEN: ReferenciaImagen = { uriCompleta: "region-docker.pkg.dev/p/r/s:tag", etiqueta: "tag" };
const RESULTADO: ResultadoDespliegue = { url: "https://puntos-recogida-123.run.app", revision: "puntos-recogida-00001" };

class ProveedorFalso implements ProveedorDespliegue {
  readonly nombre = "gcp";
  readonly llamadas: string[] = [];
  contextos: ContextoDespliegue[] = [];
  fallarEn: string | undefined;
  errorAFallar: Error = new ComandoFallidoError("boom", "imagen");

  private registrar(nombrePaso: string, ctx: ContextoDespliegue): void {
    this.llamadas.push(nombrePaso);
    this.contextos.push(ctx);
    if (this.fallarEn === nombrePaso) throw this.errorAFallar;
  }

  async verificarPrerrequisitos(ctx: ContextoDespliegue): Promise<void> {
    this.registrar("verificarPrerrequisitos", ctx);
  }
  async prepararInfraestructura(ctx: ContextoDespliegue): Promise<void> {
    this.registrar("prepararInfraestructura", ctx);
  }
  async publicarSecretos(ctx: ContextoDespliegue): Promise<void> {
    this.registrar("publicarSecretos", ctx);
  }
  async construirImagen(ctx: ContextoDespliegue): Promise<ReferenciaImagen> {
    this.registrar("construirImagen", ctx);
    return IMAGEN;
  }
  async desplegarServicio(ctx: ContextoDespliegue): Promise<ResultadoDespliegue> {
    this.registrar("desplegarServicio", ctx);
    return RESULTADO;
  }
  async actualizarVariables(ctx: ContextoDespliegue): Promise<void> {
    this.registrar("actualizarVariables", ctx);
  }
}

function registroCon(proveedor: ProveedorDespliegue): ReadonlyMap<string, FabricaProveedor> {
  return new Map([[proveedor.nombre, () => proveedor]]);
}

describe("ejecutarDespliegue", () => {
  it("corre los 8 pasos en orden y no actualiza variables si la URL coincide", async () => {
    const proveedor = new ProveedorFalso();
    const resultado = await ejecutarDespliegue(
      entradaBase({ variablesEntorno: { SHOPIFY_API_KEY: "clave", SHOPIFY_APP_URL: RESULTADO.url } }),
      registroCon(proveedor),
    );

    expect(proveedor.llamadas).toEqual([
      "verificarPrerrequisitos",
      "prepararInfraestructura",
      "publicarSecretos",
      "construirImagen",
      "desplegarServicio",
    ]);
    expect(resultado).toEqual(RESULTADO);
  });

  it("llama a actualizarVariables cuando la URL real difiere de SHOPIFY_APP_URL", async () => {
    const proveedor = new ProveedorFalso();
    await ejecutarDespliegue(
      entradaBase({ variablesEntorno: { SHOPIFY_API_KEY: "clave", SHOPIFY_APP_URL: "https://distinta.run.app" } }),
      registroCon(proveedor),
    );

    expect(proveedor.llamadas.at(-1)).toBe("actualizarVariables");
  });

  it("no llama a actualizarVariables cuando SHOPIFY_APP_URL todavía no se conoce (primer despliegue)", async () => {
    const proveedor = new ProveedorFalso();
    await ejecutarDespliegue(
      entradaBase({ variablesEntorno: { SHOPIFY_API_KEY: "clave", SHOPIFY_APP_URL: "" } }),
      registroCon(proveedor),
    );

    expect(proveedor.llamadas.at(-1)).toBe("desplegarServicio");
  });

  it("con --paso ejecuta solo ese paso", async () => {
    const proveedor = new ProveedorFalso();
    await ejecutarDespliegue(entradaBase({ paso: "infraestructura" }), registroCon(proveedor));

    expect(proveedor.llamadas).toEqual(["prepararInfraestructura"]);
  });

  it.each([
    ["verificar", "verificarPrerrequisitos"],
    ["secretos", "publicarSecretos"],
    ["imagen", "construirImagen"],
  ] as const)("--paso %s ejecuta solo %s", async (paso, llamada) => {
    const proveedor = new ProveedorFalso();
    await ejecutarDespliegue(entradaBase({ paso }), registroCon(proveedor));

    expect(proveedor.llamadas).toEqual([llamada]);
  });

  it("--paso servicio construye la imagen y despliega", async () => {
    const proveedor = new ProveedorFalso();
    await ejecutarDespliegue(entradaBase({ paso: "servicio" }), registroCon(proveedor));

    expect(proveedor.llamadas).toEqual(["construirImagen", "desplegarServicio"]);
  });

  it("propaga ctx.simulacion === true en --dry-run", async () => {
    const proveedor = new ProveedorFalso();
    await ejecutarDespliegue(entradaBase({ simulacion: true, paso: "verificar" }), registroCon(proveedor));

    expect(proveedor.contextos[0]?.simulacion).toBe(true);
  });

  it("propaga el error del proveedor sin envolverlo", async () => {
    const proveedor = new ProveedorFalso();
    proveedor.fallarEn = "publicarSecretos";
    proveedor.errorAFallar = new ComandoFallidoError("el secreto falló", "secretos");

    await expect(ejecutarDespliegue(entradaBase(), registroCon(proveedor))).rejects.toThrow(
      "el secreto falló",
    );
  });

  it("falla con ConfiguracionInvalidaError si deploy.config.json no valida", async () => {
    await expect(
      ejecutarDespliegue(
        entradaBase({ configCruda: { servicio: "" } }),
        registroCon(new ProveedorFalso()),
      ),
    ).rejects.toThrow(ConfiguracionInvalidaError);
  });

  it("falla con ConfiguracionInvalidaError si falta el bloque del proveedor en la config", async () => {
    await expect(
      ejecutarDespliegue(
        entradaBase({ nombreProveedor: "azure", configCruda: CONFIG_CRUDA_VALIDA }),
        new Map([["azure", () => new ProveedorFalso()]]),
      ),
    ).rejects.toThrow(ConfiguracionInvalidaError);
  });

  it("falla con ProveedorNoImplementadoError si el proveedor no está en el registro", async () => {
    await expect(
      ejecutarDespliegue(entradaBase({ nombreProveedor: "azure" }), new Map()),
    ).rejects.toThrow(ProveedorNoImplementadoError);
  });
});

describe("codigoSalidaParaError", () => {
  it.each([
    [new ConfiguracionInvalidaError("x"), 1],
    [new PrerrequisitoError("x"), 2],
    [new ComandoFallidoError("x", "imagen"), 3],
    [new ProveedorNoImplementadoError("x"), 4],
    [new Error("inesperado"), 1],
  ] as const)("mapea %o a %i", (error, esperado) => {
    expect(codigoSalidaParaError(error)).toBe(esperado);
  });
});
