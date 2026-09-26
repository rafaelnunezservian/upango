import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { es } from "../../i18n/es.js";

vi.mock("../../shopify.server.js", () => ({
  login: vi.fn(),
}));

const { login } = await import("../../shopify.server.js");
const { loader, action } = await import("./route.js");
const { loginErrorMessage } = await import("./error.server.js");

function peticion(method: "GET" | "POST" = "GET"): Request {
  return new Request("https://example.com/auth/login", { method });
}

describe("loginErrorMessage", () => {
  it("sin dominio de tienda → texto en español", () => {
    expect(loginErrorMessage({ shop: LoginErrorType.MissingShop })).toEqual({
      shop: es.inicioSesion.errores.tiendaFaltante,
    });
  });

  it("dominio inválido → texto en español", () => {
    expect(loginErrorMessage({ shop: LoginErrorType.InvalidShop })).toEqual({
      shop: es.inicioSesion.errores.tiendaInvalida,
    });
  });

  it("sin errores → objeto vacío", () => {
    expect(loginErrorMessage({})).toEqual({});
  });
});

describe("auth.login (T145)", () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
  });

  it("el loader responde el formulario con los errores de login traducidos", async () => {
    vi.mocked(login).mockResolvedValue({ shop: LoginErrorType.MissingShop });

    const resultado = await loader({ request: peticion() } as never);

    expect(resultado).toEqual({ errors: { shop: es.inicioSesion.errores.tiendaFaltante } });
  });

  it("la action traduce un dominio inválido", async () => {
    vi.mocked(login).mockResolvedValue({ shop: LoginErrorType.InvalidShop });

    const resultado = await action({ request: peticion("POST") } as never);

    expect(resultado).toEqual({ errors: { shop: es.inicioSesion.errores.tiendaInvalida } });
  });
});
