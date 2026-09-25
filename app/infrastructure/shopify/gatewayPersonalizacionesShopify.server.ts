import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import type {
  GatewayPersonalizaciones,
  PersonalizacionEntrega,
  ResultadoActivarPersonalizacion,
  ResultadoCrearPersonalizacion,
  UserErrorPersonalizacion,
} from "../../application/ports/gatewayPersonalizaciones.js";

const QUERY_DELIVERY_CUSTOMIZATIONS = `#graphql
  query DeliveryCustomizationsDeEstaApp {
    deliveryCustomizations(first: 25) {
      nodes {
        id
        title
        enabled
        shopifyFunction { handle appKey }
      }
    }
  }`;

const MUTACION_CREAR = `#graphql
  mutation crearPersonalizacionEntrega($deliveryCustomization: DeliveryCustomizationInput!) {
    deliveryCustomizationCreate(deliveryCustomization: $deliveryCustomization) {
      deliveryCustomization { id }
      userErrors { field message }
    }
  }`;

const MUTACION_ACTIVAR = `#graphql
  mutation activarPersonalizacionEntrega($id: ID!, $deliveryCustomization: DeliveryCustomizationInput!) {
    deliveryCustomizationUpdate(id: $id, deliveryCustomization: $deliveryCustomization) {
      deliveryCustomization { id }
      userErrors { field message }
    }
  }`;

interface NodoDeliveryCustomization {
  readonly id: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly shopifyFunction: { readonly handle: string; readonly appKey: string } | null;
}

interface RespuestaListado {
  readonly data?: {
    readonly deliveryCustomizations?: { readonly nodes: readonly NodoDeliveryCustomization[] };
  };
}

interface RespuestaCrear {
  readonly data?: {
    readonly deliveryCustomizationCreate?: {
      readonly deliveryCustomization?: { readonly id: string } | null;
      readonly userErrors?: readonly UserErrorPersonalizacion[];
    } | null;
  };
}

interface RespuestaActivar {
  readonly data?: {
    readonly deliveryCustomizationUpdate?: {
      readonly deliveryCustomization?: { readonly id: string } | null;
      readonly userErrors?: readonly UserErrorPersonalizacion[];
    } | null;
  };
}

/**
 * Adaptador de las delivery customizations de esta app (US-5, §15.4).
 * `listarDeEstaApp` filtra por `appKey` (la Admin API no filtra
 * `deliveryCustomizations` por app) para no confundir personalizaciones de
 * otras apps con las propias, y expone el `handle` de la Function para que
 * el caso de uso las relacione con `ocultar-envios`/`renombrar-recogida`.
 */
export class GatewayPersonalizacionesShopify implements GatewayPersonalizaciones {
  constructor(
    private readonly graphql: AdminGraphqlClient,
    private readonly apiKey: string,
  ) {}

  async listarDeEstaApp(): Promise<readonly PersonalizacionEntrega[]> {
    const respuesta = await this.graphql(QUERY_DELIVERY_CUSTOMIZATIONS);
    const cuerpo = (await respuesta.json()) as RespuestaListado;
    const nodos = cuerpo.data?.deliveryCustomizations?.nodes ?? [];

    return nodos
      .filter((nodo) => nodo.shopifyFunction?.appKey === this.apiKey)
      .map((nodo) => ({
        id: nodo.id,
        handle: nodo.shopifyFunction!.handle,
        activa: nodo.enabled,
      }));
  }

  async crear(handle: string, titulo: string): Promise<ResultadoCrearPersonalizacion> {
    const respuesta = await this.graphql(MUTACION_CREAR, {
      variables: {
        deliveryCustomization: { functionHandle: handle, title: titulo, enabled: true },
      },
    });
    const cuerpo = (await respuesta.json()) as RespuestaCrear;
    const resultado = cuerpo.data?.deliveryCustomizationCreate;

    return {
      id: resultado?.deliveryCustomization?.id ?? null,
      userErrors: resultado?.userErrors ?? [],
    };
  }

  async activar(id: string): Promise<ResultadoActivarPersonalizacion> {
    const respuesta = await this.graphql(MUTACION_ACTIVAR, {
      variables: { id, deliveryCustomization: { enabled: true } },
    });
    const cuerpo = (await respuesta.json()) as RespuestaActivar;

    return { userErrors: cuerpo.data?.deliveryCustomizationUpdate?.userErrors ?? [] };
  }
}
