/**
 * Contratos del CLI de despliegue (CT-10). El orquestador y el `cli.ts`
 * dependen solo de estas interfaces; ningún proveedor concreto ni SDK de
 * nube se importa aquí (DIP, FR-078).
 */

/** Recursos de cómputo neutrales del servicio (§20.3, forma de `deploy.config.json`). */
export interface ConfigRecursos {
  readonly cpu: number;
  readonly memoriaMiB: number;
  readonly instanciasMin: number;
  readonly instanciasMax: number;
  readonly concurrencia: number;
}

/**
 * Bloque de configuración propio de un proveedor (`proveedores.<nombre>` en
 * `deploy.config.json`). El orquestador lo trata como opaco; cada
 * `ProveedorDespliegue` valida y castea su propio bloque (OCP: agregar un
 * proveedor no toca este tipo).
 */
export type ConfigProveedor = Readonly<Record<string, unknown>>;

/** `deploy.config.json` ya validado, con `variables` resuelta (JSON + entorno). */
export interface ConfigDespliegue {
  readonly servicio: string;
  readonly puerto: number;
  readonly recursos: ConfigRecursos;
  readonly variables: Readonly<Record<string, string>>;
  readonly variablesDesdeEntorno: readonly string[];
  readonly secretos: Readonly<Record<string, string>>;
  readonly proveedores: Readonly<Record<string, ConfigProveedor>>;
}

/** Valores de secretos ya resueltos (nombre de variable → valor), nunca impresos. */
export type Secretos = Readonly<Record<string, string>>;

/** Salida para el operador. Ninguna implementación debe imprimir secretos. */
export interface Consola {
  info(mensaje: string): void;
  advertencia(mensaje: string): void;
  error(mensaje: string): void;
  /** Muestra un comando que se ejecutaría (o se ejecutó). `tieneEntradaSecreta` reemplaza el valor de stdin por un marcador. */
  comando(
    programa: string,
    argumentos: readonly string[],
    opciones?: { readonly tieneEntradaSecreta?: boolean },
  ): void;
}

/** Referencia a la imagen de contenedor ya construida (o a construir). */
export interface ReferenciaImagen {
  readonly uriCompleta: string;
  readonly etiqueta: string;
}

/** Resultado de desplegar el servicio. */
export interface ResultadoDespliegue {
  readonly url: string;
  readonly revision: string;
}

/** Datos disponibles para cada paso del proveedor (CT-10). */
export interface ContextoDespliegue {
  readonly config: ConfigDespliegue;
  readonly proveedor: ConfigProveedor;
  readonly etiquetaImagen: string;
  readonly simulacion: boolean;
  readonly consola: Consola;
}

/**
 * Puerto que implementa cada proveedor de nube (CT-10). El orquestador solo
 * conoce esta interfaz: no sabe nada de `gcloud`, `az` ni de ningún otro CLI
 * (§20.3, FR-078).
 */
export interface ProveedorDespliegue {
  readonly nombre: string;
  verificarPrerrequisitos(ctx: ContextoDespliegue): Promise<void>;
  prepararInfraestructura(ctx: ContextoDespliegue): Promise<void>;
  publicarSecretos(ctx: ContextoDespliegue, secretos: Secretos): Promise<void>;
  construirImagen(ctx: ContextoDespliegue): Promise<ReferenciaImagen>;
  desplegarServicio(
    ctx: ContextoDespliegue,
    imagen: ReferenciaImagen,
  ): Promise<ResultadoDespliegue>;
  actualizarVariables(
    ctx: ContextoDespliegue,
    variables: Readonly<Record<string, string>>,
  ): Promise<void>;
}

/**
 * Puerto que ejecuta un comando externo. Sin shell: `programa` y
 * `argumentos` nunca se concatenan en una cadena de shell, así que no hace
 * falta escapar nada. Los secretos van por `opciones.entrada` (stdin), nunca
 * como argumento (FR-080).
 */
export interface EjecutorComandos {
  ejecutar(
    programa: string,
    argumentos: readonly string[],
    opciones?: { readonly entrada?: string },
  ): Promise<{ readonly codigo: number; readonly salida: string; readonly error: string }>;
}
