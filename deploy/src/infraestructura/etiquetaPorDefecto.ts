import { execFileSync } from "node:child_process";

/**
 * Valor por defecto de `--etiqueta`: `<fecha>-<hora>-<hash-corto-git>`
 * (CT-10, ejemplo: `"20260925-1530-a1b2c3d"`). Sin el hash si no hay
 * repositorio git disponible.
 */
export function etiquetaPorDefecto(fecha: Date = new Date()): string {
  const pad = (valor: number) => String(valor).padStart(2, "0");
  const marca =
    `${fecha.getFullYear()}${pad(fecha.getMonth() + 1)}${pad(fecha.getDate())}` +
    `-${pad(fecha.getHours())}${pad(fecha.getMinutes())}`;
  const hash = hashCortoGit();
  return hash ? `${marca}-${hash}` : marca;
}

function hashCortoGit(): string | undefined {
  try {
    return (
      execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString("utf8")
        .trim() || undefined
    );
  } catch {
    return undefined;
  }
}
