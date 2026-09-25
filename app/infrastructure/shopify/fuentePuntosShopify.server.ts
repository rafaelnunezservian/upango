import { GraphqlQueryError } from "@shopify/shopify-api";
import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import type { DatosPuntoRecogida } from "../../domain/puntoRecogida.js";
import type { FuentePuntos } from "../../application/ports/fuentePuntos.js";
import type { Registro } from "../../application/ports/registro.js";

/** Tipo del metaobjeto app-owned declarado en CT-01. */
const TIPO_METAOBJETO = "$app:punto_recogida";
const INTENTOS_MAXIMOS_THROTTLING = 5;
const ESPERA_BASE_MS = 500;

const QUERY_PUNTOS = `#graphql
  query PuntosRecogida($after: String, $first: Int!) {
    metaobjects(type: "${TIPO_METAOBJETO}", first: $first, after: $after) {
      nodes {
        id
        fields { key value }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

interface NodoMetaobjeto {
  readonly id: string;
  readonly fields: ReadonlyArray<{ readonly key: string; readonly value: string | null }>;
}

interface RespuestaPuntosRecogida {
  readonly data?: {
    readonly metaobjects?: {
      readonly nodes: readonly NodoMetaobjeto[];
      readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    };
  };
  readonly extensions?: {
    readonly cost?: { readonly requestedQueryCost: number; readonly actualQueryCost: number };
  };
}

interface PaginaPuntos {
  readonly nodos: readonly NodoMetaobjeto[];
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

async function esperarReal(milisegundos: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milisegundos));
}

function codigosDeErrorGraphql(error: unknown): readonly string[] {
  if (!(error instanceof GraphqlQueryError)) {
    return [];
  }
  const errores = (error.body?.errors ?? []) as ReadonlyArray<{
    readonly extensions?: { readonly code?: string };
  }>;
  return errores
    .map((item) => item.extensions?.code)
    .filter((codigo): codigo is string => typeof codigo === "string");
}

function esErrorDeThrottling(error: unknown): boolean {
  return codigosDeErrorGraphql(error).includes("THROTTLED");
}

function esErrorDeCostoMaximo(error: unknown): boolean {
  return codigosDeErrorGraphql(error).includes("MAX_COST_EXCEEDED");
}

function mapearNodoAPuntoCrudo(nodo: NodoMetaobjeto): DatosPuntoRecogida {
  const campos = new Map(nodo.fields.map((campo) => [campo.key, campo.value ?? ""]));
  return {
    id: campos.get("identificador") ?? "",
    gid: nodo.id,
    nombre: campos.get("nombre") ?? "",
    direccion: campos.get("direccion") ?? "",
    direccionCorta: campos.get("direccion_corta") ?? "",
    lat: Number(campos.get("lat")),
    lng: Number(campos.get("lng")),
  };
}

/**
 * Adaptador de lectura del metaobjeto `$app:punto_recogida` (CT-03): pagina
 * con cursor de a `tamanoPaginaInicial` (250 por defecto), reintenta con
 * espera exponencial ante `THROTTLED` y reduce el tamaño de página a la
 * mitad si la Admin API rechaza la consulta por costo máximo (FR-013).
 */
export class FuentePuntosShopify implements FuentePuntos {
  constructor(
    private readonly graphql: AdminGraphqlClient,
    private readonly registro: Registro,
    private readonly tamanoPaginaInicial: number = 250,
    private readonly esperar: (milisegundos: number) => Promise<void> = esperarReal,
  ) {}

  async obtenerTodos(): Promise<readonly DatosPuntoRecogida[]> {
    const resultado: DatosPuntoRecogida[] = [];
    let cursor: string | null = null;
    let tamanoPagina = this.tamanoPaginaInicial;

    for (;;) {
      const { pagina, tamanoPaginaUsado } = await this.pedirPaginaConReintentos(
        cursor,
        tamanoPagina,
      );
      tamanoPagina = tamanoPaginaUsado;
      resultado.push(...pagina.nodos.map(mapearNodoAPuntoCrudo));
      if (!pagina.hasNextPage) {
        return resultado;
      }
      cursor = pagina.endCursor;
    }
  }

  private async pedirPaginaConReintentos(
    cursor: string | null,
    tamanoPagina: number,
    intento = 0,
  ): Promise<{ pagina: PaginaPuntos; tamanoPaginaUsado: number }> {
    try {
      const pagina = await this.pedirPagina(cursor, tamanoPagina);
      return { pagina, tamanoPaginaUsado: tamanoPagina };
    } catch (error) {
      if (esErrorDeCostoMaximo(error) && tamanoPagina > 1) {
        const tamanoReducido = Math.max(1, Math.floor(tamanoPagina / 2));
        this.registro.warn("puntos.pagina_reducida", {
          tamanoPaginaAnterior: tamanoPagina,
          tamanoPaginaNuevo: tamanoReducido,
        });
        return this.pedirPaginaConReintentos(cursor, tamanoReducido, intento);
      }
      if (esErrorDeThrottling(error) && intento < INTENTOS_MAXIMOS_THROTTLING - 1) {
        const espera = ESPERA_BASE_MS * 2 ** intento;
        this.registro.warn("puntos.throttled", { intento: intento + 1, esperaMs: espera });
        await this.esperar(espera);
        return this.pedirPaginaConReintentos(cursor, tamanoPagina, intento + 1);
      }
      throw error;
    }
  }

  private async pedirPagina(cursor: string | null, tamanoPagina: number): Promise<PaginaPuntos> {
    const respuesta = await this.graphql(QUERY_PUNTOS, {
      variables: { after: cursor, first: tamanoPagina },
    });
    const cuerpo = (await respuesta.json()) as RespuestaPuntosRecogida;
    const conexion = cuerpo.data?.metaobjects;
    if (!conexion) {
      throw new Error("Respuesta inesperada de la Admin API al listar puntos de recogida.");
    }

    if (cuerpo.extensions?.cost) {
      this.registro.debug("puntos.costo_consulta", {
        requestedQueryCost: cuerpo.extensions.cost.requestedQueryCost,
        actualQueryCost: cuerpo.extensions.cost.actualQueryCost,
      });
    }

    return {
      nodos: conexion.nodes,
      hasNextPage: conexion.pageInfo.hasNextPage,
      endCursor: conexion.pageInfo.endCursor,
    };
  }
}
