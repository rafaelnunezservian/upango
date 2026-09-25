import "@shopify/ui-extensions/preact";
import { render } from "preact";
import type { Api } from "@shopify/ui-extensions/customer-account.order-status.block.render";
import type { Attribute } from "@shopify/ui-extensions/customer-account";
import {
  RANGOS_COORDENADAS,
  leerSeleccionDeAtributos,
  tieneValor,
  type AtributosCarrito,
  type SeleccionPunto,
} from "@puntos-recogida/contratos";

/**
 * Punto de entrada del target (CT-07): `shopify app dev`/`deploy` invocan
 * este `export default` porque `shopify.extension.toml` lo declara como
 * `module`, no con `shopify.extend()` (ese otro mecanismo es para targets
 * dinámicos, no para `customer-account.order-status.block.render`).
 */
export default function extension() {
  render(<PuntoPedido />, document.body);
}

/**
 * El global `shopify` no se puede tipar con un `declare global` propio:
 * `customer-account`, a diferencia de `checkout`, no declara ningún
 * `shopify: ShopifyGlobal` ambiental (verificado en el paquete real
 * `@shopify/ui-extensions@2026.7.4`), así que una app con Partners no
 * tendría con qué mezclar un `interface ShopifyGlobal extends Api {}`. Se
 * castea igual que lo hace el propio helper `useApi()` del paquete
 * (`preact/api.ts`), leyendo `globalThis.shopify` en cada llamada para que
 * los tests puedan reemplazarlo entre casos.
 */
function obtenerShopify(): Api {
  return (globalThis as unknown as { shopify: Api }).shopify;
}

/** El pedido expone `attributes` como lista `{key, value}[]`, no como mapa. */
function comoMapaDeAtributos(
  atributos: readonly Attribute[] | undefined,
): AtributosCarrito {
  const mapa: Record<string, string> = {};
  for (const atributo of atributos ?? []) {
    mapa[atributo.key] = atributo.value;
  }
  return mapa;
}

/** Enlace a Google Maps del CT-07, o `null` si `lat`/`lng` no son válidas. */
function enlaceMapa(seleccion: SeleccionPunto): string | null {
  if (!tieneValor(seleccion.puntoLat) || !tieneValor(seleccion.puntoLng)) {
    return null;
  }
  const lat = Number(seleccion.puntoLat);
  const lng = Number(seleccion.puntoLng);
  const coordenadasValidas =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= RANGOS_COORDENADAS.lat.min &&
    lat <= RANGOS_COORDENADAS.lat.max &&
    lng >= RANGOS_COORDENADAS.lng.min &&
    lng <= RANGOS_COORDENADAS.lng.max;
  return coordenadasValidas
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : null;
}

export function PuntoPedido() {
  const shopify = obtenerShopify();
  const seleccion = leerSeleccionDeAtributos(
    comoMapaDeAtributos(shopify.attributes.value),
  );
  if (!seleccion) {
    return null;
  }

  const { translate } = shopify.i18n;
  const mapa = enlaceMapa(seleccion);

  return (
    <s-section heading={translate("punto_pedido.titulo")}>
      <s-text type="strong">{seleccion.puntoNombre}</s-text>
      <s-paragraph>{seleccion.puntoDireccion}</s-paragraph>
      <s-paragraph>
        {translate("punto_pedido.identificador", {
          punto_id: seleccion.puntoId,
        })}
      </s-paragraph>
      {mapa ? (
        <s-link href={mapa} target="_blank">
          {translate("punto_pedido.ver_en_mapa")}
        </s-link>
      ) : null}
      <s-paragraph>{translate("punto_pedido.aviso")}</s-paragraph>
    </s-section>
  );
}
