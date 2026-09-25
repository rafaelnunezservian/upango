/** Un `userError` de una mutación de Shopify (campo y mensaje). */
export interface UserErrorPersonalizacion {
  readonly field: readonly string[] | null;
  readonly message: string;
}

/** Estado real de una delivery customization de esta app, según Shopify. */
export interface PersonalizacionEntrega {
  readonly id: string;
  readonly handle: string;
  readonly activa: boolean;
}

export interface ResultadoCrearPersonalizacion {
  readonly id: string | null;
  readonly userErrors: readonly UserErrorPersonalizacion[];
}

export interface ResultadoActivarPersonalizacion {
  readonly userErrors: readonly UserErrorPersonalizacion[];
}

/**
 * Puerto de lectura/escritura de las delivery customizations de esta app
 * (US-5, §15.3). `listarDeEstaApp` ya filtra las que no pertenecen a esta
 * app (por `appKey`); `crear` y `activar` traducen `userErrors` de Shopify
 * sin lanzar, para que el caso de uso decida cómo agregarlos.
 */
export interface GatewayPersonalizaciones {
  listarDeEstaApp(): Promise<readonly PersonalizacionEntrega[]>;
  crear(handle: string, titulo: string): Promise<ResultadoCrearPersonalizacion>;
  activar(id: string): Promise<ResultadoActivarPersonalizacion>;
}
