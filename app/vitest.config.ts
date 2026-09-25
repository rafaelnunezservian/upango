import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "app",
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", "build", ".react-router"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
