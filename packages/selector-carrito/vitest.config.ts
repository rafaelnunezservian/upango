import { defineProject } from "vitest/config";

export default defineProject({
  root: import.meta.dirname,
  test: {
    name: "selector-carrito",
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
