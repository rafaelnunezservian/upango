import { defineConfig } from "vitest/config";

// Reemplaza a vitest.workspace.ts (formato deprecado desde Vitest 3): cada
// entrada se agrega en cuanto la fase de tasks.md correspondiente crea ese
// workspace. "deploy" no es un glob (es un único workspace declarado en
// package.json), por eso se lista aparte en vez de con un patrón `*/`.
//
// Un vitest.config.ts propio en la raíz (en vez de depender del vite.config.ts
// de la app, que trae el plugin de React Router) evita que la ejecución de
// tests herede ese plugin y su configuración de servidor de desarrollo.
export default defineConfig({
  test: {
    projects: [
      "app/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "extensions/*/vitest.config.ts",
      "deploy/vitest.config.ts",
    ],
  },
});
