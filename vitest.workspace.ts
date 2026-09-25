import { defineWorkspace } from "vitest/config";

// Cada entrada se agrega en cuanto la fase de tasks.md correspondiente crea
// ese workspace (packages/*, extensions/* y deploy/ todavía no existen por
// completo). Usar rutas explícitas en lugar de un glob amplio evita que un
// paquete sin vitest.config.ts entre por accidente al workspace.
export default defineWorkspace([
  "app/vitest.config.ts",
  "packages/*/vitest.config.ts",
  "extensions/*/vitest.config.ts",
]);
