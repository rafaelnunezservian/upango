import { describe, expect, it, vi } from "vitest";

vi.mock("../shopify.server.js", () => ({
  authenticate: { admin: vi.fn() },
}));

const { contenedor } = await import("../composition/contenedor.server.js");
const { loader } = await import("./app.js");

describe("layout /app (T154)", () => {
  it("devuelve la apiKey de la configuración validada del contenedor", async () => {
    const resultado = await loader({ request: new Request("https://example.com/app") } as never);

    expect(resultado).toEqual({ apiKey: contenedor.config.shopifyApiKey });
  });
});
