import type { FunctionRunResult, Operation, RunInput } from "../generated/api.js";
import { decidirRenombre } from "./dominio/decidirRenombre.js";
import type { GrupoEntrega } from "./dominio/decidirRenombre.js";

function mapearGrupos(
  grupos: RunInput["cart"]["deliveryGroups"],
): readonly GrupoEntrega[] {
  return grupos.map((grupo) => ({
    opciones: grupo.deliveryOptions.map((opcion) => ({
      handle: opcion.handle,
      titulo: opcion.title,
    })),
  }));
}

/**
 * Adaptador de la Function (T085): traduce el `RunInput` que genera Shopify
 * al núcleo puro `decidirRenombre` y sus decisiones a `deliveryOptionRename`.
 * `export default` además de `run` (misma nota que ocultar-envios/src/index.ts
 * sobre el punto de entrada de `@shopify/shopify_function`).
 */
export function run(input: RunInput): FunctionRunResult {
  const decisiones = decidirRenombre({
    tipoCarrito: input.cart.tipoCarrito?.value ?? null,
    puntoId: input.cart.puntoId?.value ?? null,
    direccionCorta: input.cart.puntoDireccionCorta?.value ?? null,
    grupos: mapearGrupos(input.cart.deliveryGroups),
  });

  const operations: Operation[] = decisiones.map(({ handle, titulo }) => ({
    deliveryOptionRename: { deliveryOptionHandle: handle, title: titulo },
  }));

  return { operations };
}

export default run;
