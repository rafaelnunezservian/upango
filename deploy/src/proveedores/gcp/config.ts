import { z } from "zod";
import { ConfiguracionInvalidaError } from "../../dominio/errores.js";
import type { ConfigProveedor } from "../../puertos/index.js";

/** Bloque `proveedores.gcp` de `deploy.config.json` (CT-10, §20.4). */
export interface ConfigGcp {
  readonly proyecto: string;
  readonly region: string;
  readonly repositorioImagenes: string;
  readonly cuentaServicio: string;
  readonly baseFirestore: string;
}

const esquemaConfigGcp = z.object({
  proyecto: z.string().min(1),
  region: z.string().min(1),
  repositorioImagenes: z.string().min(1),
  cuentaServicio: z.string().min(1),
  baseFirestore: z.string().min(1),
});

/**
 * Valida y castea el bloque opaco `proveedores.gcp`. Cada proveedor valida
 * el suyo (OCP, §20.7): el esquema neutral de `deploy.config.json` no sabe
 * qué campos necesita GCP.
 */
export function validarConfigGcp(bloque: ConfigProveedor): ConfigGcp {
  const resultado = esquemaConfigGcp.safeParse(bloque);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("; ");
    throw new ConfiguracionInvalidaError(
      `deploy/deploy.config.json inválido en "proveedores.gcp": ${problemas}.`,
    );
  }
  return resultado.data;
}

/** Email de la cuenta de servicio de Cloud Run, con la convención estándar de GCP. */
export function emailCuentaServicio(config: ConfigGcp): string {
  return `${config.cuentaServicio}@${config.proyecto}.iam.gserviceaccount.com`;
}
