/** Valores válidos de `--paso` (§20.3, CT-10). `"todo"` es el valor por defecto. */
export const PASOS = [
  "verificar",
  "infraestructura",
  "secretos",
  "imagen",
  "servicio",
  "todo",
] as const;

export type Paso = (typeof PASOS)[number];

export function esPasoValido(valor: string): valor is Paso {
  return (PASOS as readonly string[]).includes(valor);
}
