import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import type { ConsultaConfiguracionTienda, ConteoPuntos } from "../../application/ports/consultaConfiguracionTienda.js";

/** Tipo del metaobjeto app-owned declarado en CT-01. */
const TIPO_METAOBJETO = "$app:punto_recogida";

const QUERY_DEFINICION_METAOBJETO = `#graphql
  query DefinicionPuntosRecogida {
    metaobjectDefinitionByType(type: "${TIPO_METAOBJETO}") {
      type
      metaobjectsCount
    }
  }`;

interface RespuestaDefinicion {
  readonly data?: {
    readonly metaobjectDefinitionByType?: {
      readonly type: string;
      readonly metaobjectsCount: number;
    } | null;
  };
}

/**
 * Adaptador de solo lectura de la definición del metaobjeto de puntos
 * (US-5, §15.4): usa `metaobjectDefinitionByType` para contar entradas y
 * resolver el tipo real (`app--{id}--punto_recogida`) sin paginar todas
 * las entradas. Si la definición no existe todavía (por ejemplo, antes del
 * primer `shopify app deploy`), `metaobjectDefinitionByType` es `null` y no
 * hay puntos que contar.
 */
export class ConsultaConfiguracionTiendaShopify implements ConsultaConfiguracionTienda {
  constructor(private readonly graphql: AdminGraphqlClient) {}

  async contarPuntos(): Promise<ConteoPuntos> {
    const respuesta = await this.graphql(QUERY_DEFINICION_METAOBJETO);
    const cuerpo = (await respuesta.json()) as RespuestaDefinicion;
    const definicion = cuerpo.data?.metaobjectDefinitionByType;

    if (!definicion) {
      return { total: 0, tipoResuelto: null };
    }

    return { total: definicion.metaobjectsCount, tipoResuelto: definicion.type };
  }
}
