import { GraphqlQueryError } from "@shopify/shopify-api";
import type { EscritorPuntos, DatosNuevoPunto } from "../ports/escritorPuntos.js";
import type { Registro } from "../ports/registro.js";

const CANTIDAD_POR_DEFECTO = 600;
const INTENTOS_MAXIMOS = 5;
const ESPERA_BASE_MS = 500;

/** Punto central de referencia (Madrid) sobre el que se dispersan los puntos de ejemplo. */
const LAT_BASE = 40.4168;
const LNG_BASE = -3.7038;

export interface DependenciasCrearPuntosDeEjemplo {
  readonly escritor: EscritorPuntos;
  readonly registro: Registro;
  /** Inyectable en tests; por defecto espera de verdad (`setTimeout`). */
  readonly esperar?: (milisegundos: number) => Promise<void>;
}

export interface ResultadoCrearPuntosDeEjemplo {
  readonly creados: number;
  readonly reintentosPorThrottling: number;
}

async function esperarReal(milisegundos: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milisegundos));
}

/** `true` si el error indica que la Admin API limitó la petición por consumo (throttling). */
function esErrorDeThrottling(error: unknown): boolean {
  if (!(error instanceof GraphqlQueryError)) {
    return false;
  }
  const errores = (error.body?.errors ?? []) as ReadonlyArray<{
    readonly extensions?: { readonly code?: string };
  }>;
  return errores.some((item) => item.extensions?.code === "THROTTLED");
}

/**
 * Genera los datos deterministas de un punto de ejemplo (FR-005), con
 * handle `ejemplo-0001`, `ejemplo-0002`, … Es idempotente: volver a
 * `upsert` el mismo índice produce siempre el mismo punto.
 */
export function generarPuntoDeEjemplo(indice: number): DatosNuevoPunto {
  const numero = String(indice).padStart(4, "0");
  const handle = `ejemplo-${numero}`;
  const fila = Math.floor((indice - 1) / 100);
  const columna = (indice - 1) % 100;

  return {
    handle,
    identificador: handle.toUpperCase().replace(/-/g, "_"),
    nombre: `Punto de ejemplo ${numero}`,
    direccion: `Calle de Ejemplo ${numero}, Madrid`,
    direccionCorta: `C. Ejemplo ${numero}, Madrid`,
    lat: LAT_BASE + columna * 0.001,
    lng: LNG_BASE + fila * 0.001,
  };
}

async function upsertConReintentos(
  escritor: EscritorPuntos,
  punto: DatosNuevoPunto,
  esperar: (milisegundos: number) => Promise<void>,
  registro: Registro,
): Promise<number> {
  let intento = 0;
  let reintentos = 0;

  for (;;) {
    try {
      await escritor.upsert(punto);
      return reintentos;
    } catch (error) {
      if (!esErrorDeThrottling(error) || intento >= INTENTOS_MAXIMOS - 1) {
        throw error;
      }
      reintentos += 1;
      intento += 1;
      const espera = ESPERA_BASE_MS * 2 ** (intento - 1);
      registro.warn("puntos_ejemplo.throttled", {
        handle: punto.handle,
        intento,
        esperaMs: espera,
      });
      await esperar(espera);
    }
  }
}

/**
 * Crea (o actualiza) `cantidad` puntos de recogida de ejemplo mediante
 * `EscritorPuntos`, con handles deterministas `ejemplo-0001…` (FR-005). Es
 * idempotente por handle: repetir la operación con el mismo índice
 * sobreescribe el mismo punto en lugar de duplicarlo. Reintenta con espera
 * exponencial ante errores de throttling de la Admin API.
 */
export async function crearPuntosDeEjemplo(
  { escritor, registro, esperar = esperarReal }: DependenciasCrearPuntosDeEjemplo,
  cantidad: number = CANTIDAD_POR_DEFECTO,
): Promise<ResultadoCrearPuntosDeEjemplo> {
  let reintentosPorThrottling = 0;

  for (let indice = 1; indice <= cantidad; indice += 1) {
    const punto = generarPuntoDeEjemplo(indice);
    reintentosPorThrottling += await upsertConReintentos(escritor, punto, esperar, registro);
  }

  registro.info("puntos_ejemplo.creados", { cantidad, reintentosPorThrottling });

  return { creados: cantidad, reintentosPorThrottling };
}
