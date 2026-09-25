import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PuntoPedido } from "./PuntoPedido.js";

interface AtributoFalso {
  readonly key: string;
  readonly value: string;
}

function shopifyFalso(atributos: readonly AtributoFalso[] | undefined) {
  return {
    attributes: { value: atributos },
    i18n: {
      translate: (clave: string, opciones?: Record<string, unknown>) =>
        opciones ? `${clave}:${JSON.stringify(opciones)}` : clave,
    },
  };
}

const ATRIBUTOS_SELECCION: readonly AtributoFalso[] = [
  { key: "punto_id", value: "punto-0001" },
  { key: "punto_nombre", value: "Tienda Centro" },
  { key: "punto_direccion", value: "Av. Siempre Viva 123, Springfield" },
  { key: "punto_lat", value: "40.4168" },
  { key: "punto_lng", value: "-3.7038" },
];

let contenedor: HTMLElement;

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
});

afterEach(() => {
  render(null, contenedor);
  contenedor.remove();
  delete (globalThis as { shopify?: unknown }).shopify;
});

describe("PuntoPedido", () => {
  it("no renderiza nada si punto_id está ausente", () => {
    (globalThis as { shopify?: unknown }).shopify = shopifyFalso([
      { key: "punto_nombre", value: "Tienda Centro" },
    ]);

    render(<PuntoPedido />, contenedor);

    expect(contenedor.innerHTML).toBe("");
  });

  it("no renderiza nada si no hay atributos en el pedido", () => {
    (globalThis as { shopify?: unknown }).shopify = shopifyFalso(undefined);

    render(<PuntoPedido />, contenedor);

    expect(contenedor.innerHTML).toBe("");
  });

  it("muestra el nombre, la dirección y el identificador de la selección", () => {
    (globalThis as { shopify?: unknown }).shopify =
      shopifyFalso(ATRIBUTOS_SELECCION);

    render(<PuntoPedido />, contenedor);

    expect(contenedor.querySelector("s-text")?.textContent).toBe(
      "Tienda Centro",
    );
    expect(contenedor.textContent).toContain(
      "Av. Siempre Viva 123, Springfield",
    );
    expect(contenedor.textContent).toContain(
      'punto_pedido.identificador:{"punto_id":"punto-0001"}',
    );
  });

  it("incluye el enlace al mapa cuando las coordenadas son válidas", () => {
    (globalThis as { shopify?: unknown }).shopify =
      shopifyFalso(ATRIBUTOS_SELECCION);

    render(<PuntoPedido />, contenedor);

    const enlace = contenedor.querySelector("s-link");
    expect(enlace?.getAttribute("href")).toBe(
      "https://www.google.com/maps/search/?api=1&query=40.4168,-3.7038",
    );
    expect(enlace?.getAttribute("target")).toBe("_blank");
  });

  it("omite el enlace de mapa si las coordenadas son inválidas", () => {
    (globalThis as { shopify?: unknown }).shopify = shopifyFalso([
      { key: "punto_id", value: "punto-0001" },
      { key: "punto_nombre", value: "Tienda Centro" },
      { key: "punto_direccion", value: "Av. Siempre Viva 123" },
      { key: "punto_lat", value: "no-es-un-numero" },
      { key: "punto_lng", value: "-3.7038" },
    ]);

    render(<PuntoPedido />, contenedor);

    expect(contenedor.querySelector("s-link")).toBeNull();
  });

  it("omite el enlace de mapa si faltan las coordenadas", () => {
    (globalThis as { shopify?: unknown }).shopify = shopifyFalso([
      { key: "punto_id", value: "punto-0001" },
      { key: "punto_nombre", value: "Tienda Centro" },
      { key: "punto_direccion", value: "Av. Siempre Viva 123" },
    ]);

    render(<PuntoPedido />, contenedor);

    expect(contenedor.querySelector("s-link")).toBeNull();
  });
});
