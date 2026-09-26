import type { LoginError } from "@shopify/shopify-app-react-router/server";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { es } from "../../i18n/es.js";

interface LoginErrorMessage {
  shop?: string;
}

export function loginErrorMessage(loginErrors: LoginError): LoginErrorMessage {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return { shop: es.inicioSesion.errores.tiendaFaltante };
  } else if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return { shop: es.inicioSesion.errores.tiendaInvalida };
  }

  return {};
}
