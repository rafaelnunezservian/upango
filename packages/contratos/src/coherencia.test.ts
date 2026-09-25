import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLAVES_ATRIBUTO } from "./atributos.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..", "..");
const CARPETA_EXTENSIONS = join(RAIZ_REPO, "extensions");

/**
 * Recorre `extensions/*` buscando input queries de las Delivery
 * Customization Functions. Todavía no existen (se crean en la Fase 5,
 * US-3): mientras no haya ninguna, no hay nada que verificar y el test
 * pasa. En cuanto aparezcan, cada `attribute(key: "...")` que usen se
 * valida contra `CLAVES_ATRIBUTO`, la fuente única de verdad.
 */
function listarArchivosGraphql(carpeta: string): string[] {
  if (!existsSync(carpeta)) {
    return [];
  }
  const resultado: string[] = [];
  for (const nombre of readdirSync(carpeta)) {
    if (nombre === "node_modules" || nombre === "generated") continue;
    const ruta = join(carpeta, nombre);
    const info = statSync(ruta);
    if (info.isDirectory()) {
      resultado.push(...listarArchivosGraphql(ruta));
    } else if (nombre.endsWith(".graphql")) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

function extraerClavesDeAtributo(contenidoGraphql: string): string[] {
  const patron = /attribute\(key:\s*"([^"]+)"\)/g;
  const claves: string[] = [];
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = patron.exec(contenidoGraphql)) !== null) {
    claves.push(coincidencia[1]!);
  }
  return claves;
}

describe("coherencia de claves de atributo con las Functions", () => {
  it("cada attribute(key: ...) de las input queries está en CLAVES_ATRIBUTO", () => {
    const archivos = listarArchivosGraphql(CARPETA_EXTENSIONS);
    const clavesConocidas = new Set<string>(CLAVES_ATRIBUTO);

    for (const archivo of archivos) {
      const contenido = readFileSync(archivo, "utf-8");
      const claves = extraerClavesDeAtributo(contenido);
      for (const clave of claves) {
        expect(
          clavesConocidas.has(clave),
          `${archivo} usa la clave "${clave}", que no está en CLAVES_ATRIBUTO`,
        ).toBe(true);
      }
    }
  });
});
