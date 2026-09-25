import { afterEach, describe, expect, it, vi } from "vitest";
import { ObservadorCarritoDom } from "./ObservadorCarritoDom.js";

describe("ObservadorCarritoDom", () => {
  const fetchOriginal = window.fetch;

  afterEach(() => {
    window.fetch = fetchOriginal;
    vi.useRealTimers();
  });

  it("notifica tras una respuesta exitosa a /cart/update.js, con debounce", async () => {
    vi.useFakeTimers();
    window.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as typeof fetch;
    const observador = new ObservadorCarritoDom();
    const escuchador = vi.fn();
    observador.alCambiar(escuchador);

    await window.fetch("/cart/update.js");
    expect(escuchador).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(escuchador).toHaveBeenCalledTimes(1);
  });

  it("no notifica si la escritura está marcada como propia", async () => {
    vi.useFakeTimers();
    window.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as typeof fetch;
    const observador = new ObservadorCarritoDom();
    const escuchador = vi.fn();
    observador.alCambiar(escuchador);

    await observador.marcarEscrituraPropia(() => window.fetch("/cart/update.js"));
    vi.advanceTimersByTime(250);
    expect(escuchador).not.toHaveBeenCalled();
  });

  it("no notifica ante una respuesta que no es de una ruta de carrito", async () => {
    vi.useFakeTimers();
    window.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as typeof fetch;
    const observador = new ObservadorCarritoDom();
    const escuchador = vi.fn();
    observador.alCambiar(escuchador);

    await window.fetch("/apps/puntos-recogida/puntos");
    vi.advanceTimersByTime(250);
    expect(escuchador).not.toHaveBeenCalled();
  });
});
