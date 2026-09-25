import { describe, expect, it } from "vitest";
import { Session } from "@shopify/shopify-api";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
// `FirestoreSessionStorage` se importa de forma diferida más abajo, solo
// cuando hay un emulador disponible: evita cargar `@google-cloud/firestore`
// (y su árbol gRPC/OpenTelemetry) en el resto de los tests.

function crearSesion(overrides: Partial<ConstructorParameters<typeof Session>[0]> = {}): Session {
  return new Session({
    id: `offline_${crypto.randomUUID()}.myshopify.com`,
    shop: "contrato-test.myshopify.com",
    state: "estado",
    isOnline: false,
    accessToken: "token-offline",
    scope: "write_delivery_customizations,write_app_proxy",
    expires: new Date("2030-01-01T00:00:00.000Z"),
    ...overrides,
  });
}

/**
 * Suite de contract tests (LSP, constitución principio I): toda
 * implementación de `SessionStorage` DEBE comportarse igual. Se ejecuta
 * contra memoria siempre y contra Firestore cuando hay un emulador
 * disponible (`FIRESTORE_EMULATOR_HOST`).
 */
function ejecutarContratoSessionStorage(
  nombre: string,
  crearStorage: () => SessionStorage | Promise<SessionStorage>,
) {
  describe(`contrato SessionStorage: ${nombre}`, () => {
    it("guarda y carga una sesión", async () => {
      const storage = await crearStorage();
      const sesion = crearSesion();
      await expect(storage.storeSession(sesion)).resolves.toBe(true);

      const cargada = await storage.loadSession(sesion.id);
      expect(cargada?.id).toBe(sesion.id);
      expect(cargada?.shop).toBe(sesion.shop);
      expect(cargada?.accessToken).toBe(sesion.accessToken);
      expect(cargada?.expires).toBeInstanceOf(Date);
      expect(cargada?.expires?.toISOString()).toBe("2030-01-01T00:00:00.000Z");
    });

    it("devuelve undefined al cargar una sesión que no existe", async () => {
      const storage = await crearStorage();
      await expect(storage.loadSession("no-existe")).resolves.toBeUndefined();
    });

    it("actualiza una sesión existente al guardarla de nuevo (mismo id)", async () => {
      const storage = await crearStorage();
      const sesion = crearSesion();
      await storage.storeSession(sesion);

      sesion.accessToken = "token-actualizado";
      await storage.storeSession(sesion);

      const cargada = await storage.loadSession(sesion.id);
      expect(cargada?.accessToken).toBe("token-actualizado");
    });

    it("borra una sesión", async () => {
      const storage = await crearStorage();
      const sesion = crearSesion();
      await storage.storeSession(sesion);

      await expect(storage.deleteSession(sesion.id)).resolves.toBe(true);
      await expect(storage.loadSession(sesion.id)).resolves.toBeUndefined();
    });

    it("borra varias sesiones a la vez", async () => {
      const storage = await crearStorage();
      const a = crearSesion();
      const b = crearSesion();
      await storage.storeSession(a);
      await storage.storeSession(b);

      await expect(storage.deleteSessions([a.id, b.id])).resolves.toBe(true);
      await expect(storage.loadSession(a.id)).resolves.toBeUndefined();
      await expect(storage.loadSession(b.id)).resolves.toBeUndefined();
    });

    it("encuentra todas las sesiones de una tienda", async () => {
      const storage = await crearStorage();
      const tienda = `busqueda-${crypto.randomUUID()}.myshopify.com`;
      const offline = crearSesion({
        id: `offline_${tienda}`,
        shop: tienda,
        isOnline: false,
      });
      const online = crearSesion({
        id: `online_${tienda}`,
        shop: tienda,
        isOnline: true,
      });
      const otraTienda = crearSesion();

      await storage.storeSession(offline);
      await storage.storeSession(online);
      await storage.storeSession(otraTienda);

      const encontradas = await storage.findSessionsByShop(tienda);
      expect(encontradas.map((s) => s.id).sort()).toEqual(
        [offline.id, online.id].sort(),
      );
    });
  });
}

ejecutarContratoSessionStorage("memoria", () => new MemorySessionStorage());

const emuladorDisponible = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!emuladorDisponible)("Firestore (emulador)", () => {
  ejecutarContratoSessionStorage("firestore", async () => {
    const { FirestoreSessionStorage } = await import(
      "./firestoreSessionStorage.server.js"
    );
    return FirestoreSessionStorage.desdeConfiguracion({
      projectId: "puntos-recogida-test",
      databaseId: "(default)",
      coleccion: `shopify_sessions_test_${crypto.randomUUID()}`,
    });
  });
});
