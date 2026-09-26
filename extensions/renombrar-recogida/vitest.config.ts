import { defineProject } from "vitest/config";

export default defineProject({
  root: import.meta.dirname,
  test: {
    name: "renombrar-recogida",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
