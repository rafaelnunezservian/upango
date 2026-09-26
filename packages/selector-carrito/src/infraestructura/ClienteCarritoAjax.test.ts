import { afterEach, describe, expect, it } from "vitest";
import { raizDeRutas } from "./ClienteCarritoAjax.js";

describe("raizDeRutas (EC-17)", () => {
  afterEach(() => {
    delete window.Shopify;
  });

  it("usa Shopify.routes.root cuando el tema lo expone", () => {
    window.Shopify = { routes: { root: "/en/" } };
    expect(raizDeRutas("/fr")).toBe("/en/");
  });

  it("sin el global usa el respaldo de Liquid y le agrega la barra final", () => {
    expect(raizDeRutas("/en")).toBe("/en/");
    expect(raizDeRutas("/")).toBe("/");
  });

  it("sin global ni respaldo usa la raíz", () => {
    expect(raizDeRutas()).toBe("/");
  });
});
