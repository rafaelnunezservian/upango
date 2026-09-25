import { z } from "zod";
import type { ConfigDespliegue } from "../puertos/index.js";
import { ConfiguracionInvalidaError } from "./errores.js";

/**
 * Esquema neutral de `deploy.config.json` (CT-10). Deliberadamente NO valida
 * la forma interna de cada bloque de `proveedores` (por ejemplo, el de
 * `gcp`): eso lo hace el propio `ProveedorDespliegue` (OCP, §20.7) para que
 * agregar un proveedor no obligue a tocar este esquema neutral.
 */
const esquemaRecursos = z.object({
  cpu: z.number().positive(),
  memoriaMiB: z.number().int().positive(),
  instanciasMin: z.number().int().nonnegative(),
  instanciasMax: z.number().int().positive(),
  concurrencia: z.number().int().positive(),
});

const esquemaConfigDespliegue = z.object({
  servicio: z.string().min(1),
  puerto: z.number().int().positive(),
  recursos: esquemaRecursos,
  variables: z.record(z.string()),
  variablesDesdeEntorno: z.array(z.string()),
  secretos: z.record(z.string()),
  proveedores: z.record(z.record(z.unknown())),
});

/**
 * Valida el JSON crudo de `deploy.config.json` (paso 1 del orquestador,
 * §20.3). Función pura: no lee el sistema de archivos ni el entorno.
 */
export function validarConfigDespliegue(json: unknown): ConfigDespliegue {
  const resultado = esquemaConfigDespliegue.safeParse(json);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("; ");
    throw new ConfiguracionInvalidaError(
      `deploy/deploy.config.json inválido: ${problemas}.`,
    );
  }
  return Object.freeze(resultado.data) as ConfigDespliegue;
}
