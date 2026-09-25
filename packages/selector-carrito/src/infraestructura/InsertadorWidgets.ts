import type { EstadoSelector } from "../dominio/estadoCarrito.js";
import type { VistaSelector } from "../aplicacion/puertos.js";

export interface OpcionesInsertadorWidgets {
  readonly selectorBotonesCheckout: string;
  readonly selectorInsercion: string;
  readonly selectorContextosCompactos: string;
  readonly textoEnlaceCompacto: string;
}

const DEBOUNCE_MS = 100;

interface Grupo {
  readonly contenedor: Element;
  readonly primerBoton: Element;
  readonly compacto: boolean;
}

/**
 * Agrupa los botones de checkout visibles por su contenedor e inserta un
 * widget (o, en contextos compactos, solo un enlace a `/cart`, EC-24) por
 * grupo. Un `MutationObserver` con debounce de 100 ms reinserta tras un
 * re-render del tema (§17.4).
 */
export class InsertadorWidgets implements VistaSelector {
  private readonly hosts = new Map<Element, { host: HTMLElement; compacto: boolean }>();
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private estadoActual: EstadoSelector = { tipo: "inactivo" };
  private readonly observador: MutationObserver;

  constructor(
    private readonly opciones: OpcionesInsertadorWidgets,
    private readonly vista: Pick<VistaSelector, "mostrar"> & {
      registrarInstancia(host: HTMLElement): void;
      eliminarInstancia(host: HTMLElement): void;
    },
    private readonly alReinsertar?: () => void,
  ) {
    this.observador = new MutationObserver(() => this.reinsertarConDebounce());
    this.observador.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /** Deja de observar el DOM (uso en tests; en la página vive hasta que se descarga). */
  destruir(): void {
    this.observador.disconnect();
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
    }
  }

  /** Llamado tras cada evaluación del carrito: reenvía el estado a la vista y ajusta los enlaces compactos. */
  mostrar(estado: EstadoSelector): void {
    this.estadoActual = estado;
    this.vista.mostrar(estado);
    this.actualizarEnlacesCompactos();
  }

  insertar(): void {
    const grupos = this.agruparBotones();
    const contenedoresActuales = new Set(grupos.map((grupo) => grupo.contenedor));

    for (const [contenedor, { host }] of this.hosts) {
      if (!contenedoresActuales.has(contenedor) || !document.contains(contenedor)) {
        host.remove();
        this.vista.eliminarInstancia(host);
        this.hosts.delete(contenedor);
      }
    }

    for (const grupo of grupos) {
      if (this.hosts.has(grupo.contenedor)) {
        continue;
      }
      const host = this.crearHost(grupo);
      this.hosts.set(grupo.contenedor, { host, compacto: grupo.compacto });
      if (grupo.compacto) {
        this.actualizarVisibilidadEnlace(host);
      } else {
        this.vista.registrarInstancia(host);
      }
    }
    this.alReinsertar?.();
  }

  private reinsertarConDebounce(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
    }
    this.temporizador = setTimeout(() => this.insertar(), DEBOUNCE_MS);
  }

  private esVisible(elemento: Element): boolean {
    if ((elemento as HTMLElement).hidden) {
      return false;
    }
    const estilo = window.getComputedStyle(elemento);
    return estilo.display !== "none" && estilo.visibility !== "hidden";
  }

  private agruparBotones(): Grupo[] {
    const botones = Array.from(document.querySelectorAll(this.opciones.selectorBotonesCheckout));
    const grupos: Grupo[] = [];
    const contenedoresVistos = new Set<Element>();

    for (const boton of botones) {
      if (!this.esVisible(boton)) {
        continue;
      }
      const contenedor = boton.closest("form") ?? boton.parentElement ?? boton;
      if (contenedoresVistos.has(contenedor)) {
        continue;
      }
      contenedoresVistos.add(contenedor);
      grupos.push({
        contenedor,
        primerBoton: boton,
        compacto: boton.closest(this.opciones.selectorContextosCompactos) !== null,
      });
    }
    return grupos;
  }

  private crearHost(grupo: Grupo): HTMLElement {
    const host = document.createElement("div");
    host.className = grupo.compacto ? "pr-host pr-host-compacto" : "pr-host";

    if (grupo.compacto) {
      const enlace = document.createElement("a");
      enlace.href = "/cart";
      enlace.className = "pr-enlace-compacto";
      enlace.textContent = this.opciones.textoEnlaceCompacto;
      host.append(enlace);
    }

    const destino = this.opciones.selectorInsercion
      ? document.querySelector(this.opciones.selectorInsercion)
      : null;
    if (destino) {
      destino.append(host);
    } else {
      grupo.primerBoton.insertAdjacentElement("beforebegin", host);
    }
    return host;
  }

  private actualizarEnlacesCompactos(): void {
    for (const { host, compacto } of this.hosts.values()) {
      if (compacto) {
        this.actualizarVisibilidadEnlace(host);
      }
    }
  }

  private actualizarVisibilidadEnlace(host: HTMLElement): void {
    host.hidden = this.estadoActual.tipo === "inactivo" || this.estadoActual.tipo === "con_seleccion";
  }
}
