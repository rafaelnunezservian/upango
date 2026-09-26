import { defineConfig } from "vitest/config";

/**
 * Scopes de dominio/aplicación con cobertura mínima de líneas del 90 %
 * (FR-092, §24.1). Vitest trata `coverage` como opción global: no se admite en
 * los `defineProject` de cada workspace, por eso los umbrales viven aquí, uno
 * por glob, y `npm run test:coverage` falla si cualquiera queda por debajo.
 */
const scopesCobertura = [
  "app/domain/**",
  "app/application/**",
  "packages/contratos/src/**",
  "packages/selector-carrito/src/dominio/**",
  "packages/selector-carrito/src/aplicacion/**",
  "extensions/*/src/dominio/**",
  "deploy/src/dominio/**",
  "deploy/src/aplicacion/**",
];

const UMBRAL_LINEAS = 90;

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
    coverage: {
      provider: "v8",
      // Incluir los scopes (y no solo lo que los tests importan) hace que un
      // archivo sin tests cuente como 0 % en vez de quedar fuera del cálculo.
      include: scopesCobertura.map((scope) => `${scope}/*.{ts,tsx}`),
      exclude: ["**/*.test.{ts,tsx}"],
      thresholds: Object.fromEntries(
        scopesCobertura.map((scope) => [scope, { lines: UMBRAL_LINEAS }]),
      ),
    },
  },
});
