import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { Configuracion } from "../../config/config.server.js";

/**
 * Elige el adaptador de `SessionStorage` según
 * `config.sessionStorageDriver` (OCP: agregar un almacenamiento nuevo es un
 * adaptador más y un valor más aquí, sin tocar el resto de la app).
 *
 * El adaptador de Firestore se importa de forma diferida (`import()`) para
 * no cargar `@google-cloud/firestore` (y su árbol de dependencias gRPC y
 * OpenTelemetry) cuando el driver activo es `memoria`, como en desarrollo
 * y en los tests.
 */
export async function crearSessionStorage(
  config: Configuracion,
): Promise<SessionStorage> {
  switch (config.sessionStorageDriver) {
    case "firestore": {
      const { FirestoreSessionStorage } = await import(
        "./firestoreSessionStorage.server.js"
      );
      return FirestoreSessionStorage.desdeConfiguracion({
        projectId: config.firestoreProjectId,
        databaseId: config.firestoreDatabaseId,
        coleccion: config.firestoreColeccionSesiones,
      });
    }
    case "memoria":
      return new MemorySessionStorage();
    default: {
      const driver: never = config.sessionStorageDriver;
      throw new Error(`SESSION_STORAGE_DRIVER desconocido: ${String(driver)}`);
    }
  }
}
