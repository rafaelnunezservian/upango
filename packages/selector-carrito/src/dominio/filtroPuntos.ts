import { normalizarTexto } from "@puntos-recogida/contratos";
import type { PuntoRecogidaDto } from "@puntos-recogida/contratos";

/** Límite por defecto de resultados mostrados por el combobox (FR-024). */
export const LIMITE_RESULTADOS_POR_DEFECTO = 50;

/**
 * Índice de búsqueda precalculado: un texto normalizado (nombre + dirección
 * + dirección corta + identificador) por cada punto, en el mismo orden que
 * `puntos` (que ya llega ordenado alfabéticamente del backend). Precalcular
 * la normalización es lo que permite cumplir el NFR-02 (≤100 ms por
 * pulsación con 5.000 puntos) sin volver a normalizar en cada tecla.
 */
export interface IndicePuntos {
  readonly puntos: readonly PuntoRecogidaDto[];
  readonly textos: readonly string[];
}

export function construirIndice(puntos: readonly PuntoRecogidaDto[]): IndicePuntos {
  return {
    puntos,
    textos: puntos.map((punto) =>
      normalizarTexto(`${punto.nombre} ${punto.direccion} ${punto.direccionCorta} ${punto.id}`),
    ),
  };
}

export interface ResultadoFiltro {
  readonly resultados: readonly PuntoRecogidaDto[];
  readonly total: number;
}

/**
 * Filtra el índice por `consulta`, insensible a mayúsculas y tildes
 * (FR-024). Sin consulta, devuelve los primeros `limite` en el orden del
 * índice (alfabético) junto con el total real de puntos.
 */
export function filtrar(
  indice: IndicePuntos,
  consulta: string,
  limite: number = LIMITE_RESULTADOS_POR_DEFECTO,
): ResultadoFiltro {
  const consultaNormalizada = normalizarTexto(consulta);
  if (!consultaNormalizada) {
    return { resultados: indice.puntos.slice(0, limite), total: indice.puntos.length };
  }

  const coincidencias: PuntoRecogidaDto[] = [];
  for (let indiceItem = 0; indiceItem < indice.puntos.length; indiceItem += 1) {
    if (indice.textos[indiceItem]?.includes(consultaNormalizada)) {
      coincidencias.push(indice.puntos[indiceItem]!);
    }
  }
  return { resultados: coincidencias.slice(0, limite), total: coincidencias.length };
}
