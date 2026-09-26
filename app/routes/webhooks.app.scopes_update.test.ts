import { describe, expect, it, vi, beforeEach } from "vitest";
import { Session } from "@shopify/shopify-api";

vi.mock("../shopify.server.js", () => ({
  authenticate: { webhook: vi.fn() },
}));

const { authenticate } = await import("../shopify.server.js");
const { contenedor } = await import("../composition/contenedor.server.js");
const { action } = await import("./webhooks.app.scopes_update.js");

describe("webhooks.app.scopes_update action", () => {
  beforeEach(() => {
    vi.mocked(authenticate.webhook).mockReset();
  });

  it("actualiza el scope guardado en la sesión (FR-066)", async () => {
    const shop = `scopes-${crypto.randomUUID()}.myshopify.com`;
    const sesion = new Session({
      id: `offline_${shop}`,
      shop,
      state: "estado",
      isOnline: false,
      accessToken: "token",
      scope: "write_app_proxy",
    });
    await contenedor.sessionStorage.storeSession(sesion);

    vi.mocked(authenticate.webhook).mockResolvedValue({
      shop,
      session: sesion,
      topic: "APP_SCOPES_UPDATE",
      payload: { current: ["write_delivery_customizations", "write_app_proxy"] },
    } as never);

    const info = vi.spyOn(contenedor.registro, "info");

    const respuesta = await action({
      request: new Request("https://example.com/webhooks/app/scopes_update", {
        method: "POST",
      }),
    } as never);

    expect(respuesta.status).toBe(200);
    expect(info).toHaveBeenCalledWith("webhook.recibido", {
      topic: "APP_SCOPES_UPDATE",
      tienda: shop,
    });
    info.mockRestore();
    const actualizada = await contenedor.sessionStorage.loadSession(sesion.id);
    expect(actualizada?.scope).toBe(
      "write_delivery_customizations,write_app_proxy",
    );
  });
});
