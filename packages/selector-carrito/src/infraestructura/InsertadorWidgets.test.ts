import { afterEach, describe, expect, it, vi } from "vitest";
import { InsertadorWidgets } from "./InsertadorWidgets.js";
import type { EstadoSelector } from "../dominio/estadoCarrito.js";

function opciones() {
  return {
    selectorBotonesCheckout: 'button[name="checkout"]',
    selectorInsercion: "",
    selectorContextosCompactos: "#cart-notification",
    textoEnlaceCompacto: "Elige tu punto de recogida",
  };
}

function crearVistaFalsa() {
  const instancias = new Set<HTMLElement>();
  return {
    mostrar: vi.fn(),
    registrarInstancia: vi.fn((host: HTMLElement) => instancias.add(host)),
    eliminarInstancia: vi.fn((host: HTMLElement) => instancias.delete(host)),
    instancias,
  };
}

describe("InsertadorWidgets", () => {
  let instanciaActual: InsertadorWidgets | null = null;

  function crear(...args: ConstructorParameters<typeof InsertadorWidgets>): InsertadorWidgets {
    const insertador = new InsertadorWidgets(...args);
    instanciaActual = insertador;
    return insertador;
  }

  afterEach(() => {
    instanciaActual?.destruir();
    instanciaActual = null;
    document.body.innerHTML = "";
  });

  it("inserta un widget antes del botón de checkout y lo registra en la vista", () => {
    document.body.innerHTML = `<form><button name="checkout">Comprar</button></form>`;
    const vista = crearVistaFalsa();
    const insertador = crear(opciones(), vista);
    insertador.insertar();

    expect(vista.registrarInstancia).toHaveBeenCalledTimes(1);
    const boton = document.querySelector("button")!;
    const host = document.querySelector(".pr-host")!;
    expect(boton.previousElementSibling).toBe(host);
  });

  it("agrupa botones del mismo formulario en un único widget", () => {
    document.body.innerHTML = `
      <form>
        <button name="checkout">Comprar</button>
      </form>
      <form>
        <button name="checkout">Comprar</button>
      </form>
    `;
    const vista = crearVistaFalsa();
    const insertador = crear(opciones(), vista);
    insertador.insertar();
    expect(vista.registrarInstancia).toHaveBeenCalledTimes(2);
  });

  it("en contextos compactos inserta solo un enlace a /cart, sin registrar el combobox", () => {
    document.body.innerHTML = `
      <div id="cart-notification">
        <button name="checkout">Comprar</button>
      </div>
    `;
    const vista = crearVistaFalsa();
    const insertador = crear(opciones(), vista);
    insertador.insertar();

    expect(vista.registrarInstancia).not.toHaveBeenCalled();
    const enlace = document.querySelector<HTMLAnchorElement>(".pr-enlace-compacto");
    expect(enlace?.getAttribute("href")).toBe("/cart");
    expect(enlace?.textContent).toBe("Elige tu punto de recogida");
  });

  it("oculta el enlace compacto cuando el estado es inactivo o con_seleccion", () => {
    document.body.innerHTML = `
      <div id="cart-notification">
        <button name="checkout">Comprar</button>
      </div>
    `;
    const vista = crearVistaFalsa();
    const insertador = crear(opciones(), vista);
    insertador.insertar();
    const host = document.querySelector<HTMLElement>(".pr-host")!;

    insertador.mostrar({ tipo: "sin_seleccion", puntos: [] } as EstadoSelector);
    expect(host.hidden).toBe(false);

    insertador.mostrar({ tipo: "inactivo" } as EstadoSelector);
    expect(host.hidden).toBe(true);
  });

  it("no inserta el interruptor de modo demo si no está configurado (FR-033)", () => {
    document.body.innerHTML = `<form><button name="checkout">Comprar</button></form>`;
    const vista = crearVistaFalsa();
    const insertador = crear(opciones(), vista);
    insertador.insertar();

    expect(document.querySelector(".pr-demo")).toBeNull();
  });

  it("inserta el interruptor de modo demo y notifica el cambio al hacer clic", () => {
    document.body.innerHTML = `<form><button name="checkout">Comprar</button></form>`;
    const vista = crearVistaFalsa();
    const onCambiar = vi.fn();
    const insertador = crear(
      {
        ...opciones(),
        interruptorDemo: {
          etiqueta: "Simular carrito resolado (modo demo)",
          aviso: "Solo para pruebas: desactívalo en producción",
          onCambiar,
        },
      },
      vista,
    );
    insertador.insertar();

    const boton = document.querySelector<HTMLButtonElement>(".pr-demo-interruptor")!;
    expect(boton.getAttribute("role")).toBe("switch");
    expect(boton.getAttribute("aria-checked")).toBe("false");
    expect(boton.textContent).toBe("Simular carrito resolado (modo demo)");
    expect(document.querySelector(".pr-demo-aviso")?.textContent).toBe(
      "Solo para pruebas: desactívalo en producción",
    );

    boton.click();
    expect(onCambiar).toHaveBeenCalledTimes(1);
    expect(onCambiar).toHaveBeenCalledWith(true);
    expect(boton.getAttribute("aria-checked")).toBe("true");
  });

  it("sincroniza el interruptor de modo demo con el estado del carrito sin depender de la vista", () => {
    document.body.innerHTML = `
      <div id="cart-notification">
        <button name="checkout">Comprar</button>
      </div>
    `;
    const vista = crearVistaFalsa();
    const insertador = crear(
      {
        ...opciones(),
        interruptorDemo: { etiqueta: "Simular", aviso: "Aviso", onCambiar: vi.fn() },
      },
      vista,
    );
    insertador.insertar();
    const host = document.querySelector<HTMLElement>(".pr-host")!;
    const boton = document.querySelector<HTMLButtonElement>(".pr-demo-interruptor")!;

    insertador.mostrar({ tipo: "sin_seleccion", puntos: [] } as EstadoSelector);
    expect(host.hidden).toBe(false);
    expect(boton.getAttribute("aria-checked")).toBe("true");

    insertador.mostrar({ tipo: "inactivo" } as EstadoSelector);
    expect(host.hidden).toBe(true);
    expect(boton.getAttribute("aria-checked")).toBe("false");
    expect(boton.isConnected).toBe(true);
  });

  it("reinserta tras un cambio del DOM detectado por el MutationObserver (debounce)", async () => {
    document.body.innerHTML = "";
    const vista = crearVistaFalsa();
    const insertador = crear(opciones(), vista);
    insertador.insertar();
    expect(vista.registrarInstancia).not.toHaveBeenCalled();

    document.body.innerHTML = `<form><button name="checkout">Comprar</button></form>`;
    // El MutationObserver de jsdom entrega los registros en una microtarea.
    await new Promise((resolver) => setTimeout(resolver, 0));
    await vi.waitFor(() => expect(vista.registrarInstancia).toHaveBeenCalledTimes(1), { timeout: 500 });
  });
});
