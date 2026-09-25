import { describe, expect, it } from "vitest";
import type { Consola } from "../puertos/index.js";
import { EjecutorComandosNode } from "./EjecutorComandosNode.js";

function consolaEspia(): { readonly consola: Consola; readonly lineas: string[] } {
  const lineas: string[] = [];
  return {
    lineas,
    consola: {
      info: () => {},
      advertencia: () => {},
      error: () => {},
      comando: (programa, argumentos, opciones) => {
        lineas.push(
          `${programa} ${argumentos.join(" ")}${opciones?.tieneEntradaSecreta ? " < ***" : ""}`,
        );
      },
    },
  };
}

describe("EjecutorComandosNode", () => {
  it("en --dry-run no ejecuta nada y enmascara el stdin secreto", async () => {
    const { consola, lineas } = consolaEspia();
    const ejecutor = new EjecutorComandosNode({ simulacion: true, consola });

    const resultado = await ejecutor.ejecutar("gcloud", ["secrets", "versions", "add", "x", "--data-file=-"], {
      entrada: "secreto-de-verdad",
    });

    expect(resultado).toEqual({ codigo: 0, salida: "", error: "" });
    expect(lineas).toEqual(["gcloud secrets versions add x --data-file=- < ***"]);
  });

  it("ejecuta de verdad cuando no es simulación (sin shell) y captura stdout", async () => {
    const { consola } = consolaEspia();
    const ejecutor = new EjecutorComandosNode({ simulacion: false, consola });

    const resultado = await ejecutor.ejecutar(process.execPath, ["-e", "process.stdout.write('hola')"]);

    expect(resultado).toEqual({ codigo: 0, salida: "hola", error: "" });
  });

  it("pasa el secreto por stdin, nunca como argumento", async () => {
    const { consola } = consolaEspia();
    const ejecutor = new EjecutorComandosNode({ simulacion: false, consola });

    const resultado = await ejecutor.ejecutar(
      process.execPath,
      ["-e", "process.stdin.on('data', (d) => process.stdout.write('leido:' + d))"],
      { entrada: "shh" },
    );

    expect(resultado.salida).toBe("leido:shh");
  });

  it("resuelve con código distinto de 0 (no rechaza la promesa) si el programa no existe", async () => {
    const { consola } = consolaEspia();
    const ejecutor = new EjecutorComandosNode({ simulacion: false, consola });

    const resultado = await ejecutor.ejecutar("programa-que-no-existe-de-verdad", []);

    expect(resultado.codigo).not.toBe(0);
    expect(resultado.error).toContain("ENOENT");
  });
});
