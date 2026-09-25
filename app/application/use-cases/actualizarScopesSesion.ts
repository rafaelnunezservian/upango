import type { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

/**
 * Atiende `app/scopes_update` (FR-066): guarda en la sesión el scope
 * vigente que llega en el payload del webhook.
 */
export async function actualizarScopesSesion(
  session: Session,
  scopesActuales: readonly string[],
  sessionStorage: SessionStorage,
): Promise<void> {
  session.scope = scopesActuales.join(",");
  await sessionStorage.storeSession(session);
}
