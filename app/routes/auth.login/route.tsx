import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { es } from "../../i18n/es.js";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

// Ruta de inicio de sesión del template (§15.1, T145). `@shopify/shopify-app-react-router`
// v3 quitó `<AppProvider embedded={false}>`, que en el template solo cargaba
// los web components de Polaris sin App Bridge: se carga ese mismo script aquí.
const POLARIS_URL = "https://cdn.shopify.com/shopifycloud/polaris.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <>
      <script src={POLARIS_URL} />
      <s-page>
        <Form method="post">
          <s-section heading={es.inicioSesion.titulo}>
            <s-text-field
              name="shop"
              label={es.inicioSesion.campoTienda}
              details={es.inicioSesion.ayudaTienda}
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              {...(errors.shop ? { error: errors.shop } : {})}
            ></s-text-field>
            <s-button type="submit">{es.inicioSesion.enviar}</s-button>
          </s-section>
        </Form>
      </s-page>
    </>
  );
}
