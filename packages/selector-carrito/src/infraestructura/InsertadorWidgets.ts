import type { EstadoSelector } from "../dominio/estadoCarrito.js";
import type { VistaSelector } from "../aplicacion/puertos.js";

export interface OpcionesInsertadorWidgets {
  readonly selectorBotonesCheckout: string;
  readonly selectorInsercion: string;
  readonly selectorContextosCompactos: string;
  readonly textoEnlaceCompacto: string;
  /** Configurado solo si `modo_demo` está activo en el editor de temas (§17.6, FR-033). */
  readonly interruptorDemo?: {
    readonly etiqueta: string;
    readonly aviso: string;
    readonly onCambiar: (activo: boolean) => void;
  };
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
  private readonly demoHosts = new Map<Element, HTMLElement>();
  private demoActivo = false;
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

  /**
   * Llamado tras cada evaluación del carrito: reenvía el estado a la vista,
   * ajusta los enlaces compactos y sincroniza el interruptor de modo demo
   * (§17.6). Un carrito resolado es, por definición, cualquier estado
   * distinto de `inactivo` (`ControladorSelector` solo produce `inactivo`
   * cuando `tipo_carrito` no es resolado).
   */
  mostrar(estado: EstadoSelector): void {
    this.estadoActual = estado;
    this.vista.mostrar(estado);
    this.actualizarEnlacesCompactos();
    this.actualizarModoDemo(estado.tipo !== "inactivo");
  }

  insertar(): void {
    const grupos = this.agruparBotones();
    const contenedoresActuales = new Set(grupos.map((grupo) => grupo.contenedor));

    for (const [contenedor, { host }] of this.hosts) {
      if (!contenedoresActuales.has(contenedor) || !document.contains(contenedor)) {
        host.remove();
        this.vista.eliminarInstancia(host);
        this.hosts.delete(contenedor);
        this.demoHosts.get(contenedor)?.remove();
        this.demoHosts.delete(contenedor);
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

    const demoHost = this.crearHostDemo(grupo.contenedor);

    const destino = this.opciones.selectorInsercion
      ? document.querySelector(this.opciones.selectorInsercion)
      : null;
    if (destino) {
      if (demoHost) {
        destino.append(demoHost);
      }
      destino.append(host);
    } else {
      if (demoHost) {
        grupo.primerBoton.insertAdjacentElement("beforebegin", demoHost);
      }
      grupo.primerBoton.insertAdjacentElement("beforebegin", host);
    }
    return host;
  }

  /**
   * Crea el interruptor de modo demo (§17.6) como elemento hermano del host
   * del widget, para que su visibilidad no dependa del estado del carrito
   * (a diferencia de `host`, que `VistaComboboxDom` oculta en `inactivo`).
   * Devuelve `null` si `modo_demo` no está activo (FR-033: el interruptor no
   * existe en absoluto con el ajuste desactivado).
   */
  private crearHostDemo(contenedor: Element): HTMLElement | null {
    const interruptorDemo = this.opciones.interruptorDemo;
    if (!interruptorDemo) {
      return null;
    }
    const host = document.createElement("div");
    host.className = "pr-demo";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pr-demo-interruptor";
    boton.setAttribute("role", "switch");
    boton.setAttribute("aria-checked", String(this.demoActivo));
    boton.textContent = interruptorDemo.etiqueta;
    boton.addEventListener("click", () => {
      const nuevoActivo = !this.demoActivo;
      this.actualizarModoDemo(nuevoActivo);
      interruptorDemo.onCambiar(nuevoActivo);
    });
    host.append(boton);

    const aviso = document.createElement("p");
    aviso.className = "pr-demo-aviso";
    aviso.textContent = interruptorDemo.aviso;
    host.append(aviso);

    this.demoHosts.set(contenedor, host);
    return host;
  }

  /** Sincroniza el interruptor de modo demo con el `tipo_carrito` vigente. */
  private actualizarModoDemo(activo: boolean): void {
    this.demoActivo = activo;
    for (const demoHost of this.demoHosts.values()) {
      demoHost
        .querySelector(".pr-demo-interruptor")
        ?.setAttribute("aria-checked", String(activo));
    }
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
