import type { GuardiaCheckout } from "../aplicacion/puertos.js";

export interface OpcionesGuardiaCheckout {
  readonly selectorBotonesCheckout: string;
  readonly selectorPagosAcelerados: string;
}

/**
 * Bloquea/desbloquea los botones de checkout (§17.4): `disabled` +
 * `aria-disabled`, un aviso enlazado con `aria-describedby`, ocultamiento de
 * los contenedores de pago acelerado y listeners en fase de captura que
 * cancelan la navegación a `/checkout` mientras está bloqueado.
 */
export class GuardiaCheckoutDom implements GuardiaCheckout {
  private bloqueado = false;
  private motivo = "";

  constructor(private readonly opciones: OpcionesGuardiaCheckout) {
    document.addEventListener("click", this.alEvento, true);
    document.addEventListener("submit", this.alEvento, true);
  }

  /** Quita los listeners globales (uso en tests; en la página vive hasta que se descarga). */
  destruir(): void {
    document.removeEventListener("click", this.alEvento, true);
    document.removeEventListener("submit", this.alEvento, true);
  }

  bloquear(motivo: string): void {
    this.bloqueado = true;
    this.motivo = motivo;
    this.aplicar();
  }

  desbloquear(): void {
    this.bloqueado = false;
    this.motivo = "";
    this.aplicar();
  }

  /** Vuelve a aplicar el estado actual a los botones presentes en el DOM (tras un re-render). */
  aplicar(): void {
    this.botones().forEach((boton, indice) => this.aplicarABoton(boton, indice));
    for (const contenedor of this.contenedoresPago()) {
      contenedor.hidden = this.bloqueado;
    }
  }

  private aplicarABoton(boton: Element, indice: number): void {
    const id = `pr-motivo-bloqueo-${indice}`;
    const existente = boton.nextElementSibling;
    let aviso: HTMLElement;
    if (existente instanceof HTMLElement && existente.dataset.prAviso === "true") {
      aviso = existente;
    } else {
      aviso = document.createElement("span");
      aviso.dataset.prAviso = "true";
      aviso.className = "pr-motivo-bloqueo";
      boton.insertAdjacentElement("afterend", aviso);
    }
    aviso.id = id;
    aviso.textContent = this.bloqueado ? this.motivo : "";

    if (this.bloqueado) {
      boton.setAttribute("disabled", "");
      boton.setAttribute("aria-disabled", "true");
      boton.setAttribute("aria-describedby", id);
    } else {
      boton.removeAttribute("disabled");
      boton.removeAttribute("aria-disabled");
      boton.removeAttribute("aria-describedby");
    }
  }

  private botones(): Element[] {
    return Array.from(document.querySelectorAll(this.opciones.selectorBotonesCheckout));
  }

  private contenedoresPago(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(this.opciones.selectorPagosAcelerados));
  }

  private esEnlaceOBotonCheckout(objetivo: Element): boolean {
    return (
      objetivo.closest(this.opciones.selectorBotonesCheckout) !== null ||
      objetivo.closest('a[href$="/checkout"]') !== null
    );
  }

  private esEnvioDeCheckout(formulario: HTMLFormElement | null): boolean {
    return formulario !== null && formulario.querySelector('[name="checkout"]') !== null;
  }

  private alEvento = (evento: Event): void => {
    if (!this.bloqueado) {
      return;
    }
    const objetivo = evento.target;
    if (!(objetivo instanceof Element)) {
      return;
    }
    const formulario = objetivo instanceof HTMLFormElement ? objetivo : objetivo.closest("form");
    const debeCancelar =
      (evento.type === "submit" && this.esEnvioDeCheckout(formulario)) ||
      (evento.type === "click" && this.esEnlaceOBotonCheckout(objetivo));
    if (debeCancelar) {
      evento.preventDefault();
      evento.stopPropagation();
    }
  };
}
