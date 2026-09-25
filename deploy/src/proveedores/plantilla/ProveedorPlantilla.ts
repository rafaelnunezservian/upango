import { ProveedorNoImplementadoError } from "../../dominio/errores.js";
import type { ProveedorDespliegue, ReferenciaImagen, ResultadoDespliegue } from "../../puertos/index.js";

/**
 * Punto de partida para un proveedor nuevo (§20.7, "Agregar un proveedor").
 * NO está registrado en `../registro.ts`: es solo el esqueleto a copiar.
 *
 * Pasos para usarlo de verdad:
 *
 * 1. Copia esta carpeta a `deploy/src/proveedores/<nombre>/` y renombra la
 *    clase.
 * 2. Implementa cada método usando SOLO `EjecutorComandos` (el mismo puerto
 *    que usa `ProveedorGcp`) para invocar el CLI del proveedor. Nunca
 *    importes un SDK de nube fuera de esta carpeta o de
 *    `app/infrastructure/**` (FR-083; la regla de lint de
 *    `no-restricted-imports` lo hace cumplir).
 * 3. Valida el bloque `proveedores.<nombre>` de `deploy.config.json` con tu
 *    propio esquema zod (mira `../gcp/config.ts` como referencia): el
 *    esquema neutral de `deploy.config.json` lo trata como opaco a
 *    propósito, así que cada proveedor valida el suyo.
 * 4. Elige el almacenamiento de sesiones del backend para tu nube (un
 *    adaptador oficial de Shopify o uno propio que pase los contract tests
 *    de `SessionStorage`) y regístralo con un valor nuevo de
 *    `SESSION_STORAGE_DRIVER` en `app/composition/contenedor.server.ts`.
 * 5. Registra la fábrica en `deploy/src/proveedores/registro.ts` y agrega tu
 *    bloque en `deploy/deploy.config.json`.
 * 6. Escribe los tests con un `EjecutorComandos` falso (ver
 *    `../gcp/ProveedorGcp.test.ts`): comandos exactos, idempotencia y que
 *    los secretos viajan por `opciones.entrada`, nunca como argumento.
 * 7. Documenta el mapeo de capacidades (cómputo, imagen, secretos, sesiones)
 *    en el README.
 *
 * El constructor real debe recibir un `EjecutorComandos` (como
 * `ProveedorGcp`, que lo usa para invocar `gcloud`); este esqueleto no
 * declara ese parámetro porque ningún método lo necesita todavía.
 */
export class ProveedorPlantilla implements ProveedorDespliegue {
  readonly nombre = "plantilla";

  async verificarPrerrequisitos(): Promise<void> {
    throw this.noImplementado();
  }

  async prepararInfraestructura(): Promise<void> {
    throw this.noImplementado();
  }

  async publicarSecretos(): Promise<void> {
    throw this.noImplementado();
  }

  async construirImagen(): Promise<ReferenciaImagen> {
    throw this.noImplementado();
  }

  async desplegarServicio(): Promise<ResultadoDespliegue> {
    throw this.noImplementado();
  }

  async actualizarVariables(): Promise<void> {
    throw this.noImplementado();
  }

  private noImplementado(): ProveedorNoImplementadoError {
    return new ProveedorNoImplementadoError(
      'El proveedor "plantilla" es solo un esqueleto de ejemplo, no está implementado. ' +
        'Sigue la guía "Agregar un proveedor" del README para crear uno nuevo a partir de esta carpeta.',
    );
  }
}
