import {
  atributosDeSeleccion,
  atributosVaciosSeleccion,
  esCarritoResolado,
  leerSeleccionDeAtributos,
} from "@puntos-recogida/contratos";
import type { AtributosCarrito, PuntoRecogidaDto, SeleccionPunto } from "@puntos-recogida/contratos";
import {
  debeBloquearCheckout,
  estadoCargando,
  estadoConSeleccion,
  estadoError,
  estadoErrorGuardado,
  estadoGuardando,
  estadoInactivo,
  estadoSinSeleccion,
  estadoVacio,
  tienePuntos,
} from "../dominio/estadoCarrito.js";
import type { EstadoSelector } from "../dominio/estadoCarrito.js";
import { evaluarSeleccion } from "../dominio/revalidacion.js";
import type { ClienteCarrito, ClientePuntos, GuardiaCheckout, ObservadorCarrito, VistaSelector } from "./puertos.js";

/** Textos que el controlador necesita para los mensajes de cada estado (CT-06). */
export interface TextosControladorSelector {
  readonly motivoBloqueo: string;
  readonly errorCarga: string;
  readonly vacio: string;
  readonly puntoNoDisponible: string;
  readonly errorGuardado: string;
}

export interface DependenciasControladorSelector {
  readonly clienteCarrito: ClienteCarrito;
  readonly clientePuntos: ClientePuntos;
  readonly vista: VistaSelector;
  readonly guardia: GuardiaCheckout;
  readonly observador: ObservadorCarrito;
  readonly textos: TextosControladorSelector;
}

function construirSeleccionDesdePunto(punto: PuntoRecogidaDto): SeleccionPunto {
  const atributos = atributosDeSeleccion(punto);
  return {
    puntoId: atributos.punto_id,
    puntoGid: atributos.punto_gid,
    puntoNombre: atributos.punto_nombre,
    puntoDireccion: atributos.punto_direccion,
    puntoDireccionCorta: atributos.punto_direccion_corta,
    puntoLat: atributos.punto_lat,
    puntoLng: atributos.punto_lng,
  };
}

/**
 * Orquesta la máquina de estados del §17.3 usando solo los puertos del
 * paquete: no conoce el DOM ni `fetch` directamente. Mantiene el registro
 * en marcha entre nuevas llamadas para poder reevaluar el carrito ante cada
 * cambio detectado por el `ObservadorCarrito`.
 */
export class ControladorSelector {
  private estado: EstadoSelector = estadoInactivo();
  private ultimosAtributos: AtributosCarrito = {};

  constructor(private readonly deps: DependenciasControladorSelector) {}

  /** Arranca con el estado inicial del carrito leído de Liquid (FR-022: sin peticiones extra). */
  async iniciar(atributosIniciales: AtributosCarrito): Promise<void> {
    await this.evaluarCarrito(atributosIniciales);
    this.deps.observador.alCambiar(() => {
      void this.alCambiarCarrito();
    });
  }

  private async alCambiarCarrito(): Promise<void> {
    const atributos = await this.deps.clienteCarrito.leer();
    await this.evaluarCarrito(atributos);
  }

  private aplicarEstado(estado: EstadoSelector, mensajeSiBloqueado?: string): void {
    this.estado = estado;
    this.deps.vista.mostrar(estado);
    if (!debeBloquearCheckout(estado)) {
      if (estado.tipo === "con_seleccion") {
        this.deps.guardia.desbloquear();
      }
      return;
    }
    this.deps.guardia.bloquear(mensajeSiBloqueado ?? this.deps.textos.motivoBloqueo);
  }

  private async evaluarCarrito(atributos: AtributosCarrito): Promise<void> {
    this.ultimosAtributos = atributos;
    const seleccionPrevia = leerSeleccionDeAtributos(atributos);

    if (!esCarritoResolado(atributos.tipo_carrito)) {
      if (seleccionPrevia) {
        await this.deps.clienteCarrito.actualizarAtributos(atributosVaciosSeleccion());
      }
      this.estado = estadoInactivo();
      this.deps.vista.mostrar(this.estado);
      return;
    }

    this.aplicarEstado(estadoCargando());

    let puntos: readonly PuntoRecogidaDto[];
    try {
      puntos = await this.deps.clientePuntos.listar();
    } catch {
      this.aplicarEstado(estadoError(this.deps.textos.errorCarga));
      return;
    }

    if (puntos.length === 0) {
      this.aplicarEstado(estadoVacio(), this.deps.textos.vacio);
      return;
    }

    if (!seleccionPrevia) {
      this.aplicarEstado(estadoSinSeleccion(puntos));
      return;
    }

    const resultado = evaluarSeleccion(seleccionPrevia, puntos);
    if (resultado.tipo === "vigente") {
      this.aplicarEstado(estadoConSeleccion(puntos, seleccionPrevia));
      return;
    }
    if (resultado.tipo === "desactualizada") {
      const seleccionNueva = construirSeleccionDesdePunto(resultado.punto);
      try {
        await this.deps.clienteCarrito.actualizarAtributos(atributosDeSeleccion(resultado.punto));
        this.aplicarEstado(estadoConSeleccion(puntos, seleccionNueva));
      } catch {
        this.aplicarEstado(estadoConSeleccion(puntos, seleccionPrevia));
      }
      return;
    }

    await this.deps.clienteCarrito.actualizarAtributos(atributosVaciosSeleccion());
    this.aplicarEstado(estadoSinSeleccion(puntos, this.deps.textos.puntoNoDisponible));
  }

  /** El comprador elige `punto` en el combobox (FR-027). */
  async elegir(punto: PuntoRecogidaDto): Promise<void> {
    const puntos = tienePuntos(this.estado) ? this.estado.puntos : [punto];
    this.estado = estadoGuardando(puntos, punto);
    this.deps.vista.mostrar(this.estado);
    this.deps.guardia.bloquear(this.deps.textos.motivoBloqueo);

    try {
      await this.deps.clienteCarrito.actualizarAtributos(atributosDeSeleccion(punto));
    } catch {
      this.aplicarEstado(estadoErrorGuardado(puntos, punto, this.deps.textos.errorGuardado));
      return;
    }

    this.aplicarEstado(estadoConSeleccion(puntos, construirSeleccionDesdePunto(punto)));
  }

  /** Reintenta la carga de puntos tras un estado `error` (FR-031). */
  async reintentarCarga(): Promise<void> {
    await this.evaluarCarrito(this.ultimosAtributos);
  }

  /** Reintenta el guardado del mismo punto tras un estado `error_guardado` (FR-031). */
  async reintentarGuardado(): Promise<void> {
    if (this.estado.tipo === "error_guardado") {
      await this.elegir(this.estado.puntoElegido);
    }
  }

  estadoActual(): EstadoSelector {
    return this.estado;
  }
}
