import { defineProject } from "vitest/config";

export default defineProject({
  root: import.meta.dirname,
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  test: {
    name: "punto-pedido",
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
  },
});
