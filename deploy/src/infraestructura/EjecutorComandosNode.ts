import { spawn } from "node:child_process";
import type { Consola, EjecutorComandos } from "../puertos/index.js";

/**
 * Adaptador real de `EjecutorComandos`: `child_process.spawn` **sin shell**
 * (los argumentos nunca se concatenan en una línea de shell, así que no hace
 * falta escapar nada) y con `stdin` para pasar secretos sin que aparezcan
 * como argumento del proceso (FR-080).
 *
 * En `--dry-run` no ejecuta nada: solo le pide a la consola que imprima el
 * comando (enmascarando el stdin si había un secreto) y devuelve un
 * resultado simulado en código 0, para que el proveedor pueda seguir su
 * lógica normal (idempotencia, comparación de resultados, etc.) sin
 * ramificar por `simulacion` en cada paso.
 */
export class EjecutorComandosNode implements EjecutorComandos {
  constructor(
    private readonly opciones: { readonly simulacion: boolean; readonly consola: Consola },
  ) {}

  async ejecutar(
    programa: string,
    argumentos: readonly string[],
    opciones?: { readonly entrada?: string },
  ): Promise<{ readonly codigo: number; readonly salida: string; readonly error: string }> {
    this.opciones.consola.comando(programa, argumentos, {
      tieneEntradaSecreta: opciones?.entrada !== undefined,
    });

    if (this.opciones.simulacion) {
      return { codigo: 0, salida: "", error: "" };
    }

    return new Promise((resolve) => {
      const proceso = spawn(programa, argumentos, { shell: false });
      let salida = "";
      let error = "";
      let resuelto = false;

      proceso.stdout.on("data", (fragmento: Buffer) => {
        salida += fragmento.toString("utf8");
      });
      proceso.stderr.on("data", (fragmento: Buffer) => {
        error += fragmento.toString("utf8");
      });
      // No se rechaza la promesa: `EjecutorComandos` siempre resuelve con un
      // resultado (CT-10), incluso si `programa` no existe (ENOENT). Así
      // cada proveedor decide qué significa ese fallo (por ejemplo,
      // `ProveedorGcp.verificarPrerrequisitos` lo traduce a
      // `PrerrequisitoError`) sin tener que atrapar excepciones nativas.
      proceso.on("error", (causa) => {
        if (resuelto) return;
        resuelto = true;
        resolve({ codigo: 127, salida, error: causa.message });
      });
      proceso.on("close", (codigo) => {
        if (resuelto) return;
        resuelto = true;
        resolve({ codigo: codigo ?? 1, salida, error });
      });

      if (opciones?.entrada !== undefined) {
        proceso.stdin.write(opciones.entrada);
      }
      proceso.stdin.end();
    });
  }
}
