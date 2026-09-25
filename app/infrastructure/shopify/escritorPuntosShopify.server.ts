import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import type { DatosNuevoPunto, EscritorPuntos } from "../../application/ports/escritorPuntos.js";

/** Tipo del metaobjeto app-owned declarado en CT-01. */
const TIPO_METAOBJETO = "$app:punto_recogida";

const MUTACION_UPSERT_PUNTO = `#graphql
  mutation crearPuntoDeEjemploUpsert($handle: MetaobjectHandleInput!, $values: JSON!) {
    metaobjectUpsert(handle: $handle, values: $values) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }`;

interface RespuestaUpsertMetaobjeto {
  readonly data?: {
    readonly metaobjectUpsert?: {
      readonly metaobject?: { readonly id: string; readonly handle: string } | null;
      readonly userErrors?: ReadonlyArray<{ readonly field: readonly string[] | null; readonly message: string }>;
    } | null;
  };
}

/**
 * Adaptador de escritura del metaobjeto `$app:punto_recogida`, usado
 * únicamente por la herramienta de semilla (FR-005). El CRUD real del
 * comerciante ocurre en el admin nativo de Shopify (US-1), nunca aquí.
 */
export class EscritorPuntosShopify implements EscritorPuntos {
  constructor(private readonly graphql: AdminGraphqlClient) {}

  async upsert(punto: DatosNuevoPunto): Promise<void> {
    const respuesta = await this.graphql(MUTACION_UPSERT_PUNTO, {
      variables: {
        handle: { type: TIPO_METAOBJETO, handle: punto.handle },
        values: {
          identificador: punto.identificador,
          nombre: punto.nombre,
          direccion: punto.direccion,
          direccion_corta: punto.direccionCorta,
          lat: String(punto.lat),
          lng: String(punto.lng),
        },
      },
    });

    const cuerpo = (await respuesta.json()) as RespuestaUpsertMetaobjeto;
    const errores = cuerpo.data?.metaobjectUpsert?.userErrors ?? [];
    if (errores.length > 0) {
      throw new Error(
        `metaobjectUpsert falló para "${punto.handle}": ${errores
          .map((error) => error.message)
          .join("; ")}`,
      );
    }
  }
}
