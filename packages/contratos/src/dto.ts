/** Forma de cada punto en la respuesta del App Proxy (CT-03). */
export interface PuntoRecogidaDto {
  readonly id: string;
  readonly gid: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly direccionCorta: string;
  readonly lat: number;
  readonly lng: number;
}

/** Forma de la respuesta 200 de `GET /apps/puntos-recogida/puntos` (CT-03). */
export interface RespuestaPuntosDto {
  readonly version: 1;
  readonly generadoEn: string;
  readonly stale: boolean;
  readonly total: number;
  readonly puntos: readonly PuntoRecogidaDto[];
}

/** Códigos de error del App Proxy (CT-03). */
export type CodigoErrorProxy =
  | "APP_NO_INSTALADA"
  | "PUNTOS_NO_DISPONIBLES"
  | "ERROR_INTERNO";

/** Cuerpo de error del App Proxy (CT-03). */
export interface ErrorProxyDto {
  readonly error: CodigoErrorProxy;
  readonly mensaje: string;
}
