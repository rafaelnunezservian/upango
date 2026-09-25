import { validarConfigDespliegue } from "../dominio/configDespliegue.js";
import {
  ComandoFallidoError,
  ConfiguracionInvalidaError,
  PrerrequisitoError,
  ProveedorNoImplementadoError,
} from "../dominio/errores.js";
import type { Paso } from "../dominio/pasos.js";
import type {
  Consola,
  ContextoDespliegue,
  ProveedorDespliegue,
  ResultadoDespliegue,
  Secretos,
} from "../puertos/index.js";

/** Fábrica de un proveedor concreto (`registro.ts`). Se llama una vez por ejecución. */
export type FabricaProveedor = () => ProveedorDespliegue;

export interface EntradaOrquestador {
  /** JSON crudo (todavía no validado) de `deploy.config.json`. */
  readonly configCruda: unknown;
  readonly nombreProveedor: string;
  readonly etiquetaImagen: string;
  readonly simulacion: boolean;
  readonly paso: Paso;
  /** Valores de `deploy.config.json#secretos` ya resueltos del entorno/`.env.deploy`. */
  readonly secretos: Secretos;
  /** Valores de `deploy.config.json#variablesDesdeEntorno` ya resueltos. */
  readonly variablesEntorno: Readonly<Record<string, string>>;
  readonly consola: Consola;
}

/**
 * Ejecuta los 8 pasos de §20.3 en orden (o uno solo con `--paso`). No conoce
 * ningún proveedor concreto: solo llama a los métodos de `ProveedorDespliegue`
 * (DIP). Devuelve el resultado del despliegue cuando corre el flujo completo;
 * `undefined` cuando corre un solo paso (no todos los pasos producen una URL).
 */
export async function ejecutarDespliegue(
  entrada: EntradaOrquestador,
  registro: ReadonlyMap<string, FabricaProveedor>,
): Promise<ResultadoDespliegue | undefined> {
  // Paso 1: validar la configuración.
  const config = validarConfigDespliegue(entrada.configCruda);

  const fabrica = registro.get(entrada.nombreProveedor);
  if (!fabrica) {
    throw new ProveedorNoImplementadoError(
      `El proveedor "${entrada.nombreProveedor}" no está implementado. Sigue la guía ` +
        `"Agregar un proveedor" del README para crear deploy/src/proveedores/${entrada.nombreProveedor}/.`,
    );
  }

  const bloqueProveedor = config.proveedores[entrada.nombreProveedor];
  if (!bloqueProveedor) {
    throw new ConfiguracionInvalidaError(
      `Falta el bloque "proveedores.${entrada.nombreProveedor}" en deploy/deploy.config.json.`,
    );
  }

  const configConVariablesResueltas = Object.freeze({
    ...config,
    variables: Object.freeze({ ...config.variables, ...entrada.variablesEntorno }),
  });

  const proveedor = fabrica();

  const ctx: ContextoDespliegue = Object.freeze({
    config: configConVariablesResueltas,
    proveedor: bloqueProveedor,
    etiquetaImagen: entrada.etiquetaImagen,
    simulacion: entrada.simulacion,
    consola: entrada.consola,
  });

  if (entrada.paso !== "todo") {
    await ejecutarUnPaso(entrada.paso, proveedor, ctx, entrada.secretos);
    return undefined;
  }

  await proveedor.verificarPrerrequisitos(ctx);
  await proveedor.prepararInfraestructura(ctx);
  await proveedor.publicarSecretos(ctx, entrada.secretos);
  const imagen = await proveedor.construirImagen(ctx);
  const resultado = await proveedor.desplegarServicio(ctx, imagen);

  const urlEsperada = ctx.config.variables.SHOPIFY_APP_URL;
  if (urlEsperada && urlEsperada !== resultado.url) {
    await proveedor.actualizarVariables(ctx, { SHOPIFY_APP_URL: resultado.url });
  }

  ctx.consola.info(
    `Despliegue completo. URL del servicio: ${resultado.url} (revisión ${resultado.revision}). ` +
      `Siguientes pasos: actualiza "application_url" y "redirect_urls" en shopify.app.toml con esta URL ` +
      `y ejecuta "npm run deploy:shopify".`,
  );

  return resultado;
}

async function ejecutarUnPaso(
  paso: Exclude<Paso, "todo">,
  proveedor: ProveedorDespliegue,
  ctx: ContextoDespliegue,
  secretos: Secretos,
): Promise<void> {
  switch (paso) {
    case "verificar":
      await proveedor.verificarPrerrequisitos(ctx);
      return;
    case "infraestructura":
      await proveedor.prepararInfraestructura(ctx);
      return;
    case "secretos":
      await proveedor.publicarSecretos(ctx, secretos);
      return;
    case "imagen":
      await proveedor.construirImagen(ctx);
      return;
    case "servicio": {
      const imagen = await proveedor.construirImagen(ctx);
      await proveedor.desplegarServicio(ctx, imagen);
      return;
    }
  }
}

/** Código de salida de la CLI (§CT-10) para un error propagado por el orquestador. `undefined` = éxito (0). */
export function codigoSalidaParaError(error: unknown): 1 | 2 | 3 | 4 {
  if (error instanceof ConfiguracionInvalidaError) return 1;
  if (error instanceof PrerrequisitoError) return 2;
  if (error instanceof ComandoFallidoError) return 3;
  if (error instanceof ProveedorNoImplementadoError) return 4;
  // Error inesperado (no previsto por el CT-10): se trata como configuración
  // inválida porque, igual que esa categoría, siempre es un error del
  // operador o del entorno anterior a hablar con el proveedor de nube.
  return 1;
}
