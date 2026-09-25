import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ejecutarDespliegue, codigoSalidaParaError } from "./aplicacion/OrquestadorDespliegue.js";
import { validarConfigDespliegue } from "./dominio/configDespliegue.js";
import { ConfiguracionInvalidaError } from "./dominio/errores.js";
import { esPasoValido, PASOS, type Paso } from "./dominio/pasos.js";
import { ConsolaNode } from "./infraestructura/ConsolaNode.js";
import { EjecutorComandosNode } from "./infraestructura/EjecutorComandosNode.js";
import { etiquetaPorDefecto } from "./infraestructura/etiquetaPorDefecto.js";
import { leerEnvDeploy } from "./infraestructura/leerEnvDeploy.js";
import { crearRegistroProveedores } from "./proveedores/registro.js";

const RAIZ_DEPLOY = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ_REPO = join(RAIZ_DEPLOY, "..");

interface OpcionesCli {
  readonly proveedor: string;
  readonly dryRun: boolean;
  readonly paso: Paso;
  readonly etiqueta: string | undefined;
}

/** Parsea `--proveedor/--dry-run/--paso/--etiqueta` (CT-10). Nunca toca el entorno ni el disco. */
function parsearArgv(argv: readonly string[]): OpcionesCli {
  let proveedor: string | undefined;
  let dryRun = false;
  let paso = "todo";
  let etiqueta: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--proveedor":
        proveedor = argv[++i];
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--paso":
        paso = argv[++i] ?? "";
        break;
      case "--etiqueta":
        etiqueta = argv[++i];
        break;
      default:
        throw new ConfiguracionInvalidaError(`Opción desconocida: "${arg}".`);
    }
  }

  if (!proveedor) {
    throw new ConfiguracionInvalidaError(
      'Falta "--proveedor <nombre>" (por ejemplo: npm run deploy -- --proveedor gcp).',
    );
  }
  if (!esPasoValido(paso)) {
    throw new ConfiguracionInvalidaError(
      `"--paso" inválido: "${paso}". Debe ser uno de: ${PASOS.join(", ")}.`,
    );
  }

  return { proveedor, dryRun, paso, etiqueta };
}

function cargarConfigCruda(): unknown {
  const ruta = join(RAIZ_DEPLOY, "deploy.config.json");
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch (error) {
    throw new ConfiguracionInvalidaError(
      `No se pudo leer/parsear ${ruta}: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
}

/** Resuelve `variablesDesdeEntorno` y `secretos` del entorno/`.env.deploy` (FR-079). `SHOPIFY_APP_URL` es la única variable que puede llegar vacía: el proveedor calcula un valor por defecto para el primer despliegue. */
function resolverEntorno(
  variablesDesdeEntorno: readonly string[],
  nombresDeSecretos: readonly string[],
  entorno: Readonly<Record<string, string | undefined>>,
): { readonly variablesEntorno: Record<string, string>; readonly secretos: Record<string, string> } {
  const variablesEntorno: Record<string, string> = {};
  for (const nombre of variablesDesdeEntorno) {
    const valor = entorno[nombre] ?? "";
    if (!valor && nombre !== "SHOPIFY_APP_URL") {
      throw new ConfiguracionInvalidaError(
        `Falta la variable de entorno "${nombre}" (defínela en el entorno o en .env.deploy).`,
      );
    }
    variablesEntorno[nombre] = valor;
  }

  const secretos: Record<string, string> = {};
  for (const nombreVariable of nombresDeSecretos) {
    const valor = entorno[nombreVariable];
    if (!valor) {
      throw new ConfiguracionInvalidaError(
        `Falta el secreto "${nombreVariable}" (defínelo en el entorno o en .env.deploy).`,
      );
    }
    secretos[nombreVariable] = valor;
  }

  return { variablesEntorno, secretos };
}

async function main(): Promise<void> {
  const consola = new ConsolaNode();
  const opciones = parsearArgv(process.argv.slice(2));

  const configCruda = cargarConfigCruda();
  const config = validarConfigDespliegue(configCruda);

  const entornoArchivo = leerEnvDeploy(join(RAIZ_REPO, ".env.deploy"));
  const entorno = { ...entornoArchivo, ...process.env };

  const { variablesEntorno, secretos } = resolverEntorno(
    config.variablesDesdeEntorno,
    Object.keys(config.secretos),
    entorno,
  );

  const ejecutor = new EjecutorComandosNode({ simulacion: opciones.dryRun, consola });
  const registro = crearRegistroProveedores(ejecutor);

  await ejecutarDespliegue(
    {
      configCruda,
      nombreProveedor: opciones.proveedor,
      etiquetaImagen: opciones.etiqueta ?? etiquetaPorDefecto(),
      simulacion: opciones.dryRun,
      paso: opciones.paso,
      secretos,
      variablesEntorno,
      consola,
    },
    registro,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : String(error);
    new ConsolaNode().error(mensaje);
    process.exit(codigoSalidaParaError(error));
  });
