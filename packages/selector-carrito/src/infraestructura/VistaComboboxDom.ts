import type { PuntoRecogidaDto, SeleccionPunto } from "@puntos-recogida/contratos";
import { construirIndice, filtrar } from "../dominio/filtroPuntos.js";
import type { IndicePuntos } from "../dominio/filtroPuntos.js";
import type { EstadoSelector } from "../dominio/estadoCarrito.js";
import type { VistaSelector } from "../aplicacion/puertos.js";

/** Textos del widget (§17.1, locales `selector.*`). `{n}`/`{total}`/`{nombre}` se interpolan. */
export interface TextosSelector {
  readonly buscar: string;
  readonly escribeParaBuscar: string;
  readonly resultados: string;
  readonly sinResultados: string;
  readonly cargando: string;
  readonly errorCarga: string;
  readonly reintentar: string;
  readonly vacio: string;
  readonly elegido: string;
  readonly cambiar: string;
  readonly avisoDireccion: string;
  readonly guardando: string;
  readonly errorGuardado: string;
}

interface EstadoInstancia {
  consulta: string;
  activandoBusqueda: boolean;
}

function interpolar(texto: string, valores: Readonly<Record<string, string | number>>): string {
  return texto.replace(/\{(\w+)\}/g, (coincidencia, clave: string) =>
    clave in valores ? String(valores[clave]) : coincidencia,
  );
}

/**
 * Renderiza el widget en cada instancia registrada, siempre con
 * `textContent` (FR-034: nunca HTML de datos), y el combobox ARIA 1.2 del
 * §17.5. Todas las instancias comparten el mismo estado y el mismo índice de
 * búsqueda; la consulta de texto es local a cada instancia.
 */
export class VistaComboboxDom implements VistaSelector {
  private readonly instancias = new Map<HTMLElement, EstadoInstancia>();
  private estadoActual: EstadoSelector = { tipo: "inactivo" };
  private indice: IndicePuntos | null = null;

  onElegir: ((punto: PuntoRecogidaDto) => void) | null = null;
  onReintentarCarga: (() => void) | null = null;
  onReintentarGuardado: (() => void) | null = null;

  constructor(
    private readonly titulo: string,
    private readonly textos: TextosSelector,
  ) {}

  registrarInstancia(host: HTMLElement): void {
    if (!this.instancias.has(host)) {
      this.instancias.set(host, { consulta: "", activandoBusqueda: false });
    }
    this.renderizarInstancia(host);
  }

  eliminarInstancia(host: HTMLElement): void {
    this.instancias.delete(host);
  }

  instanciasRegistradas(): readonly HTMLElement[] {
    return Array.from(this.instancias.keys());
  }

  mostrar(estado: EstadoSelector): void {
    this.estadoActual = estado;
    if ("puntos" in estado) {
      this.indice = construirIndice(estado.puntos);
    }
    for (const host of this.instancias.keys()) {
      this.renderizarInstancia(host);
    }
  }

  private renderizarInstancia(host: HTMLElement): void {
    const local = this.instancias.get(host);
    if (!local) {
      return;
    }
    host.replaceChildren();

    if (this.estadoActual.tipo === "inactivo") {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.classList.add("pr-widget");

    const titulo = document.createElement("p");
    titulo.className = "pr-titulo";
    titulo.textContent = this.titulo;
    host.append(titulo);

    const vivo = document.createElement("div");
    vivo.className = "pr-vivo";
    vivo.setAttribute("aria-live", "polite");
    host.append(vivo);

    switch (this.estadoActual.tipo) {
      case "cargando":
        host.append(this.crearMensaje(this.textos.cargando, "pr-cargando"));
        break;
      case "error":
        host.append(this.crearMensaje(this.estadoActual.mensaje, "pr-error"));
        host.append(this.crearBoton(this.textos.reintentar, () => this.onReintentarCarga?.()));
        vivo.textContent = this.estadoActual.mensaje;
        break;
      case "vacio":
        host.append(this.crearMensaje(this.textos.vacio, "pr-vacio"));
        break;
      case "sin_seleccion":
        if (this.estadoActual.aviso) {
          host.append(this.crearMensaje(this.estadoActual.aviso, "pr-aviso"));
          vivo.textContent = this.estadoActual.aviso;
        }
        host.append(this.crearMensaje(this.textos.avisoDireccion, "pr-aviso-direccion"));
        host.append(this.crearCombobox(host, local, vivo));
        break;
      case "guardando":
        host.append(this.crearMensaje(this.textos.guardando, "pr-guardando"));
        break;
      case "con_seleccion":
        host.append(this.crearTarjeta(host, local, vivo, this.estadoActual.seleccion));
        break;
      case "error_guardado":
        host.append(this.crearMensaje(this.estadoActual.mensaje, "pr-error"));
        host.append(this.crearBoton(this.textos.reintentar, () => this.onReintentarGuardado?.()));
        vivo.textContent = this.estadoActual.mensaje;
        break;
      default:
        break;
    }
  }

  private crearMensaje(texto: string, clase: string): HTMLElement {
    const parrafo = document.createElement("p");
    parrafo.className = clase;
    parrafo.textContent = texto;
    return parrafo;
  }

  private crearBoton(texto: string, alHacerClic: () => void): HTMLButtonElement {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pr-boton";
    boton.textContent = texto;
    boton.addEventListener("click", alHacerClic);
    return boton;
  }

  private crearTarjeta(
    host: HTMLElement,
    local: EstadoInstancia,
    vivo: HTMLElement,
    seleccion: SeleccionPunto,
  ): HTMLElement {
    if (local.activandoBusqueda) {
      return this.crearCombobox(host, local, vivo);
    }
    const tarjeta = document.createElement("div");
    tarjeta.className = "pr-tarjeta";

    const etiqueta = document.createElement("p");
    etiqueta.className = "pr-elegido";
    etiqueta.textContent = interpolar(this.textos.elegido, { nombre: seleccion.puntoNombre });
    tarjeta.append(etiqueta);

    const direccion = document.createElement("p");
    direccion.className = "pr-direccion";
    direccion.textContent = seleccion.puntoDireccion;
    tarjeta.append(direccion);

    tarjeta.append(
      this.crearBoton(this.textos.cambiar, () => {
        local.activandoBusqueda = true;
        this.renderizarInstancia(host);
      }),
    );

    const aviso = document.createElement("p");
    aviso.className = "pr-aviso-direccion";
    aviso.textContent = this.textos.avisoDireccion;
    tarjeta.append(aviso);

    return tarjeta;
  }

  private crearCombobox(host: HTMLElement, local: EstadoInstancia, vivo: HTMLElement): HTMLElement {
    const contenedor = document.createElement("div");
    contenedor.className = "pr-combobox";

    const idInput = `pr-input-${Math.random().toString(36).slice(2)}`;
    const idListbox = `${idInput}-listbox`;

    const etiqueta = document.createElement("label");
    etiqueta.className = "pr-etiqueta";
    etiqueta.setAttribute("for", idInput);
    etiqueta.textContent = this.textos.buscar;
    contenedor.append(etiqueta);

    const input = document.createElement("input");
    input.type = "text";
    input.id = idInput;
    input.className = "pr-input";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", idListbox);
    input.setAttribute("aria-autocomplete", "list");
    input.autocomplete = "off";
    input.value = local.consulta;
    contenedor.append(input);

    const listbox = document.createElement("ul");
    listbox.id = idListbox;
    listbox.className = "pr-listbox";
    listbox.setAttribute("role", "listbox");
    contenedor.append(listbox);

    let activo = -1;

    const opciones = (): readonly PuntoRecogidaDto[] => {
      if (!this.indice) {
        return [];
      }
      return filtrar(this.indice, local.consulta).resultados;
    };

    const anunciar = (): void => {
      const total = this.indice ? filtrar(this.indice, local.consulta).total : 0;
      if (!local.consulta) {
        vivo.textContent = interpolar(this.textos.escribeParaBuscar, { total });
        return;
      }
      vivo.textContent =
        total === 0 ? this.textos.sinResultados : interpolar(this.textos.resultados, { n: total });
    };

    const pintarLista = (): void => {
      listbox.replaceChildren();
      const resultados = opciones();
      resultados.forEach((punto, indice) => {
        const item = document.createElement("li");
        item.id = `${idListbox}-opcion-${indice}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(indice === activo));
        item.className = "pr-opcion";

        const nombre = document.createElement("span");
        nombre.className = "pr-opcion-nombre";
        nombre.textContent = punto.nombre;
        item.append(nombre);

        const direccion = document.createElement("span");
        direccion.className = "pr-opcion-direccion";
        direccion.textContent = punto.direccionCorta;
        item.append(direccion);

        item.addEventListener("click", () => this.onElegir?.(punto));
        listbox.append(item);
      });
      input.setAttribute(
        "aria-activedescendant",
        activo >= 0 ? `${idListbox}-opcion-${activo}` : "",
      );
      anunciar();
    };

    input.addEventListener("input", () => {
      local.consulta = input.value;
      activo = -1;
      pintarLista();
    });

    input.addEventListener("keydown", (evento) => {
      const resultados = opciones();
      if (resultados.length === 0) {
        return;
      }
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        activo = Math.min(activo + 1, resultados.length - 1);
        pintarLista();
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        activo = Math.max(activo - 1, 0);
        pintarLista();
      } else if (evento.key === "Home") {
        evento.preventDefault();
        activo = 0;
        pintarLista();
      } else if (evento.key === "End") {
        evento.preventDefault();
        activo = resultados.length - 1;
        pintarLista();
      } else if (evento.key === "Enter") {
        evento.preventDefault();
        const punto = resultados[activo];
        if (punto) {
          this.onElegir?.(punto);
        }
      } else if (evento.key === "Escape") {
        local.activandoBusqueda = false;
        this.renderizarInstancia(host);
      }
    });

    pintarLista();
    return contenedor;
  }
}
