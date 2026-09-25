import type { AtributosCarrito, PuntoRecogidaDto } from "@puntos-recogida/contratos";
import type { EstadoSelector } from "../dominio/estadoCarrito.js";

/** Puerto de lectura/escritura del carrito (§17.2): `/cart.js` y `/cart/update.js`. */
export interface ClienteCarrito {
  leer(): Promise<AtributosCarrito>;
  actualizarAtributos(atributos: Readonly<Record<string, string>>): Promise<void>;
}

/** Puerto de lectura de puntos: `GET /apps/puntos-recogida/puntos` (CT-03). */
export interface ClientePuntos {
  listar(): Promise<readonly PuntoRecogidaDto[]>;
}

/** Puerto de presentación: renderiza el estado actual del selector. */
export interface VistaSelector {
  mostrar(estado: EstadoSelector): void;
}

/** Puerto de bloqueo del checkout, con el motivo asociado (FR-026). */
export interface GuardiaCheckout {
  bloquear(motivo: string): void;
  desbloquear(): void;
}

/** Puerto que notifica cambios del carrito detectados en la página (§17.4). */
export interface ObservadorCarrito {
  alCambiar(escuchador: () => void): void;
}
