/** Error de arranque: `deploy.config.json`, `--proveedor` o las variables/secretos requeridos son inválidos (código de salida 1). */
export class ConfiguracionInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfiguracionInvalidaError";
  }
}

/** Un prerrequisito del proveedor no se cumple: CLI ausente, sin sesión o sin proyecto (código de salida 2). */
export class PrerrequisitoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrerrequisitoError";
  }
}

/** Un comando del proveedor terminó con código distinto de 0 (código de salida 3). */
export class ComandoFallidoError extends Error {
  constructor(
    message: string,
    readonly paso: string,
  ) {
    super(message);
    this.name = "ComandoFallidoError";
  }
}

/** Se pidió un proveedor que no está registrado (código de salida 4, FR-082). */
export class ProveedorNoImplementadoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProveedorNoImplementadoError";
  }
}
