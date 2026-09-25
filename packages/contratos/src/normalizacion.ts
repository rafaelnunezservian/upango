/**
 * Tabla explícita de reemplazo de caracteres acentuados. No se usa
 * `String.prototype.normalize` porque QuickJS (el motor que ejecuta las
 * Functions compiladas con Javy) no lo implementa de forma confiable: la
 * tabla explícita se comporta igual en el navegador, en Node y en wasm.
 */
const TABLA_REEMPLAZO: ReadonlyMap<string, string> = new Map([
  ["á", "a"],
  ["à", "a"],
  ["ä", "a"],
  ["â", "a"],
  ["ã", "a"],
  ["é", "e"],
  ["è", "e"],
  ["ë", "e"],
  ["ê", "e"],
  ["í", "i"],
  ["ì", "i"],
  ["ï", "i"],
  ["î", "i"],
  ["ó", "o"],
  ["ò", "o"],
  ["ö", "o"],
  ["ô", "o"],
  ["õ", "o"],
  ["ú", "u"],
  ["ù", "u"],
  ["ü", "u"],
  ["û", "u"],
  ["ñ", "n"],
  ["ç", "c"],
]);

/** Colapsa cualquier secuencia de espacios en blanco en un único espacio. */
function colapsarEspacios(texto: string): string {
  return texto.replace(/\s+/g, " ");
}

function reemplazarAcentos(texto: string): string {
  let resultado = "";
  for (const caracter of texto) {
    resultado += TABLA_REEMPLAZO.get(caracter) ?? caracter;
  }
  return resultado;
}

/**
 * Recorta, colapsa espacios, pasa a minúsculas y quita tildes/diéresis con
 * una tabla explícita. Es la base de todas las comparaciones insensibles a
 * mayúsculas y acentos del proyecto (búsqueda del selector, `esCarritoResolado`,
 * `esTarifaRecogida`).
 */
export function normalizarTexto(texto: string | null | undefined): string {
  if (texto === null || texto === undefined) {
    return "";
  }
  const recortado = colapsarEspacios(texto.trim());
  return reemplazarAcentos(recortado.toLowerCase());
}

/** Quita los caracteres de control (excepto espacio) de un texto. */
export function quitarCaracteresDeControl(texto: string): string {
  // eslint-disable-next-line no-control-regex
  return texto.replace(/[\u0000-\u001F\u007F]/g, "");
}

/** `true` si el valor, recortado, no está vacío. */
export function tieneValor(valor: string | null | undefined): boolean {
  return typeof valor === "string" && valor.trim().length > 0;
}

/**
 * Recorta los extremos, quita caracteres de control, colapsa espacios y
 * trunca a `limite` caracteres agregando "…" si el texto es más largo.
 */
export function truncarConElipsis(texto: string, limite: number): string {
  const limpio = colapsarEspacios(quitarCaracteresDeControl(texto).trim());
  if (limpio.length <= limite) {
    return limpio;
  }
  return `${limpio.slice(0, Math.max(0, limite - 1))}…`;
}
