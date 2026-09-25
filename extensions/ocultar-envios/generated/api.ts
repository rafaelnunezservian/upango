/**
 * Tipos de entrada/salida de la Function (CT-04), escritos a mano: la sesión
 * cloud no puede correr `shopify app function typegen` (necesita una app
 * vinculada a Partners, T001). Reproducen la forma de la query de
 * `../src/cart.delivery-options.transform.graphql` y de las `operations`
 * del §18.2. Una sesión con acceso a Partners debe regenerar este archivo
 * con el comando real y compararlo — ver progreso.md, sesión 6.
 */

export interface Attribute {
  readonly value: string | null;
}

export interface CartDeliveryOption {
  readonly handle: string;
  readonly title: string | null;
}

export interface CartDeliveryGroup {
  readonly deliveryOptions: readonly CartDeliveryOption[];
}

export interface Cart {
  readonly tipoCarrito: Attribute | null;
  readonly puntoId: Attribute | null;
  readonly deliveryGroups: readonly CartDeliveryGroup[];
}

export interface RunInput {
  readonly cart: Cart;
}

export interface DeliveryOptionHideOperation {
  readonly deliveryOptionHandle: string;
}

export interface DeliveryOptionRenameOperation {
  readonly deliveryOptionHandle: string;
  readonly title: string;
}

export type Operation =
  | { readonly deliveryOptionHide: DeliveryOptionHideOperation }
  | { readonly deliveryOptionRename: DeliveryOptionRenameOperation };

export interface FunctionRunResult {
  readonly operations: readonly Operation[];
}
