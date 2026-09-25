import type { Reloj } from "../../application/ports/reloj.js";

/** Implementación real de `Reloj`, basada en el reloj del sistema. */
export class RelojSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}
