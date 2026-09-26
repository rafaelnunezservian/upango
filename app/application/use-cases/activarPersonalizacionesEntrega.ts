import type {
  GatewayPersonalizaciones,
  UserErrorPersonalizacion,
} from "../ports/gatewayPersonalizaciones.js";
import type { Registro } from "../ports/registro.js";

export interface PersonalizacionEntregaHandle {
  readonly handle: string;
  readonly titulo: string;
}

/**
 * Handles y títulos de las 2 delivery customizations de esta app (CT-04,
 * CT-05, FR-057) — los mismos `name` declarados en el `shopify.extension.toml`
 * de cada Function, para que el título creado coincida con el que ve el
 * comerciante al abrir Configuración → Envío y entrega → Personalizaciones.
 */
export const PERSONALIZACIONES_ENTREGA: readonly PersonalizacionEntregaHandle[] = [
  { handle: "ocultar-envios", titulo: "Puntos de recogida · ocultar envíos" },
  { handle: "renombrar-recogida", titulo: "Puntos de recogida · renombrar recogida" },
];

export interface DependenciasActivarPersonalizacionesEntrega {
  readonly tienda: string;
  readonly gateway: GatewayPersonalizaciones;
  readonly registro: Registro;
}

export interface ResultadoActivarPersonalizacionesEntrega {
  readonly creadas: number;
  readonly activadas: number;
  readonly errores: readonly UserErrorPersonalizacion[];
}

/**
 * Caso de uso del FR-057 (US-5.3): para cada delivery customization de esta
 * app, la crea si falta (con `functionHandle` y su título), la activa si
 * existe pero está inactiva, y no hace nada si ya está activa. Es
 * idempotente: ejecutarlo varias veces nunca duplica ni reactiva de más
 * (US-5.3, EC-22).
 */
export async function activarPersonalizacionesEntrega({
  tienda,
  gateway,
  registro,
}: DependenciasActivarPersonalizacionesEntrega): Promise<ResultadoActivarPersonalizacionesEntrega> {
  const existentes = await gateway.listarDeEstaApp();
  let creadas = 0;
  let activadas = 0;
  const errores: UserErrorPersonalizacion[] = [];

  for (const { handle, titulo } of PERSONALIZACIONES_ENTREGA) {
    const existente = existentes.find((personalizacion) => personalizacion.handle === handle);

    if (!existente) {
      const resultado = await gateway.crear(handle, titulo);
      if (resultado.userErrors.length > 0) {
        errores.push(...resultado.userErrors);
      } else {
        creadas += 1;
      }
      continue;
    }

    if (!existente.activa) {
      const resultado = await gateway.activar(existente.id);
      if (resultado.userErrors.length > 0) {
        errores.push(...resultado.userErrors);
      } else {
        activadas += 1;
      }
    }
  }

  registro.info("personalizaciones.activacion", {
    tienda,
    creadas,
    activadas,
    errores: errores.length,
  });

  return { creadas, activadas, errores };
}
