import { describe, expect, it, vi, beforeEach } from "vitest";
import { Session } from "@shopify/shopify-api";

vi.mock("../shopify.server.js", () => ({
  authenticate: { webhook: vi.fn() },
}));

const { authenticate } = await import("../shopify.server.js");
const { contenedor } = await import("../composition/contenedor.server.js");
const { action } = await import("./webhooks.app.uninstalled.js");

function crearSesion(shop: string): Session {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: "estado",
    isOnline: false,
    accessToken: "token",
    scope: "write_delivery_customizations,write_app_proxy",
  });
}

describe("webhooks.app.uninstalled action", () => {
  beforeEach(() => {
    vi.mocked(authenticate.webhook).mockReset();
  });

  it("borra las sesiones de la tienda cuando el webhook trae sesión (FR-065)", async () => {
    const shop = `uninstalled-${crypto.randomUUID()}.myshopify.com`;
    const sesion = crearSesion(shop);
    await contenedor.sessionStorage.storeSession(sesion);

    vi.mocked(authenticate.webhook).mockResolvedValue({
      shop,
      session: sesion,
      topic: "APP_UNINSTALLED",
    } as never);
    const info = vi.spyOn(contenedor.registro, "info");

    const respuesta = await action({
      request: new Request("https://example.com/webhooks/app/uninstalled", {
        method: "POST",
      }),
    } as never);

    expect(respuesta.status).toBe(200);
    expect(info).toHaveBeenCalledWith("webhook.recibido", {
      topic: "APP_UNINSTALLED",
      tienda: shop,
    });
    info.mockRestore();
    await expect(
      contenedor.sessionStorage.findSessionsByShop(shop),
    ).resolves.toEqual([]);
  });

  it("no falla si el webhook llega sin sesión (app ya desinstalada)", async () => {
    vi.mocked(authenticate.webhook).mockResolvedValue({
      shop: "sin-sesion.myshopify.com",
      session: undefined,
      topic: "APP_UNINSTALLED",
    } as never);

    const respuesta = await action({
      request: new Request("https://example.com/webhooks/app/uninstalled", {
        method: "POST",
      }),
    } as never);

    expect(respuesta.status).toBe(200);
  });
});
