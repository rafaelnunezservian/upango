import type { AtributosCarrito } from "@puntos-recogida/contratos";
import { ControladorSelector } from "./aplicacion/ControladorSelector.js";
import { ClienteCarritoAjax } from "./infraestructura/ClienteCarritoAjax.js";
import { ClientePuntosProxy } from "./infraestructura/ClientePuntosProxy.js";
import { GuardiaCheckoutDom } from "./infraestructura/GuardiaCheckoutDom.js";
import { ObservadorCarritoDom } from "./infraestructura/ObservadorCarritoDom.js";
import { VistaComboboxDom } from "./infraestructura/VistaComboboxDom.js";
import type { TextosSelector } from "./infraestructura/VistaComboboxDom.js";
import { InsertadorWidgets } from "./infraestructura/InsertadorWidgets.js";

interface AjustesConfig {
  readonly titulo: string;
  readonly selectorBotonesCheckout: string;
  readonly selectorPagosAcelerados: string;
  readonly selectorInsercion: string;
  readonly selectorContextosCompactos: string;
  readonly modoDemo: boolean;
}

interface TextosConfig extends TextosSelector {
  readonly motivoBloqueo: string;
  readonly noDisponible: string;
  readonly enlaceCompacto: string;
}

interface ConfigInicial {
  readonly tipoCarrito: string;
  readonly seleccion: Readonly<Record<string, string>> | null;
  readonly urlPuntos: string;
  readonly ajustes: AjustesConfig;
  readonly textos: TextosConfig;
}

function leerConfig(): ConfigInicial | null {
  const script = document.getElementById("pr-config");
  if (!(script instanceof HTMLScriptElement) || !script.textContent) {
    return null;
  }
  try {
    return JSON.parse(script.textContent) as ConfigInicial;
  } catch {
    return null;
  }
}

function iniciar(config: ConfigInicial): void {
  const atributosIniciales: AtributosCarrito = {
    tipo_carrito: config.tipoCarrito,
    ...(config.seleccion ?? {}),
  };

  const clienteCarrito = new ClienteCarritoAjax();
  const clientePuntos = new ClientePuntosProxy(config.urlPuntos);
  const observador = new ObservadorCarritoDom();
  const guardia = new GuardiaCheckoutDom({
    selectorBotonesCheckout: config.ajustes.selectorBotonesCheckout,
    selectorPagosAcelerados: config.ajustes.selectorPagosAcelerados,
  });
  const vista = new VistaComboboxDom(config.ajustes.titulo, config.textos);
  const insertador = new InsertadorWidgets(
    {
      selectorBotonesCheckout: config.ajustes.selectorBotonesCheckout,
      selectorInsercion: config.ajustes.selectorInsercion,
      selectorContextosCompactos: config.ajustes.selectorContextosCompactos,
      textoEnlaceCompacto: config.textos.enlaceCompacto,
    },
    vista,
    () => guardia.aplicar(),
  );

  const controlador = new ControladorSelector({
    clienteCarrito,
    clientePuntos,
    vista: insertador,
    guardia,
    observador,
    textos: {
      motivoBloqueo: config.textos.motivoBloqueo,
      errorCarga: config.textos.errorCarga,
      vacio: config.textos.vacio,
      puntoNoDisponible: config.textos.noDisponible,
      errorGuardado: config.textos.errorGuardado,
    },
  });

  vista.onElegir = (punto) => void controlador.elegir(punto);
  vista.onReintentarCarga = () => void controlador.reintentarCarga();
  vista.onReintentarGuardado = () => void controlador.reintentarGuardado();

  insertador.insertar();
  void controlador.iniciar(atributosIniciales);
}

function arrancar(): void {
  const config = leerConfig();
  if (!config) {
    return;
  }
  iniciar(config);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
