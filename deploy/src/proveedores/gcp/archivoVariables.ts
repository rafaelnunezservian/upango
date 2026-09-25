import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Escribe `variables` como un YAML temporal (para `--env-vars-file`, porque
 * algunos valores como `SCOPES` contienen comas) y lo borra al terminar,
 * exista o no un error (§20.4).
 */
export async function conArchivoDeVariables<T>(
  variables: Readonly<Record<string, string>>,
  usar: (rutaArchivo: string) => Promise<T>,
): Promise<T> {
  const directorio = await mkdtemp(join(tmpdir(), "puntos-recogida-deploy-"));
  const ruta = join(directorio, "env-vars.yaml");
  try {
    const contenido =
      Object.entries(variables)
        .map(([clave, valor]) => `${clave}: ${JSON.stringify(valor)}`)
        .join("\n") + "\n";
    await writeFile(ruta, contenido, "utf8");
    return await usar(ruta);
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
}
