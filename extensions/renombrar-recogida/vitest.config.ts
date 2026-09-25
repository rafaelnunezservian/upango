import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "renombrar-recogida",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
