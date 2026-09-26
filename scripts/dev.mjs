import { spawn } from "node:child_process";

/**
 * `npm run dev` (§21.2, §21.4): el watch del bundle del embed en paralelo con
 * `shopify app dev --config dev`. Sin dependencias extra para que funcione
 * igual en PowerShell y en bash; al terminar uno se detiene el otro.
 */
const procesos = [
  spawn("node packages/selector-carrito/build.mjs --watch", { stdio: "inherit", shell: true }),
  spawn("shopify app dev --config dev", { stdio: "inherit", shell: true }),
];

let terminando = false;

function detenerTodos(codigo) {
  if (terminando) {
    return;
  }
  terminando = true;
  for (const proceso of procesos) {
    if (proceso.exitCode === null) {
      proceso.kill();
    }
  }
  process.exitCode = codigo ?? 0;
}

for (const proceso of procesos) {
  proceso.on("exit", (codigo) => detenerTodos(codigo));
}
process.on("SIGINT", () => detenerTodos(130));
process.on("SIGTERM", () => detenerTodos(143));
