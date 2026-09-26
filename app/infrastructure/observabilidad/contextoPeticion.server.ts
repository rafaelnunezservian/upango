import { AsyncLocalStorage } from "node:async_hooks";

interface ContextoPeticion {
  readonly requestId?: string;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

const PATRON_TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i;

/**
 * Identificador de correlación de la petición (§22): el trace-id de
 * `traceparent` (W3C) o, si no viene, el de `x-cloud-trace-context`
 * (`TRACE_ID/SPAN_ID;o=1`, Cloud Run). `undefined` si no hay ninguno.
 */
export function extraerRequestId(headers: Headers): string | undefined {
  const traceparent = headers.get("traceparent")?.trim();
  const coincidencia = traceparent ? PATRON_TRACEPARENT.exec(traceparent) : null;
  if (coincidencia?.[1]) {
    return coincidencia[1].toLowerCase();
  }

  const cloudTrace = headers.get("x-cloud-trace-context")?.split("/")[0]?.trim();
  return cloudTrace ? cloudTrace : undefined;
}

/**
 * Ejecuta `fn` con el contexto de `request` disponible para el registro: todo
 * lo que se loguee dentro (incluidas las continuaciones asíncronas que
 * dispare, como el refresco en segundo plano de la caché) lleva `requestId`.
 */
export function conContextoPeticion<T>(request: Request, fn: () => T): T {
  const requestId = extraerRequestId(request.headers);
  return almacen.run(requestId ? { requestId } : {}, fn);
}

/** Datos de correlación de la petición en curso, para anexar a cada log. */
export function datosContextoPeticion(): Readonly<Record<string, string>> {
  const requestId = almacen.getStore()?.requestId;
  return requestId ? { requestId } : {};
}
