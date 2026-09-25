import { ComandoFallidoError, ConfiguracionInvalidaError, PrerrequisitoError } from "../../dominio/errores.js";
import type {
  ContextoDespliegue,
  EjecutorComandos,
  ProveedorDespliegue,
  ReferenciaImagen,
  ResultadoDespliegue,
  Secretos,
} from "../../puertos/index.js";
import { conArchivoDeVariables } from "./archivoVariables.js";
import { type ConfigGcp, emailCuentaServicio, validarConfigGcp } from "./config.js";

/**
 * Adaptador de Google Cloud (§20.4, CT-10). Traduce cada método de
 * `ProveedorDespliegue` a comandos `gcloud`, ejecutados solo a través de
 * `EjecutorComandos` (nunca invoca un SDK de nube directamente, FR-083).
 *
 * En `--dry-run`, las comprobaciones de existencia (`describe`) se tratan
 * siempre como "no existe": como `EjecutorComandos` en modo simulación no
 * ejecuta nada de verdad (T114), no hay forma honesta de saber si el
 * recurso ya existe, así que se prefiere mostrar el comando de creación de
 * más (el escenario de un proyecto vacío, que es el que describe el README)
 * a ocultarlo.
 */
export class ProveedorGcp implements ProveedorDespliegue {
  readonly nombre = "gcp";

  constructor(private readonly ejecutor: EjecutorComandos) {}

  async verificarPrerrequisitos(ctx: ContextoDespliegue): Promise<void> {
    const config = validarConfigGcp(ctx.proveedor);

    const version = await this.ejecutor.ejecutar("gcloud", ["--version"]);
    if (!ctx.simulacion && version.codigo !== 0) {
      throw new PrerrequisitoError(
        "gcloud no está instalado o no es accesible. Instala Google Cloud CLI: " +
          "https://cloud.google.com/sdk/docs/install.",
      );
    }

    const cuenta = await this.ejecutor.ejecutar("gcloud", [
      "auth",
      "list",
      "--filter=status:ACTIVE",
      "--format=value(account)",
    ]);
    if (!ctx.simulacion && (cuenta.codigo !== 0 || !cuenta.salida.trim())) {
      throw new PrerrequisitoError('No hay ninguna cuenta activa. Ejecuta "gcloud auth login".');
    }

    await this.numeroDeProyecto(ctx, config);
  }

  async prepararInfraestructura(ctx: ContextoDespliegue): Promise<void> {
    const config = validarConfigGcp(ctx.proveedor);
    const email = emailCuentaServicio(config);

    await this.ejecutarPaso("infraestructura", [
      "services",
      "enable",
      "run.googleapis.com",
      "cloudbuild.googleapis.com",
      "artifactregistry.googleapis.com",
      "firestore.googleapis.com",
      "secretmanager.googleapis.com",
    ]);

    const repoExiste = await this.existeOSimulado(ctx, [
      "artifacts",
      "repositories",
      "describe",
      config.repositorioImagenes,
      `--location=${config.region}`,
    ]);
    if (!repoExiste) {
      await this.ejecutarPaso("infraestructura", [
        "artifacts",
        "repositories",
        "create",
        config.repositorioImagenes,
        "--repository-format=docker",
        `--location=${config.region}`,
      ]);
    }

    const baseExiste = await this.existeOSimulado(ctx, [
      "firestore",
      "databases",
      "describe",
      `--database=${config.baseFirestore}`,
    ]);
    if (!baseExiste) {
      await this.ejecutarPaso("infraestructura", [
        "firestore",
        "databases",
        "create",
        `--database=${config.baseFirestore}`,
        `--location=${config.region}`,
        "--type=firestore-native",
      ]);
    }

    const cuentaExiste = await this.existeOSimulado(ctx, [
      "iam",
      "service-accounts",
      "describe",
      email,
    ]);
    if (!cuentaExiste) {
      await this.ejecutarPaso("infraestructura", [
        "iam",
        "service-accounts",
        "create",
        config.cuentaServicio,
        "--display-name=Puntos de Recogida (Cloud Run)",
      ]);
    }

    await this.ejecutarPaso("infraestructura", [
      "projects",
      "add-iam-policy-binding",
      config.proyecto,
      `--member=serviceAccount:${email}`,
      "--role=roles/datastore.user",
    ]);
  }

  async publicarSecretos(ctx: ContextoDespliegue, secretos: Secretos): Promise<void> {
    const config = validarConfigGcp(ctx.proveedor);
    const email = emailCuentaServicio(config);

    for (const [nombreVariable, nombreSecreto] of Object.entries(ctx.config.secretos)) {
      const valor = secretos[nombreVariable];
      if (valor === undefined) {
        throw new ConfiguracionInvalidaError(
          `Falta el valor del secreto "${nombreVariable}" (defínelo en el entorno o en .env.deploy).`,
        );
      }

      const existe = await this.existeOSimulado(ctx, ["secrets", "describe", nombreSecreto]);
      if (!existe) {
        await this.ejecutarPaso("secretos", [
          "secrets",
          "create",
          nombreSecreto,
          "--replication-policy=automatic",
        ]);
      }

      if (await this.valorSecretoCambio(ctx, nombreSecreto, valor)) {
        await this.ejecutarPaso(
          "secretos",
          ["secrets", "versions", "add", nombreSecreto, "--data-file=-"],
          { entrada: valor },
        );
      }

      await this.ejecutarPaso("secretos", [
        "secrets",
        "add-iam-policy-binding",
        nombreSecreto,
        `--member=serviceAccount:${email}`,
        "--role=roles/secretmanager.secretAccessor",
      ]);
    }
  }

  async construirImagen(ctx: ContextoDespliegue): Promise<ReferenciaImagen> {
    const config = validarConfigGcp(ctx.proveedor);
    const uriCompleta = uriImagen(config, ctx.config.servicio, ctx.etiquetaImagen);

    await this.ejecutarPaso("imagen", ["builds", "submit", "--tag", uriCompleta, "."]);

    return { uriCompleta, etiqueta: ctx.etiquetaImagen };
  }

  async desplegarServicio(
    ctx: ContextoDespliegue,
    imagen: ReferenciaImagen,
  ): Promise<ResultadoDespliegue> {
    const config = validarConfigGcp(ctx.proveedor);
    const email = emailCuentaServicio(config);
    const numeroProyecto = await this.numeroDeProyecto(ctx, config);
    const urlPorDefecto = `https://${ctx.config.servicio}-${numeroProyecto}.${config.region}.run.app`;

    const variables = { ...ctx.config.variables };
    if (!variables.SHOPIFY_APP_URL) {
      variables.SHOPIFY_APP_URL = urlPorDefecto;
    }

    const secretosArg = Object.entries(ctx.config.secretos)
      .map(([variable, secreto]) => `${variable}=${secreto}:latest`)
      .join(",");

    return conArchivoDeVariables(variables, async (rutaArchivo) => {
      const resultado = await this.ejecutarPaso("servicio", [
        "run",
        "deploy",
        ctx.config.servicio,
        "--image",
        imagen.uriCompleta,
        "--region",
        config.region,
        "--service-account",
        email,
        "--allow-unauthenticated",
        "--port",
        String(ctx.config.puerto),
        "--cpu",
        String(ctx.config.recursos.cpu),
        "--memory",
        `${ctx.config.recursos.memoriaMiB}Mi`,
        "--min-instances",
        String(ctx.config.recursos.instanciasMin),
        "--max-instances",
        String(ctx.config.recursos.instanciasMax),
        "--concurrency",
        String(ctx.config.recursos.concurrencia),
        "--env-vars-file",
        rutaArchivo,
        "--set-secrets",
        secretosArg,
        "--format=json",
      ]);

      if (ctx.simulacion) {
        return { url: urlPorDefecto, revision: "(dry-run: sin revisión real)" };
      }

      const datos = JSON.parse(resultado.salida) as {
        readonly status?: { readonly url?: string; readonly latestReadyRevisionName?: string };
      };
      const url = datos.status?.url;
      const revision = datos.status?.latestReadyRevisionName;
      if (!url || !revision) {
        throw new ComandoFallidoError(
          'gcloud run deploy no devolvió "status.url"/"status.latestReadyRevisionName" en su salida JSON.',
          "servicio",
        );
      }
      return { url, revision };
    });
  }

  async actualizarVariables(
    ctx: ContextoDespliegue,
    variables: Readonly<Record<string, string>>,
  ): Promise<void> {
    const config = validarConfigGcp(ctx.proveedor);
    const asignaciones = Object.entries(variables)
      .map(([clave, valor]) => `${clave}=${valor}`)
      .join(",");

    await this.ejecutarPaso("servicio", [
      "run",
      "services",
      "update",
      ctx.config.servicio,
      "--region",
      config.region,
      "--update-env-vars",
      asignaciones,
    ]);
  }

  private async numeroDeProyecto(ctx: ContextoDespliegue, config: ConfigGcp): Promise<string> {
    const resultado = await this.ejecutor.ejecutar("gcloud", [
      "projects",
      "describe",
      config.proyecto,
      "--format=value(projectNumber)",
    ]);
    if (ctx.simulacion) return resultado.salida.trim() || "0000000000";
    const numero = resultado.salida.trim();
    if (resultado.codigo !== 0 || !numero) {
      throw new PrerrequisitoError(
        `No se pudo obtener el número del proyecto "${config.proyecto}". Verifica el ID y tus ` +
          `permisos, o ejecuta "gcloud config set project ${config.proyecto}".`,
      );
    }
    return numero;
  }

  private async existeOSimulado(
    ctx: ContextoDespliegue,
    argumentosDescribe: readonly string[],
  ): Promise<boolean> {
    const resultado = await this.ejecutor.ejecutar("gcloud", argumentosDescribe);
    if (ctx.simulacion) return false;
    return resultado.codigo === 0;
  }

  private async valorSecretoCambio(
    ctx: ContextoDespliegue,
    nombreSecreto: string,
    valorNuevo: string,
  ): Promise<boolean> {
    const resultado = await this.ejecutor.ejecutar("gcloud", [
      "secrets",
      "versions",
      "access",
      "latest",
      `--secret=${nombreSecreto}`,
    ]);
    if (ctx.simulacion || resultado.codigo !== 0) return true;
    return resultado.salida.replace(/\r?\n$/, "") !== valorNuevo;
  }

  private async ejecutarPaso(
    paso: string,
    argumentos: readonly string[],
    opciones?: { readonly entrada?: string },
  ): Promise<{ readonly codigo: number; readonly salida: string; readonly error: string }> {
    const resultado = await this.ejecutor.ejecutar("gcloud", argumentos, opciones);
    if (resultado.codigo !== 0) {
      throw new ComandoFallidoError(
        `gcloud ${argumentos.join(" ")} falló en el paso "${paso}" (código ${resultado.codigo}): ` +
          `${resultado.error.trim() || resultado.salida.trim() || "sin salida"}.`,
        paso,
      );
    }
    return resultado;
  }
}

function uriImagen(config: ConfigGcp, servicio: string, etiqueta: string): string {
  return `${config.region}-docker.pkg.dev/${config.proyecto}/${config.repositorioImagenes}/${servicio}:${etiqueta}`;
}
