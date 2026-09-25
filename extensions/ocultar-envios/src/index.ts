import type { FunctionRunResult, Operation, RunInput } from "../generated/api.js";
import { decidirOcultamiento } from "./dominio/decidirOcultamiento.js";
import type { GrupoEntrega } from "./dominio/decidirOcultamiento.js";

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
 * Adaptador de la Function (T084): traduce el `RunInput` que genera Shopify
 * al núcleo puro `decidirOcultamiento` y sus handles a `deliveryOptionHide`.
 * `export default` además de `run` porque las versiones de
 * `@shopify/shopify_function` difieren en cuál usan como punto de entrada
 * (pendiente de confirmar contra una app vinculada real, ver progreso.md).
 */
export function run(input: RunInput): FunctionRunResult {
  const handles = decidirOcultamiento({
    tipoCarrito: input.cart.tipoCarrito?.value ?? null,
    puntoId: input.cart.puntoId?.value ?? null,
    grupos: mapearGrupos(input.cart.deliveryGroups),
  });

  const operations: Operation[] = handles.map((deliveryOptionHandle) => ({
    deliveryOptionHide: { deliveryOptionHandle },
  }));

  return { operations };
}

export default run;
