import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loader } from "./healthz.js";

describe("GET /healthz", () => {
  it("responde 200 con estado ok y la versión del package.json", async () => {
    const respuesta = loader();
    expect(respuesta.status).toBe(200);

    const cuerpo = (await respuesta.json()) as { estado: string; version: string };
    const { version } = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
    ) as { version: string };

    expect(cuerpo).toEqual({ estado: "ok", version });
  });
});
