import { LIMITES, RANGOS_COORDENADAS, tieneValor } from "@puntos-recogida/contratos";
import { PuntoInvalidoError } from "./errores.js";

export { PuntoInvalidoError } from "./errores.js";

/** Coordenadas geográficas de un punto de recogida (CT-01: rangos válidos). */
export interface Coordenadas {
  readonly lat: number;
  readonly lng: number;
}

/** Punto de recogida validado (§5.3): fuente única de verdad del dominio. */
export interface PuntoRecogida {
  readonly id: string;
  readonly gid: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly direccionCorta: string;
  readonly coordenadas: Coordenadas;
}

const REGEX_IDENTIFICADOR = /^[A-Za-z0-9_-]+$/;

/** Datos crudos de un punto, tal como llegan del metaobjeto o de un adaptador. */
export interface DatosPuntoRecogida {
  readonly id: string;
  readonly gid: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly direccionCorta: string;
  readonly lat: number;
  readonly lng: number;
}

function validarCoordenadas(lat: number, lng: number): void {
  if (
    !Number.isFinite(lat) ||
    lat < RANGOS_COORDENADAS.lat.min ||
    lat > RANGOS_COORDENADAS.lat.max
  ) {
    throw new PuntoInvalidoError(
      `La latitud debe estar entre ${RANGOS_COORDENADAS.lat.min} y ${RANGOS_COORDENADAS.lat.max}`,
    );
  }
  if (
    !Number.isFinite(lng) ||
    lng < RANGOS_COORDENADAS.lng.min ||
    lng > RANGOS_COORDENADAS.lng.max
  ) {
    throw new PuntoInvalidoError(
      `La longitud debe estar entre ${RANGOS_COORDENADAS.lng.min} y ${RANGOS_COORDENADAS.lng.max}`,
    );
  }
}

function validarCampoObligatorio(valor: string, campo: string): void {
  if (!tieneValor(valor)) {
    throw new PuntoInvalidoError(`El campo "${campo}" es obligatorio`);
  }
}

function validarLongitudMaxima(valor: string, campo: string, maximo: number): void {
  if (valor.length > maximo) {
    throw new PuntoInvalidoError(
      `El campo "${campo}" no puede superar los ${maximo} caracteres`,
    );
  }
}

/**
 * Construye un `PuntoRecogida` validando los campos obligatorios, los
 * límites de longitud y el rango de coordenadas del CT-01 (FR-014). Lanza
 * `PuntoInvalidoError` con el motivo si algún dato es inválido.
 */
export function crearPuntoRecogida(datos: DatosPuntoRecogida): PuntoRecogida {
  validarCampoObligatorio(datos.id, "identificador");
  validarLongitudMaxima(datos.id, "identificador", LIMITES.identificador);
  if (!REGEX_IDENTIFICADOR.test(datos.id)) {
    throw new PuntoInvalidoError(
      "El identificador solo puede contener letras, números, guiones y guiones bajos",
      datos.id,
    );
  }

  validarCampoObligatorio(datos.nombre, "nombre");
  validarLongitudMaxima(datos.nombre, "nombre", LIMITES.nombre);

  validarCampoObligatorio(datos.direccion, "dirección");
  validarLongitudMaxima(datos.direccion, "dirección", LIMITES.direccion);

  validarCampoObligatorio(datos.direccionCorta, "dirección corta");
  validarLongitudMaxima(datos.direccionCorta, "dirección corta", LIMITES.direccionCorta);

  validarCoordenadas(datos.lat, datos.lng);

  return Object.freeze({
    id: datos.id,
    gid: datos.gid,
    nombre: datos.nombre,
    direccion: datos.direccion,
    direccionCorta: datos.direccionCorta,
    coordenadas: Object.freeze({ lat: datos.lat, lng: datos.lng }),
  });
}
