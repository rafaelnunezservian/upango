import { afterEach, describe, expect, it, vi } from "vitest";
import {
  conContextoPeticion,
  datosContextoPeticion,
  extraerRequestId,
} from "./contextoPeticion.server.js";
import { RegistroJson } from "./registroJson.server.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

describe("extraerRequestId (§22)", () => {
  it("toma el trace-id de traceparent (W3C)", () => {
    const headers = new Headers({ traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01` });
    expect(extraerRequestId(headers)).toBe(TRACE_ID);
  });

  it("sin traceparent válido, usa el trace de x-cloud-trace-context", () => {
    const headers = new Headers({
      traceparent: "basura",
      "x-cloud-trace-context": "105445aa7843bc8bf206b12000100000/1;o=1",
    });
    expect(extraerRequestId(headers)).toBe("105445aa7843bc8bf206b12000100000");
  });

  it("sin cabeceras de traza no hay requestId", () => {
    expect(extraerRequestId(new Headers())).toBeUndefined();
  });
});

describe("conContextoPeticion + RegistroJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("anexa el requestId de la petición a cada línea de log, incluso tras un await", async () => {
    const lineas: string[] = [];
    vi.spyOn(console, "log").mockImplementation((linea: string) => {
      lineas.push(linea);
    });
    const registro = new RegistroJson("info", datosContextoPeticion);
    const request = new Request("https://example.com/proxy/puntos", {
      headers: { traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01` },
    });

    await conContextoPeticion(request, async () => {
      await Promise.resolve();
      registro.info("proxy.puntos.respuesta", { total: 3 });
    });
    registro.info("fuera.de.peticion");

    expect(JSON.parse(lineas[0]!)).toMatchObject({
      severity: "INFO",
      evento: "proxy.puntos.respuesta",
      requestId: TRACE_ID,
      total: 3,
    });
    expect(JSON.parse(lineas[1]!)).not.toHaveProperty("requestId");
  });
});
