import type { Consola } from "../puertos/index.js";

/** Adaptador real de `Consola`: `stdout`/`stderr` del proceso. Nunca recibe ni imprime valores de secretos. */
export class ConsolaNode implements Consola {
  info(mensaje: string): void {
    // eslint-disable-next-line no-console
    console.log(mensaje);
  }

  advertencia(mensaje: string): void {
    // eslint-disable-next-line no-console
    console.warn(mensaje);
  }

  error(mensaje: string): void {
    // eslint-disable-next-line no-console
    console.error(mensaje);
  }

  comando(
    programa: string,
    argumentos: readonly string[],
    opciones?: { readonly tieneEntradaSecreta?: boolean },
  ): void {
    const entrada = opciones?.tieneEntradaSecreta ? " < ***" : "";
    // eslint-disable-next-line no-console
    console.log(`$ ${[programa, ...argumentos].join(" ")}${entrada}`);
  }
}
