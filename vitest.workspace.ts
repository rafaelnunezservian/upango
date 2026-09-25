import { defineWorkspace } from "vitest/config";

// Cada entrada se agrega en cuanto la fase de tasks.md correspondiente crea
// ese workspace. "deploy" no es un glob (es un único workspace declarado en
// package.json), por eso se lista aparte en vez de con un patrón `*/`.
export default defineWorkspace([
  "app/vitest.config.ts",
  "packages/*/vitest.config.ts",
  "extensions/*/vitest.config.ts",
  "deploy/vitest.config.ts",
]);
