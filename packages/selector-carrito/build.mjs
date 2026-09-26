import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { statSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// NFR-03: el bundle IIFE minificado del embed no puede superar 20 KB.
const LIMITE_BYTES = 20 * 1024;

const modoWatch = process.argv.includes("--watch");

const entryPoint = path.join(__dirname, "src/main.ts");
const outfile = path.join(
  __dirname,
  "../../extensions/selector-punto/assets/selector-punto.js",
);

/** Devuelve `true` si el bundle respeta el límite del NFR-03 (y lo informa). */
function controlarPeso() {
  const { size } = statSync(outfile);
  if (size > LIMITE_BYTES) {
    console.error(
      `El bundle de selector-carrito pesa ${size} bytes, supera el límite de ${LIMITE_BYTES} bytes (NFR-03).`,
    );
    return false;
  }
  console.log(`selector-punto.js: ${size} bytes (límite ${LIMITE_BYTES} bytes)`);
  return true;
}

const opciones = {
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  legalComments: "none",
  logLevel: "info",
};

if (modoWatch) {
  // §21.4: `npm run dev` recompila el embed en cada cambio; el control de
  // peso avisa en cada rebuild pero no corta el watch.
  const ctx = await context({
    ...opciones,
    plugins: [
      {
        name: "control-peso",
        setup(compilacion) {
          compilacion.onEnd((resultado) => {
            if (resultado.errors.length === 0) {
              controlarPeso();
            }
          });
        },
      },
    ],
  });
  await ctx.watch();
  console.log("selector-carrito: observando cambios (Ctrl+C para salir)");
} else {
  await build(opciones);
  if (!controlarPeso()) {
    process.exit(1);
  }
}
