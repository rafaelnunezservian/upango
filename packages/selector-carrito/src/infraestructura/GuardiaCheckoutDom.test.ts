import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GuardiaCheckoutDom } from "./GuardiaCheckoutDom.js";

function montarBotonYPago(): { boton: HTMLButtonElement; pago: HTMLElement; enlace: HTMLAnchorElement } {
  document.body.innerHTML = `
    <form>
      <button name="checkout" type="submit">Comprar ahora</button>
    </form>
    <div class="additional-checkout-buttons">pago acelerado</div>
    <a href="/checkout">Ir al checkout</a>
  `;
  return {
    boton: document.querySelector("button")!,
    pago: document.querySelector(".additional-checkout-buttons")!,
    enlace: document.querySelector("a")!,
  };
}

describe("GuardiaCheckoutDom", () => {
  let guardia: GuardiaCheckoutDom;

  beforeEach(() => {
    guardia = new GuardiaCheckoutDom({
      selectorBotonesCheckout: 'button[name="checkout"]',
      selectorPagosAcelerados: ".additional-checkout-buttons",
    });
  });

  afterEach(() => {
    guardia.destruir();
    document.body.innerHTML = "";
  });

  it("al bloquear deshabilita el botón, lo marca aria-disabled y oculta el pago acelerado", () => {
    const { boton, pago } = montarBotonYPago();
    guardia.bloquear("Elige un punto de recogida para continuar");
    expect(boton.hasAttribute("disabled")).toBe(true);
    expect(boton.getAttribute("aria-disabled")).toBe("true");
    expect(pago.hidden).toBe(true);
    const idAviso = boton.getAttribute("aria-describedby");
    expect(idAviso).toBeTruthy();
    expect(document.getElementById(idAviso!)?.textContent).toBe(
      "Elige un punto de recogida para continuar",
    );
  });

  it("al desbloquear habilita el botón y vuelve a mostrar el pago acelerado", () => {
    const { boton, pago } = montarBotonYPago();
    guardia.bloquear("motivo");
    guardia.desbloquear();
    expect(boton.hasAttribute("disabled")).toBe(false);
    expect(boton.hasAttribute("aria-disabled")).toBe(false);
    expect(pago.hidden).toBe(false);
  });

  it("bloqueado, cancela el submit del formulario de checkout en fase de captura", () => {
    const { boton } = montarBotonYPago();
    guardia.bloquear("motivo");
    const formulario = boton.closest("form")!;
    const evento = new Event("submit", { bubbles: true, cancelable: true });
    formulario.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it("bloqueado, cancela el clic en un enlace a /checkout", () => {
    montarBotonYPago();
    guardia.bloquear("motivo");
    const enlace = document.querySelector("a")!;
    const evento = new Event("click", { bubbles: true, cancelable: true });
    enlace.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it("desbloqueado, no cancela el clic en el enlace de checkout", () => {
    montarBotonYPago();
    const enlace = document.querySelector("a")!;
    const evento = new Event("click", { bubbles: true, cancelable: true });
    enlace.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(false);
  });

  it("aplicar() vuelve a bloquear un botón insertado después (reinserción tras re-render)", () => {
    document.body.innerHTML = "";
    guardia.bloquear("motivo");
    const { boton } = montarBotonYPago();
    expect(boton.hasAttribute("disabled")).toBe(false);
    guardia.aplicar();
    expect(boton.hasAttribute("disabled")).toBe(true);
  });
});
