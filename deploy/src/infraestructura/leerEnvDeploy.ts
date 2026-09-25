import { existsSync, readFileSync } from "node:fs";

/**
 * Parser mínimo de `.env.deploy` (FR-079): pares `CLAVE=valor`, comentarios
 * con `#` y líneas en blanco se ignoran. Devuelve `{}` si el archivo no
 * existe (el operador puede usar solo variables de entorno reales).
 */
export function leerEnvDeploy(ruta: string): Readonly<Record<string, string>> {
  if (!existsSync(ruta)) return {};

  const variables: Record<string, string> = {};
  for (const lineaCruda of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const linea = lineaCruda.trim();
    if (!linea || linea.startsWith("#")) continue;

    const indiceIgual = linea.indexOf("=");
    if (indiceIgual === -1) continue;

    const clave = linea.slice(0, indiceIgual).trim();
    let valor = linea.slice(indiceIgual + 1).trim();
    const envueltoEnComillas =
      (valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"));
    if (envueltoEnComillas) {
      valor = valor.slice(1, -1);
    }
    variables[clave] = valor;
  }
  return variables;
}
