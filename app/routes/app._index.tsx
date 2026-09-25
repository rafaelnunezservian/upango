import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { contenedor } from "../composition/contenedor.server";
import { crearPuntosDeEjemplo } from "../application/use-cases/crearPuntosDeEjemplo.js";
import {
  obtenerEstadoConfiguracion,
  type EstadoConfiguracion,
  type EstadoPersonalizacion,
} from "../application/use-cases/obtenerEstadoConfiguracion.js";
import { activarPersonalizacionesEntrega } from "../application/use-cases/activarPersonalizacionesEntrega.js";
import { es } from "../i18n/es.js";

function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  try {
    const estado = await obtenerEstadoConfiguracion(session.shop, {
      consulta: contenedor.crearConsultaConfiguracionTienda(admin.graphql),
      gateway: contenedor.crearGatewayPersonalizaciones(admin.graphql),
      apiKey: contenedor.config.shopifyApiKey,
      habilitarSemilla: contenedor.config.habilitarSemilla,
    });
    return { estado, error: null };
  } catch (error) {
    contenedor.registro.error("admin.carga_fallida", {
      tienda: session.shop,
      motivo: mensajeDeError(error),
    });
    return { estado: null, error: es.errores.cargaFallida };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const intencion = formData.get("intencion");

  if (intencion === "activar") {
    const resultado = await activarPersonalizacionesEntrega({
      gateway: contenedor.crearGatewayPersonalizaciones(admin.graphql),
      registro: contenedor.registro,
    });
    return { activado: resultado };
  }

  if (intencion === "sembrar") {
    // FR-005: la herramienta de semilla solo existe con HABILITAR_SEMILLA=true
    // (nunca en producción; `config.server.ts` ya impide esa combinación al
    // arrancar el proceso).
    if (!contenedor.config.habilitarSemilla) {
      throw new Response("La creación de puntos de ejemplo no está habilitada.", {
        status: 403,
      });
    }
    const resultado = await crearPuntosDeEjemplo({
      escritor: contenedor.crearEscritorPuntos(admin.graphql),
      registro: contenedor.registro,
    });
    return { sembrado: resultado };
  }

  throw new Response("Intención desconocida.", { status: 400 });
};

function resumenPersonalizaciones(
  personalizaciones: EstadoConfiguracion["personalizaciones"],
): { texto: string; tone: "success" | "warning" } {
  const estados: EstadoPersonalizacion[] = Object.values(personalizaciones);
  if (estados.every((estado) => estado === "activa")) {
    return { texto: es.pasos.personalizaciones.estados.activa, tone: "success" };
  }
  if (estados.some((estado) => estado === "inexistente")) {
    return { texto: es.pasos.personalizaciones.estados.inexistente, tone: "warning" };
  }
  return { texto: es.pasos.personalizaciones.estados.inactiva, tone: "warning" };
}

export default function Index() {
  const { estado, error } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const fetcherActivar = useFetcher<typeof action>();
  const fetcherSemilla = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const activando =
    ["loading", "submitting"].includes(fetcherActivar.state) &&
    fetcherActivar.formMethod === "POST";
  const sembrando =
    ["loading", "submitting"].includes(fetcherSemilla.state) &&
    fetcherSemilla.formMethod === "POST";

  useEffect(() => {
    if (!fetcherActivar.data || !("activado" in fetcherActivar.data)) {
      return;
    }
    const { errores } = fetcherActivar.data.activado;
    if (errores.length === 0) {
      shopify.toast.show(es.pasos.personalizaciones.exito);
    } else {
      shopify.toast.show(errores.map((e) => e.message).join(" "), { isError: true });
    }
  }, [fetcherActivar.data, shopify]);

  useEffect(() => {
    if (fetcherSemilla.data && "sembrado" in fetcherSemilla.data) {
      shopify.toast.show(es.datosDeEjemplo.exito(fetcherSemilla.data.sembrado.creados));
    }
  }, [fetcherSemilla.data, shopify]);

  if (error || !estado) {
    return (
      <s-page heading={es.pagina.titulo}>
        <s-banner heading={error ?? es.errores.cargaFallida} tone="critical">
          <s-button onClick={() => revalidator.revalidate()}>
            {es.errores.reintentar}
          </s-button>
        </s-banner>
      </s-page>
    );
  }

  const erroresActivar =
    fetcherActivar.data && "activado" in fetcherActivar.data
      ? fetcherActivar.data.activado.errores
      : [];
  const personalizaciones = resumenPersonalizaciones(estado.personalizaciones);

  return (
    <s-page heading={es.pagina.titulo}>
      {erroresActivar.length > 0 && (
        <s-banner heading={es.pasos.personalizaciones.titulo} tone="critical">
          <s-unordered-list>
            {erroresActivar.map((error, indice) => (
              <s-list-item key={indice}>{error.message}</s-list-item>
            ))}
          </s-unordered-list>
        </s-banner>
      )}

      <s-section heading={es.queHaceLaApp.titulo}>
        <s-unordered-list>
          {es.queHaceLaApp.vinetas.map((vineta, indice) => (
            <s-list-item key={indice}>{vineta}</s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      <s-section heading={es.pasos.titulo}>
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-heading>{es.pasos.puntos.titulo}</s-heading>
              <s-badge tone={estado.puntos.total > 0 ? "success" : "warning"}>
                {es.pasos.puntos.estado(estado.puntos.total)}
              </s-badge>
            </s-stack>
            <s-link href={estado.enlaces.entradasPuntos}>{es.pasos.puntos.accion}</s-link>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-heading>{es.pasos.tarifa.titulo}</s-heading>
              <s-badge tone="warning">{es.pasos.tarifa.estado}</s-badge>
            </s-stack>
            <s-paragraph>{es.pasos.tarifa.descripcion}</s-paragraph>
            <s-link href={estado.enlaces.ajustesEnvio}>{es.pasos.tarifa.accion}</s-link>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-heading>
                {es.pasos.appEmbed.numero} {es.pasos.appEmbed.titulo}
              </s-heading>
              <s-badge tone="warning">{es.pasos.appEmbed.estado}</s-badge>
            </s-stack>
            <s-paragraph>{es.pasos.appEmbed.descripcion}</s-paragraph>
            <s-link href={estado.enlaces.editorTemas} target="_top">
              {es.pasos.appEmbed.accion}
            </s-link>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-heading>{es.pasos.personalizaciones.titulo}</s-heading>
              <s-badge tone={personalizaciones.tone}>{personalizaciones.texto}</s-badge>
            </s-stack>
            <s-button
              onClick={() => fetcherActivar.submit({ intencion: "activar" }, { method: "POST" })}
              {...(activando ? { loading: true } : {})}
            >
              {es.pasos.personalizaciones.accion}
            </s-button>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-heading>{es.pasos.bloquePedido.titulo}</s-heading>
              <s-badge tone="warning">{es.pasos.bloquePedido.estado}</s-badge>
            </s-stack>
            <s-paragraph>{es.pasos.bloquePedido.descripcion}</s-paragraph>
            <s-link href={estado.enlaces.ajustesCheckout}>{es.pasos.bloquePedido.accion}</s-link>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading={es.comoFunciona.titulo}>
        <s-paragraph>{es.comoFunciona.texto}</s-paragraph>
      </s-section>

      <s-section heading={es.modoDemo.titulo}>
        <s-paragraph>{es.modoDemo.texto}</s-paragraph>
      </s-section>

      <s-banner heading={es.antesDeDesinstalar.titulo} tone="warning">
        <s-paragraph>{es.antesDeDesinstalar.texto}</s-paragraph>
      </s-banner>

      {estado.semillaHabilitada && (
        <s-section heading={es.datosDeEjemplo.titulo}>
          <s-paragraph>{es.datosDeEjemplo.texto}</s-paragraph>
          <s-button
            onClick={() => fetcherSemilla.submit({ intencion: "sembrar" }, { method: "POST" })}
            {...(sembrando ? { loading: true } : {})}
          >
            {es.datosDeEjemplo.accion}
          </s-button>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
