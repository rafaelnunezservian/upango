import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useLoaderData } from "react-router";

import { es } from "../../i18n/es.js";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "../auth.login/error.server";

import styles from "./styles.module.css";

// Landing pública (§15.1, NFR-16): fuera del admin, en español; si la
// petición ya trae `shop` (instalación desde Shopify), va directo a la app.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;
  const textos = es.landing;

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>{textos.titulo}</h1>
        <p className={styles.text}>{textos.lema}</p>
        {showForm && (
          <Form className={styles.form} method="post">
            <label className={styles.label}>
              <span>{textos.campoTienda}</span>
              <input className={styles.input} type="text" name="shop" />
              <span>{errors?.shop ?? textos.ayudaTienda}</span>
            </label>
            <button className={styles.button} type="submit">
              {textos.enviar}
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          {textos.caracteristicas.map((caracteristica) => (
            <li key={caracteristica.titulo}>
              <strong>{caracteristica.titulo}</strong>. {caracteristica.texto}
            </li>
          ))}
        </ul>
        <p>
          <a href="/privacidad">{textos.privacidad}</a>
        </p>
      </div>
    </div>
  );
}
