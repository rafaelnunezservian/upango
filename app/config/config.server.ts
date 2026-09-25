import { z } from "zod";

/** Error de arranque: la configuración del entorno (CT-09) es inválida. */
export class ConfiguracionInvalidaError extends Error {
  constructor(
    message: string,
    readonly variablesFaltantesOInvalidas: readonly string[],
  ) {
    super(message);
    this.name = "ConfiguracionInvalidaError";
  }
}

const esquemaBooleano = z
  .string()
  .optional()
  .transform((valor) => valor === "true");

const esquemaEntero = (porDefecto: number) =>
  z.coerce.number().int().positive().default(porDefecto);

const esquemaBase = z.object({
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_APP_URL: z.string().min(1),
  SCOPES: z.string().min(1),
  PORT: esquemaEntero(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SESSION_STORAGE_DRIVER: z.enum(["memoria", "firestore"]).optional(),
  FIRESTORE_PROJECT_ID: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().default("(default)"),
  FIRESTORE_COLECCION_SESIONES: z.string().default("shopify_sessions"),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  PUNTOS_CACHE_TTL_SEGUNDOS: esquemaEntero(300),
  PUNTOS_CACHE_STALE_MAX_SEGUNDOS: esquemaEntero(86400),
  PUNTOS_TAMANO_PAGINA: z.coerce.number().int().positive().max(250).default(250),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HABILITAR_SEMILLA: esquemaBooleano,
  SHOP_CUSTOM_DOMAIN: z.string().optional(),
});

export interface Configuracion {
  readonly shopifyApiKey: string;
  readonly shopifyApiSecret: string;
  readonly shopifyAppUrl: string;
  readonly scopes: readonly string[];
  readonly puerto: number;
  readonly nodeEnv: "development" | "production" | "test";
  readonly sessionStorageDriver: "memoria" | "firestore";
  readonly firestoreProjectId: string | undefined;
  readonly firestoreDatabaseId: string;
  readonly firestoreColeccionSesiones: string;
  readonly firestoreEmulatorHost: string | undefined;
  readonly puntosCacheTtlSegundos: number;
  readonly puntosCacheStaleMaxSegundos: number;
  readonly puntosTamanoPagina: number;
  readonly logLevel: "debug" | "info" | "warn" | "error";
  readonly habilitarSemilla: boolean;
  readonly shopCustomDomain: string | undefined;
}

/**
 * Valida `env` contra el esquema del CT-09 y arma el objeto de
 * configuración tipado e inmutable. Función pura, sin efectos de proceso,
 * para poder probarla sin arrancar el servidor (FR-076).
 */
export function validarConfiguracion(
  env: Readonly<Record<string, string | undefined>>,
): Configuracion {
  const resultado = esquemaBase.safeParse(env);
  if (!resultado.success) {
    const variables = [
      ...new Set(resultado.error.issues.map((problema) => String(problema.path[0]))),
    ];
    throw new ConfiguracionInvalidaError(
      `Configuración inválida: faltan o son inválidas las variables de entorno: ${variables.join(", ")}. Revisa .env.example.`,
      variables,
    );
  }

  const datos = resultado.data;
  const sessionStorageDriver =
    datos.SESSION_STORAGE_DRIVER ??
    (datos.NODE_ENV === "production" ? "firestore" : "memoria");

  if (datos.HABILITAR_SEMILLA && datos.NODE_ENV === "production") {
    throw new ConfiguracionInvalidaError(
      "HABILITAR_SEMILLA no puede ser 'true' con NODE_ENV=production (FR-005): la herramienta de semilla es solo para desarrollo.",
      ["HABILITAR_SEMILLA"],
    );
  }

  return Object.freeze({
    shopifyApiKey: datos.SHOPIFY_API_KEY,
    shopifyApiSecret: datos.SHOPIFY_API_SECRET,
    shopifyAppUrl: datos.SHOPIFY_APP_URL,
    scopes: Object.freeze(datos.SCOPES.split(",").map((s) => s.trim())),
    puerto: datos.PORT,
    nodeEnv: datos.NODE_ENV,
    sessionStorageDriver,
    firestoreProjectId: datos.FIRESTORE_PROJECT_ID,
    firestoreDatabaseId: datos.FIRESTORE_DATABASE_ID,
    firestoreColeccionSesiones: datos.FIRESTORE_COLECCION_SESIONES,
    firestoreEmulatorHost: datos.FIRESTORE_EMULATOR_HOST,
    puntosCacheTtlSegundos: datos.PUNTOS_CACHE_TTL_SEGUNDOS,
    puntosCacheStaleMaxSegundos: datos.PUNTOS_CACHE_STALE_MAX_SEGUNDOS,
    puntosTamanoPagina: datos.PUNTOS_TAMANO_PAGINA,
    logLevel: datos.LOG_LEVEL,
    habilitarSemilla: datos.HABILITAR_SEMILLA,
    shopCustomDomain: datos.SHOP_CUSTOM_DOMAIN,
  });
}

/**
 * Valida `process.env` y, si es inválido, registra un evento
 * `config.invalida` (solo con los NOMBRES de las variables, nunca sus
 * valores) y termina el proceso con código distinto de 0 (FR-076). Solo la
 * usa el composition root (`app/composition/contenedor.server.ts`); el
 * resto del código depende de `validarConfiguracion`, que es pura.
 */
export function cargarConfiguracionOSalir(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Configuracion {
  try {
    return validarConfiguracion(env);
  } catch (error) {
    if (error instanceof ConfiguracionInvalidaError) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          severity: "ERROR",
          evento: "config.invalida",
          mensaje: error.message,
          variables: error.variablesFaltantesOInvalidas,
        }),
      );
      process.exit(1);
    }
    throw error;
  }
}
