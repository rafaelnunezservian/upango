import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { statSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// NFR-03: el bundle IIFE minificado del embed no puede superar 20 KB.
const LIMITE_BYTES = 20 * 1024;

const entryPoint = path.join(__dirname, "src/main.ts");
const outfile = path.join(
  __dirname,
  "../../extensions/selector-punto/assets/selector-punto.js",
);

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  legalComments: "none",
  logLevel: "info",
});

const { size } = statSync(outfile);
if (size > LIMITE_BYTES) {
  console.error(
    `El bundle de selector-carrito pesa ${size} bytes, supera el límite de ${LIMITE_BYTES} bytes (NFR-03).`,
  );
  process.exit(1);
}

console.log(`selector-punto.js: ${size} bytes (límite ${LIMITE_BYTES} bytes)`);
