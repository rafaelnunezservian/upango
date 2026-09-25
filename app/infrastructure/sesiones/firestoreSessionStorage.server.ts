import { Firestore, Timestamp } from "@google-cloud/firestore";
import type { CollectionReference, DocumentData } from "@google-cloud/firestore";
import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

export interface OpcionesFirestoreSessionStorage {
  readonly projectId?: string | undefined;
  readonly databaseId?: string | undefined;
  readonly coleccion: string;
}

const CAMPOS_FECHA = ["expires", "refreshTokenExpires"] as const;

function serializarSesion(session: Session): DocumentData {
  const datos: Record<string, unknown> = { ...session.toObject() };
  for (const campo of CAMPOS_FECHA) {
    const valor = datos[campo];
    if (valor instanceof Date) {
      datos[campo] = Timestamp.fromDate(valor);
    }
  }
  for (const clave of Object.keys(datos)) {
    if (datos[clave] === undefined) {
      delete datos[clave];
    }
  }
  return datos;
}

function deserializarSesion(datos: DocumentData): Session {
  const params: Record<string, unknown> = { ...datos };
  for (const campo of CAMPOS_FECHA) {
    const valor = params[campo];
    if (valor instanceof Timestamp) {
      params[campo] = valor.toDate();
    }
  }
  return new Session(params as ConstructorParameters<typeof Session>[0]);
}

/**
 * `SessionStorage` sobre Firestore (modo nativo). Basado en el mismo patrón
 * que el adaptador oficial de MongoDB (DEC-09): Shopify no publica un
 * adaptador de Firestore, así que este es propio, con la base de datos y la
 * colección configurables por el CT-09.
 */
export class FirestoreSessionStorage implements SessionStorage {
  private readonly coleccion: CollectionReference;

  constructor(
    private readonly firestore: Firestore,
    opciones: OpcionesFirestoreSessionStorage,
  ) {
    this.coleccion = firestore.collection(opciones.coleccion);
  }

  static desdeConfiguracion(
    opciones: OpcionesFirestoreSessionStorage,
  ): FirestoreSessionStorage {
    const firestore = new Firestore({
      ...(opciones.projectId ? { projectId: opciones.projectId } : {}),
      ...(opciones.databaseId ? { databaseId: opciones.databaseId } : {}),
      ignoreUndefinedProperties: true,
    });
    return new FirestoreSessionStorage(firestore, opciones);
  }

  async storeSession(session: Session): Promise<boolean> {
    await this.coleccion.doc(session.id).set(serializarSesion(session));
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const snapshot = await this.coleccion.doc(id).get();
    if (!snapshot.exists) {
      return undefined;
    }
    return deserializarSesion(snapshot.data()!);
  }

  async deleteSession(id: string): Promise<boolean> {
    await this.coleccion.doc(id).delete();
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    if (ids.length === 0) {
      return true;
    }
    const lote = this.firestore.batch();
    for (const id of ids) {
      lote.delete(this.coleccion.doc(id));
    }
    await lote.commit();
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const snapshot = await this.coleccion.where("shop", "==", shop).get();
    return snapshot.docs.map((doc) => deserializarSesion(doc.data()));
  }
}
