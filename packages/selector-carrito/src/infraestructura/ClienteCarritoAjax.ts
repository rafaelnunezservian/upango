import type { AtributosCarrito } from "@puntos-recogida/contratos";
import type { ClienteCarrito } from "../aplicacion/puertos.js";

interface ShopifyGlobal {
  readonly routes?: { readonly root?: string };
}

declare global {
  interface Window {
    Shopify?: ShopifyGlobal;
  }
}

function raizDeRutas(): string {
  return window.Shopify?.routes?.root ?? "/";
}

/** Adaptador de la Ajax Cart API (CT-02): `GET cart.js` y `POST cart/update.js`. */
export class ClienteCarritoAjax implements ClienteCarrito {
  async leer(): Promise<AtributosCarrito> {
    const respuesta = await fetch(`${raizDeRutas()}cart.js`, {
      headers: { Accept: "application/json" },
    });
    if (!respuesta.ok) {
      throw new Error(`No se pudo leer el carrito (${respuesta.status})`);
    }
    const carrito = (await respuesta.json()) as { attributes?: AtributosCarrito };
    return carrito.attributes ?? {};
  }

  async actualizarAtributos(atributos: Readonly<Record<string, string>>): Promise<void> {
    const respuesta = await fetch(`${raizDeRutas()}cart/update.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ attributes: atributos }),
    });
    if (!respuesta.ok) {
      throw new Error(`No se pudo actualizar el carrito (${respuesta.status})`);
    }
  }
}
