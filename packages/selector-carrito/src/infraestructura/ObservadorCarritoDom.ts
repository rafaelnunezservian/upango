import type { ObservadorCarrito } from "../aplicacion/puertos.js";

const RUTAS_CARRITO = ["/cart/add", "/cart/change", "/cart/update", "/cart/clear"];
const DEBOUNCE_MS = 250;

type MetodoOpen = (
  metodo: string,
  url: string | URL,
  async?: boolean,
  usuario?: string | null,
  password?: string | null,
) => void;

interface EventosPubSubDawn {
  readonly cartUpdate?: string;
}

declare global {
  interface Window {
    subscribe?: (evento: string, callback: () => void) => void;
    PUB_SUB_EVENTS?: EventosPubSubDawn;
  }
}

/**
 * Detecta cambios del carrito por varias vías (§17.4): envoltura de
 * `fetch`/`XMLHttpRequest` hacia las rutas de carrito, el pub/sub `cart-update`
 * de Dawn, los eventos de carrito de Horizon (`cart:update`, `cart:refresh`)
 * y `visibilitychange`. Todo pasa por un único debounce de 250 ms.
 */
export class ObservadorCarritoDom implements ObservadorCarrito {
  private readonly escuchadores = new Set<() => void>();
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private escrituraPropiaEnCurso = false;

  constructor() {
    this.envolverFetch();
    this.envolverXhr();
    this.escucharEventosDeTema();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.notificarConDebounce();
      }
    });
  }

  alCambiar(escuchador: () => void): void {
    this.escuchadores.add(escuchador);
  }

  /** Marca las escrituras propias del embed para no disparar un bucle (§17.4). */
  async marcarEscrituraPropia<T>(accion: () => Promise<T>): Promise<T> {
    this.escrituraPropiaEnCurso = true;
    try {
      return await accion();
    } finally {
      this.escrituraPropiaEnCurso = false;
    }
  }

  private esRutaDeCarrito(url: string): boolean {
    return RUTAS_CARRITO.some((ruta) => url.includes(ruta));
  }

  private notificarConDebounce(): void {
    if (this.escrituraPropiaEnCurso) {
      return;
    }
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
    }
    this.temporizador = setTimeout(() => {
      for (const escuchador of this.escuchadores) {
        escuchador();
      }
    }, DEBOUNCE_MS);
  }

  private envolverFetch(): void {
    const original = window.fetch.bind(window);
    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      const respuesta = await original(...args);
      const entrada = args[0];
      const url =
        typeof entrada === "string"
          ? entrada
          : entrada instanceof URL
            ? entrada.toString()
            : entrada.url;
      if (respuesta.ok && this.esRutaDeCarrito(url)) {
        this.notificarConDebounce();
      }
      return respuesta;
    }) as typeof window.fetch;
  }

  private envolverXhr(): void {
    const original = XMLHttpRequest.prototype.open as MetodoOpen;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- la función de reemplazo de `open` necesita su propio `this: XMLHttpRequest`.
    const observador = this;
    XMLHttpRequest.prototype.open = function abrir(
      this: XMLHttpRequest,
      metodo: string,
      url: string | URL,
      async?: boolean,
      usuario?: string | null,
      password?: string | null,
    ): void {
      this.addEventListener("loadend", () => {
        if (this.status >= 200 && this.status < 300 && observador.esRutaDeCarrito(String(url))) {
          observador.notificarConDebounce();
        }
      });
      original.call(this, metodo, url, async, usuario, password);
    } as typeof XMLHttpRequest.prototype.open;
  }

  private escucharEventosDeTema(): void {
    document.addEventListener("cart:update", () => this.notificarConDebounce());
    document.addEventListener("cart:refresh", () => this.notificarConDebounce());
    const evento = window.PUB_SUB_EVENTS?.cartUpdate;
    if (evento && typeof window.subscribe === "function") {
      window.subscribe(evento, () => this.notificarConDebounce());
    }
  }
}
