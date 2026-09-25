import { describe, expect, it, vi, beforeEach } from "vitest";
import { Session } from "@shopify/shopify-api";

vi.mock("../shopify.server.js", () => ({
  authenticate: { webhook: vi.fn() },
}));

const { authenticate } = await import("../shopify.server.js");
const { contenedor } = await import("../composition/contenedor.server.js");
const { action } = await import("./webhooks.compliance.js");

function mockWebhook(topic: string, shop: string) {
  vi.mocked(authenticate.webhook).mockResolvedValue({
    shop,
    topic,
    payload: {},
  } as never);
}

async function ejecutar() {
  return action({
    request: new Request("https://example.com/webhooks/compliance", {
      method: "POST",
    }),
  } as never);
}

describe("webhooks.compliance action", () => {
  beforeEach(() => {
    vi.mocked(authenticate.webhook).mockReset();
  });

  it("responde 200 para customers/data_request sin tocar sesiones (FR-067)", async () => {
    mockWebhook("CUSTOMERS_DATA_REQUEST", "cumplimiento-1.myshopify.com");
    const respuesta = await ejecutar();
    expect(respuesta.status).toBe(200);
  });

  it("responde 200 para customers/redact sin tocar sesiones (FR-067)", async () => {
    mockWebhook("CUSTOMERS_REDACT", "cumplimiento-2.myshopify.com");
    const respuesta = await ejecutar();
    expect(respuesta.status).toBe(200);
  });

  it("shop/redact borra las sesiones de la tienda (FR-067)", async () => {
    const shop = `cumplimiento-${crypto.randomUUID()}.myshopify.com`;
    await contenedor.sessionStorage.storeSession(
      new Session({
        id: `offline_${shop}`,
        shop,
        state: "estado",
        isOnline: false,
        accessToken: "token",
        scope: "write_app_proxy",
      }),
    );

    mockWebhook("SHOP_REDACT", shop);
    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(200);
    await expect(
      contenedor.sessionStorage.findSessionsByShop(shop),
    ).resolves.toEqual([]);
  });
});
