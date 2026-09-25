import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ComandoFallidoError, ConfiguracionInvalidaError, PrerrequisitoError } from "../../dominio/errores.js";
import type { Consola, ContextoDespliegue, EjecutorComandos, ReferenciaImagen } from "../../puertos/index.js";
import { ProveedorGcp } from "./ProveedorGcp.js";

interface Llamada {
  readonly programa: string;
  readonly argumentos: readonly string[];
  readonly opciones: { readonly entrada?: string } | undefined;
}

class EjecutorFalso implements EjecutorComandos {
  readonly llamadas: Llamada[] = [];
  private readonly respuestas: Array<{
    prefijo: readonly string[];
    respuesta: { codigo: number; salida: string; error: string };
  }> = [];

  responder(prefijo: readonly string[], respuesta: { codigo: number; salida?: string; error?: string }): void {
    this.respuestas.push({
      prefijo,
      respuesta: { codigo: respuesta.codigo, salida: respuesta.salida ?? "", error: respuesta.error ?? "" },
    });
  }

  async ejecutar(
    programa: string,
    argumentos: readonly string[],
    opciones?: { readonly entrada?: string },
  ): Promise<{ readonly codigo: number; readonly salida: string; readonly error: string }> {
    this.llamadas.push({ programa, argumentos, opciones });
    const encontrada = this.respuestas.find(({ prefijo }) =>
      prefijo.every((valor, indice) => argumentos[indice] === valor),
    );
    return encontrada?.respuesta ?? { codigo: 0, salida: "", error: "" };
  }
}

const CONSOLA_MUDA: Consola = {
  info: () => {},
  advertencia: () => {},
  error: () => {},
  comando: () => {},
};

function ctxDe(sobrescribe: Partial<ContextoDespliegue> = {}): ContextoDespliegue {
  return {
    config: {
      servicio: "puntos-recogida",
      puerto: 8080,
      recursos: { cpu: 1, memoriaMiB: 512, instanciasMin: 0, instanciasMax: 3, concurrencia: 80 },
      variables: { NODE_ENV: "production", SHOPIFY_APP_URL: "" },
      variablesDesdeEntorno: ["SHOPIFY_API_KEY", "SHOPIFY_APP_URL"],
      secretos: { SHOPIFY_API_SECRET: "shopify-api-secret" },
      proveedores: {},
    },
    proveedor: {
      proyecto: "proyecto-x",
      region: "europe-southwest1",
      repositorioImagenes: "puntos-recogida",
      cuentaServicio: "puntos-recogida-run",
      baseFirestore: "(default)",
    },
    etiquetaImagen: "20260925-1530-a1b2c3d",
    simulacion: false,
    consola: CONSOLA_MUDA,
    ...sobrescribe,
  };
}

const EMAIL_CUENTA = "puntos-recogida-run@proyecto-x.iam.gserviceaccount.com";

describe("ProveedorGcp.verificarPrerrequisitos", () => {
  it("pasa cuando gcloud, la cuenta activa y el proyecto son válidos", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["--version"], { codigo: 0, salida: "Google Cloud SDK 500.0.0" });
    ejecutor.responder(["auth", "list"], { codigo: 0, salida: "operador@ejemplo.com\n" });
    ejecutor.responder(["projects", "describe"], { codigo: 0, salida: "123456789\n" });

    await expect(new ProveedorGcp(ejecutor).verificarPrerrequisitos(ctxDe())).resolves.toBeUndefined();

    expect(ejecutor.llamadas[0]?.argumentos).toEqual(["--version"]);
    expect(ejecutor.llamadas[1]?.argumentos).toEqual([
      "auth",
      "list",
      "--filter=status:ACTIVE",
      "--format=value(account)",
    ]);
    expect(ejecutor.llamadas[2]?.argumentos).toEqual([
      "projects",
      "describe",
      "proyecto-x",
      "--format=value(projectNumber)",
    ]);
  });

  it("falla con PrerrequisitoError si gcloud no está instalado", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["--version"], { codigo: 127, error: "command not found" });

    await expect(new ProveedorGcp(ejecutor).verificarPrerrequisitos(ctxDe())).rejects.toThrow(
      PrerrequisitoError,
    );
  });

  it("falla con PrerrequisitoError si no hay ninguna cuenta activa", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["--version"], { codigo: 0 });
    ejecutor.responder(["auth", "list"], { codigo: 0, salida: "" });

    await expect(new ProveedorGcp(ejecutor).verificarPrerrequisitos(ctxDe())).rejects.toThrow(
      PrerrequisitoError,
    );
  });

  it("falla con PrerrequisitoError si no se puede leer el proyecto", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["--version"], { codigo: 0 });
    ejecutor.responder(["auth", "list"], { codigo: 0, salida: "operador@ejemplo.com" });
    ejecutor.responder(["projects", "describe"], { codigo: 1, error: "PERMISSION_DENIED" });

    await expect(new ProveedorGcp(ejecutor).verificarPrerrequisitos(ctxDe())).rejects.toThrow(
      PrerrequisitoError,
    );
  });

  it("en --dry-run nunca falla, aunque los comandos fallarían de verdad", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["--version"], { codigo: 127 });
    ejecutor.responder(["auth", "list"], { codigo: 0, salida: "" });
    ejecutor.responder(["projects", "describe"], { codigo: 1 });

    await expect(
      new ProveedorGcp(ejecutor).verificarPrerrequisitos(ctxDe({ simulacion: true })),
    ).resolves.toBeUndefined();
  });
});

describe("ProveedorGcp.prepararInfraestructura", () => {
  it("habilita los 5 servicios y agrega el binding de IAM siempre", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["artifacts", "repositories", "describe"], { codigo: 0 });
    ejecutor.responder(["firestore", "databases", "describe"], { codigo: 0 });
    ejecutor.responder(["iam", "service-accounts", "describe"], { codigo: 0 });

    await new ProveedorGcp(ejecutor).prepararInfraestructura(ctxDe());

    expect(ejecutor.llamadas[0]?.argumentos).toEqual([
      "services",
      "enable",
      "run.googleapis.com",
      "cloudbuild.googleapis.com",
      "artifactregistry.googleapis.com",
      "firestore.googleapis.com",
      "secretmanager.googleapis.com",
    ]);
    const binding = ejecutor.llamadas.find((l) => l.argumentos[0] === "projects");
    expect(binding?.argumentos).toEqual([
      "projects",
      "add-iam-policy-binding",
      "proyecto-x",
      `--member=serviceAccount:${EMAIL_CUENTA}`,
      "--role=roles/datastore.user",
    ]);
  });

  it("no crea el repositorio/base/cuenta si ya existen (idempotencia)", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["artifacts", "repositories", "describe"], { codigo: 0 });
    ejecutor.responder(["firestore", "databases", "describe"], { codigo: 0 });
    ejecutor.responder(["iam", "service-accounts", "describe"], { codigo: 0 });

    await new ProveedorGcp(ejecutor).prepararInfraestructura(ctxDe());

    expect(ejecutor.llamadas.some((l) => l.argumentos[2] === "create")).toBe(false);
  });

  it("crea el repositorio, la base y la cuenta si `describe` no los encuentra", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["artifacts", "repositories", "describe"], { codigo: 1 });
    ejecutor.responder(["firestore", "databases", "describe"], { codigo: 1 });
    ejecutor.responder(["iam", "service-accounts", "describe"], { codigo: 1 });

    await new ProveedorGcp(ejecutor).prepararInfraestructura(ctxDe());

    expect(ejecutor.llamadas).toContainEqual(
      expect.objectContaining({
        argumentos: [
          "artifacts",
          "repositories",
          "create",
          "puntos-recogida",
          "--repository-format=docker",
          "--location=europe-southwest1",
        ],
      }),
    );
    expect(ejecutor.llamadas).toContainEqual(
      expect.objectContaining({
        argumentos: [
          "firestore",
          "databases",
          "create",
          "--database=(default)",
          "--location=europe-southwest1",
          "--type=firestore-native",
        ],
      }),
    );
    expect(ejecutor.llamadas).toContainEqual(
      expect.objectContaining({
        argumentos: [
          "iam",
          "service-accounts",
          "create",
          "puntos-recogida-run",
          "--display-name=Puntos de Recogida (Cloud Run)",
        ],
      }),
    );
  });

  it("propaga ComandoFallidoError si `services enable` falla", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["services", "enable"], { codigo: 1, error: "boom" });

    await expect(new ProveedorGcp(ejecutor).prepararInfraestructura(ctxDe())).rejects.toThrow(
      ComandoFallidoError,
    );
  });
});

describe("ProveedorGcp.publicarSecretos", () => {
  it("falla con ConfiguracionInvalidaError si falta el valor del secreto", async () => {
    const ejecutor = new EjecutorFalso();
    await expect(new ProveedorGcp(ejecutor).publicarSecretos(ctxDe(), {})).rejects.toThrow(
      ConfiguracionInvalidaError,
    );
  });

  it("crea el secreto y publica el valor por stdin cuando no existía", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["secrets", "describe"], { codigo: 1 });

    await new ProveedorGcp(ejecutor).publicarSecretos(ctxDe(), { SHOPIFY_API_SECRET: "shh" });

    expect(ejecutor.llamadas).toContainEqual(
      expect.objectContaining({
        argumentos: ["secrets", "create", "shopify-api-secret", "--replication-policy=automatic"],
      }),
    );
    const versionAdd = ejecutor.llamadas.find((l) => l.argumentos[2] === "add");
    expect(versionAdd?.argumentos).toEqual([
      "secrets",
      "versions",
      "add",
      "shopify-api-secret",
      "--data-file=-",
    ]);
    expect(versionAdd?.opciones?.entrada).toBe("shh");
    // El valor nunca viaja como argumento del proceso.
    expect(ejecutor.llamadas.flatMap((l) => l.argumentos)).not.toContain("shh");
  });

  it("no publica una versión nueva si el secreto ya existe y el valor no cambió", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["secrets", "describe"], { codigo: 0 });
    ejecutor.responder(["secrets", "versions", "access"], { codigo: 0, salida: "shh\n" });

    await new ProveedorGcp(ejecutor).publicarSecretos(ctxDe(), { SHOPIFY_API_SECRET: "shh" });

    expect(ejecutor.llamadas.some((l) => l.argumentos[1] === "create")).toBe(false);
    expect(ejecutor.llamadas.some((l) => l.argumentos[2] === "add")).toBe(false);
    // El binding de IAM se reintenta siempre, sea o no la primera vez.
    expect(ejecutor.llamadas).toContainEqual(
      expect.objectContaining({
        argumentos: [
          "secrets",
          "add-iam-policy-binding",
          "shopify-api-secret",
          `--member=serviceAccount:${EMAIL_CUENTA}`,
          "--role=roles/secretmanager.secretAccessor",
        ],
      }),
    );
  });

  it("publica una versión nueva si el secreto ya existe pero el valor cambió", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["secrets", "describe"], { codigo: 0 });
    ejecutor.responder(["secrets", "versions", "access"], { codigo: 0, salida: "valor-viejo" });

    await new ProveedorGcp(ejecutor).publicarSecretos(ctxDe(), { SHOPIFY_API_SECRET: "valor-nuevo" });

    const versionAdd = ejecutor.llamadas.find((l) => l.argumentos[2] === "add");
    expect(versionAdd?.opciones?.entrada).toBe("valor-nuevo");
  });
});

describe("ProveedorGcp.construirImagen", () => {
  it("arma la URI determinista y llama a `gcloud builds submit`", async () => {
    const ejecutor = new EjecutorFalso();
    const imagen = await new ProveedorGcp(ejecutor).construirImagen(ctxDe());

    expect(imagen.uriCompleta).toBe(
      "europe-southwest1-docker.pkg.dev/proyecto-x/puntos-recogida/puntos-recogida:20260925-1530-a1b2c3d",
    );
    expect(ejecutor.llamadas[0]?.argumentos).toEqual([
      "builds",
      "submit",
      "--tag",
      imagen.uriCompleta,
      ".",
    ]);
  });
});

describe("ProveedorGcp.desplegarServicio", () => {
  const IMAGEN: ReferenciaImagen = {
    uriCompleta: "europe-southwest1-docker.pkg.dev/proyecto-x/puntos-recogida/puntos-recogida:tag",
    etiqueta: "tag",
  };

  it("despliega con las flags exactas y borra el archivo temporal de variables", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["projects", "describe"], { codigo: 0, salida: "123456789" });

    let rutaArchivoDuranteElComando: string | undefined;
    const ejecutorOriginal = ejecutor.ejecutar.bind(ejecutor);
    ejecutor.ejecutar = async (programa, argumentos, opciones) => {
      const indice = argumentos.indexOf("--env-vars-file");
      if (indice !== -1) {
        rutaArchivoDuranteElComando = argumentos[indice + 1];
        expect(existsSync(rutaArchivoDuranteElComando!)).toBe(true);
      }
      return ejecutorOriginal(programa, argumentos, opciones);
    };
    ejecutor.responder(["run", "deploy"], {
      codigo: 0,
      salida: JSON.stringify({
        status: { url: "https://puntos-recogida-123456789.europe-southwest1.run.app", latestReadyRevisionName: "puntos-recogida-00001-abc" },
      }),
    });

    const resultado = await new ProveedorGcp(ejecutor).desplegarServicio(ctxDe(), IMAGEN);

    expect(resultado).toEqual({
      url: "https://puntos-recogida-123456789.europe-southwest1.run.app",
      revision: "puntos-recogida-00001-abc",
    });
    expect(rutaArchivoDuranteElComando).toBeDefined();
    expect(existsSync(rutaArchivoDuranteElComando!)).toBe(false);

    const despliegue = ejecutor.llamadas.find((l) => l.argumentos[0] === "run" && l.argumentos[1] === "deploy");
    expect(despliegue?.argumentos).toEqual([
      "run",
      "deploy",
      "puntos-recogida",
      "--image",
      IMAGEN.uriCompleta,
      "--region",
      "europe-southwest1",
      "--service-account",
      EMAIL_CUENTA,
      "--allow-unauthenticated",
      "--port",
      "8080",
      "--cpu",
      "1",
      "--memory",
      "512Mi",
      "--min-instances",
      "0",
      "--max-instances",
      "3",
      "--concurrency",
      "80",
      "--env-vars-file",
      rutaArchivoDuranteElComando,
      "--set-secrets",
      "SHOPIFY_API_SECRET=shopify-api-secret:latest",
      "--format=json",
    ]);
  });

  it("usa la URL determinista de Cloud Run como SHOPIFY_APP_URL cuando todavía no se conoce", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["projects", "describe"], { codigo: 0, salida: "999" });
    ejecutor.responder(["run", "deploy"], {
      codigo: 0,
      salida: JSON.stringify({
        status: {
          url: "https://puntos-recogida-999.europe-southwest1.run.app",
          latestReadyRevisionName: "rev-1",
        },
      }),
    });

    let contenidoArchivo = "";
    const ejecutorOriginal = ejecutor.ejecutar.bind(ejecutor);
    ejecutor.ejecutar = async (programa, argumentos, opciones) => {
      const indice = argumentos.indexOf("--env-vars-file");
      if (indice !== -1) {
        contenidoArchivo = readFileSync(argumentos[indice + 1]!, "utf8");
      }
      return ejecutorOriginal(programa, argumentos, opciones);
    };

    await new ProveedorGcp(ejecutor).desplegarServicio(ctxDe(), IMAGEN);

    expect(contenidoArchivo).toContain(
      'SHOPIFY_APP_URL: "https://puntos-recogida-999.europe-southwest1.run.app"',
    );
  });

  it("no revienta si `--dry-run` no devuelve JSON real", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["projects", "describe"], { codigo: 0, salida: "" });

    const resultado = await new ProveedorGcp(ejecutor).desplegarServicio(
      ctxDe({ simulacion: true }),
      IMAGEN,
    );

    expect(resultado.url).toMatch(/^https:\/\/puntos-recogida-/);
  });

  it("falla con ComandoFallidoError si la salida no trae status.url", async () => {
    const ejecutor = new EjecutorFalso();
    ejecutor.responder(["projects", "describe"], { codigo: 0, salida: "123" });
    ejecutor.responder(["run", "deploy"], { codigo: 0, salida: "{}" });

    await expect(new ProveedorGcp(ejecutor).desplegarServicio(ctxDe(), IMAGEN)).rejects.toThrow(
      ComandoFallidoError,
    );
  });
});

describe("ProveedorGcp.actualizarVariables", () => {
  it("llama a `gcloud run services update` con las variables exactas", async () => {
    const ejecutor = new EjecutorFalso();
    await new ProveedorGcp(ejecutor).actualizarVariables(ctxDe(), {
      SHOPIFY_APP_URL: "https://real.run.app",
    });

    expect(ejecutor.llamadas[0]?.argumentos).toEqual([
      "run",
      "services",
      "update",
      "puntos-recogida",
      "--region",
      "europe-southwest1",
      "--update-env-vars",
      "SHOPIFY_APP_URL=https://real.run.app",
    ]);
  });
});
