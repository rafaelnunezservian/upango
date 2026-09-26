import type { ErrorProxyDto } from "@puntos-recogida/contratos";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import { contenedor } from "../composition/contenedor.server.js";
import { PuntosNoDisponiblesError } from "../domain/errores.js";

function errorJson(status: number, cuerpo: ErrorProxyDto): Response {
  return Response.json(cuerpo, { status });
}

/**
 * `GET /apps/puntos-recogida/puntos` (CT-03): lee la lista de puntos de la
 * tienda que hace la petición vía App Proxy. `authenticate.public.appProxy`
 * ya rechaza (400) las peticiones sin firma HMAC válida antes de llegar
 * aquí (FR-011).
 */
export const loader = ({ request }: LoaderFunctionArgs) =>
  contenedor.conContextoPeticion(request, () => responderPuntos(request));

async function responderPuntos(request: Request): Promise<Response> {
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return errorJson(404, {
      error: "APP_NO_INSTALADA",
      mensaje: "La app no está instalada en esta tienda.",
    });
  }

  const inicio = contenedor.reloj.ahora().getTime();
  try {
    const { respuesta, estadoCache } = await contenedor.listarPuntosRecogida.ejecutar(
      session.shop,
      contenedor.crearFuentePuntos(admin.graphql),
    );
    contenedor.registro.info("proxy.puntos.respuesta", {
      tienda: session.shop,
      estadoCache,
      total: respuesta.total,
      duracionMs: contenedor.reloj.ahora().getTime() - inicio,
    });
    return Response.json(respuesta, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    if (error instanceof PuntosNoDisponiblesError) {
      // El detalle del fallo ya quedó en `puntos.carga.error`.
      contenedor.registro.error("proxy_puntos.puntos_no_disponibles", {
        tienda: session.shop,
      });
      return errorJson(502, {
        error: "PUNTOS_NO_DISPONIBLES",
        mensaje: "No se pudieron obtener los puntos de recogida.",
      });
    }

    // Mensaje y stack del error (nunca la sesión ni el token) para el 500.
    contenedor.registro.error("proxy_puntos.error_inesperado", {
      tienda: session.shop,
      motivo: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    return errorJson(500, { error: "ERROR_INTERNO", mensaje: "Error interno." });
  }
}
