import { describe, expect, it, vi } from "vitest";

vi.mock("../../shopify.server.js", () => ({
  login: vi.fn(),
}));

const { loader } = await import("./route.js");

describe("landing pública (_index)", () => {
  it("con ?shop= redirige a /app conservando los parámetros", async () => {
    const request = new Request("https://example.com/?shop=tienda.myshopify.com&host=abc");

    const respuesta = await loader({ request } as never).catch((error: unknown) => error);

    expect(respuesta).toBeInstanceOf(Response);
    expect((respuesta as Response).headers.get("Location")).toBe(
      "/app?shop=tienda.myshopify.com&host=abc",
    );
  });

  it("sin shop muestra el formulario de dominio", async () => {
    const resultado = await loader({ request: new Request("https://example.com/") } as never);

    expect(resultado).toEqual({ showForm: true });
  });
});
