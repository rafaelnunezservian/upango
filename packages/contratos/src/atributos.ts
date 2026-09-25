import { tieneValor } from "./normalizacion.js";
import type { PuntoRecogidaDto } from "./dto.js";

/** Clave del atributo que marca un carrito como resolado (CT-02). */
export const CLAVE_TIPO_CARRITO = "tipo_carrito";

/**
 * Las 7 claves de atributo que guardan la copia (snapshot) de un punto
 * elegido en el carrito. Se escriben siempre juntas, en una sola llamada
 * a `/cart/update.js` (CT-02).
 */
export const CLAVES_ATRIBUTO_PUNTO = Object.freeze([
  "punto_id",
  "punto_gid",
  "punto_nombre",
  "punto_direccion",
  "punto_direccion_corta",
  "punto_lat",
  "punto_lng",
] as const);

/**
 * Las 8 claves de atributo del carrito (CT-02): `tipo_carrito` más las 7
 * `punto_*`. Fuente única para el test de coherencia con las input queries
 * (`.graphql`) de las Functions.
 */
export const CLAVES_ATRIBUTO = Object.freeze([
  CLAVE_TIPO_CARRITO,
  ...CLAVES_ATRIBUTO_PUNTO,
] as const);

export type ClaveAtributoPunto = (typeof CLAVES_ATRIBUTO_PUNTO)[number];
export type ClaveAtributo = (typeof CLAVES_ATRIBUTO)[number];

/** Copia (snapshot) de un `PuntoRecogida` leída de los atributos del carrito. */
export interface SeleccionPunto {
  readonly puntoId: string;
  readonly puntoGid: string;
  readonly puntoNombre: string;
  readonly puntoDireccion: string;
  readonly puntoDireccionCorta: string;
  readonly puntoLat: string;
  readonly puntoLng: string;
}

/** Mapa de atributos de carrito, como los expone la Ajax Cart API. */
export type AtributosCarrito = Readonly<Record<string, string | null | undefined>>;

/**
 * Construye el mapa de los 7 atributos `punto_*` a partir de un punto,
 * listo para enviarse en `POST /cart/update.js` (FR-027).
 */
export function atributosDeSeleccion(
  punto: PuntoRecogidaDto,
): Record<ClaveAtributoPunto, string> {
  return {
    punto_id: punto.id,
    punto_gid: punto.gid,
    punto_nombre: punto.nombre,
    punto_direccion: punto.direccion,
    punto_direccion_corta: punto.direccionCorta,
    punto_lat: String(punto.lat),
    punto_lng: String(punto.lng),
  };
}

/**
 * Los 7 atributos `punto_*` con valor vacío, para borrar una selección
 * (FR-029, FR-033).
 */
export function atributosVaciosSeleccion(): Record<ClaveAtributoPunto, string> {
  return {
    punto_id: "",
    punto_gid: "",
    punto_nombre: "",
    punto_direccion: "",
    punto_direccion_corta: "",
    punto_lat: "",
    punto_lng: "",
  };
}

/**
 * Lee una `SeleccionPunto` desde los atributos del carrito o del pedido.
 * Devuelve `null` si `punto_id` está ausente o vacío (`tieneValor`), que es
 * el criterio único de "hay selección" en todo el proyecto.
 */
export function leerSeleccionDeAtributos(
  atributos: AtributosCarrito | null | undefined,
): SeleccionPunto | null {
  if (!atributos || !tieneValor(atributos.punto_id)) {
    return null;
  }
  return {
    puntoId: (atributos.punto_id ?? "").trim(),
    puntoGid: atributos.punto_gid ?? "",
    puntoNombre: atributos.punto_nombre ?? "",
    puntoDireccion: atributos.punto_direccion ?? "",
    puntoDireccionCorta: atributos.punto_direccion_corta ?? "",
    puntoLat: atributos.punto_lat ?? "",
    puntoLng: atributos.punto_lng ?? "",
  };
}
