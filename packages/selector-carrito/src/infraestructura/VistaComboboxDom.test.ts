import { afterEach, describe, expect, it, vi } from "vitest";
import { VistaComboboxDom } from "./VistaComboboxDom.js";
import type { TextosSelector } from "./VistaComboboxDom.js";
import type { PuntoRecogidaDto, SeleccionPunto } from "@puntos-recogida/contratos";

const textos: TextosSelector = {
  buscar: "Busca por nombre, dirección o ciudad",
  escribeParaBuscar: "Escribe para buscar entre {total} puntos",
  resultados: "{n} resultados",
  sinResultados: "Sin resultados",
  cargando: "Cargando puntos de recogida…",
  errorCarga: "No se pudieron cargar los puntos",
  reintentar: "Reintentar",
  vacio: "No hay puntos de recogida disponibles. Contacta con la tienda.",
  elegido: "Elegiste: {nombre}",
  cambiar: "Cambiar",
  avisoDireccion:
    "Este pedido se entrega en un punto de recogida. En el checkout te pediremos una dirección, pero no se usará para el envío.",
  guardando: "Guardando…",
  errorGuardado: "No se pudo guardar el punto",
};

const punto: PuntoRecogidaDto = {
  id: "PR-001",
  gid: "gid://shopify/Metaobject/1",
  nombre: "Kiosko Sol",
  direccion: "Puerta del Sol 1, Madrid",
  direccionCorta: "Pta. del Sol 1, Madrid",
  lat: 40.416775,
  lng: -3.70379,
};

describe("VistaComboboxDom", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("en sin_seleccion renderiza un combobox ARIA con la lista de puntos", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const vista = new VistaComboboxDom("Punto de recogida", textos);
    vista.registrarInstancia(host);

    vista.mostrar({ tipo: "sin_seleccion", puntos: [punto] });

    const input = host.querySelector('input[role="combobox"]')!;
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    const listbox = host.querySelector('[role="listbox"]')!;
    expect(listbox.querySelectorAll('[role="option"]').length).toBe(1);
    expect(listbox.textContent).toContain(punto.nombre);
  });

  it("elegir una opción de la lista llama a onElegir con el punto correspondiente", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const vista = new VistaComboboxDom("Punto de recogida", textos);
    const onElegir = vi.fn();
    vista.onElegir = onElegir;
    vista.registrarInstancia(host);
    vista.mostrar({ tipo: "sin_seleccion", puntos: [punto] });

    const opcion = host.querySelector('[role="option"]')!;
    opcion.dispatchEvent(new Event("click", { bubbles: true }));

    expect(onElegir).toHaveBeenCalledWith(punto);
  });

  it("nunca inserta HTML de datos: un nombre con etiquetas se muestra como texto plano", () => {
    const puntoConHtml: PuntoRecogidaDto = { ...punto, nombre: "<img src=x onerror=alert(1)>" };
    const host = document.createElement("div");
    document.body.append(host);
    const vista = new VistaComboboxDom("Punto de recogida", textos);
    vista.registrarInstancia(host);
    vista.mostrar({ tipo: "sin_seleccion", puntos: [puntoConHtml] });

    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("en con_seleccion muestra la tarjeta con el nombre elegido y el botón Cambiar", () => {
    const seleccion: SeleccionPunto = {
      puntoId: punto.id,
      puntoGid: punto.gid,
      puntoNombre: punto.nombre,
      puntoDireccion: punto.direccion,
      puntoDireccionCorta: punto.direccionCorta,
      puntoLat: String(punto.lat),
      puntoLng: String(punto.lng),
    };
    const host = document.createElement("div");
    document.body.append(host);
    const vista = new VistaComboboxDom("Punto de recogida", textos);
    vista.registrarInstancia(host);
    vista.mostrar({ tipo: "con_seleccion", puntos: [punto], seleccion });

    expect(host.textContent).toContain("Elegiste: Kiosko Sol");
    expect(host.querySelector("button")?.textContent).toBe("Cambiar");
  });

  it("inactivo oculta la instancia", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const vista = new VistaComboboxDom("Punto de recogida", textos);
    vista.registrarInstancia(host);
    vista.mostrar({ tipo: "inactivo" });
    expect(host.hidden).toBe(true);
  });
});
