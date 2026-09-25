// @ts-check
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

/**
 * FR-083 (Clean Architecture, constitución principio V): ningún SDK ni CLI de
 * un proveedor de nube se usa fuera de app/infrastructure/** ni
 * deploy/src/proveedores/**. Esta regla lo hace cumplir en tiempo de lint.
 */
const patronesSdkNube = [
  "@google-cloud/*",
  "@google-cloud/**",
  "firebase-admin",
  "firebase-admin/*",
  "googleapis",
  "google-auth-library",
  "@azure/*",
  "aws-sdk",
  "@aws-sdk/*",
];

const reglaSinSdkNube = {
  "no-restricted-imports": [
    "error",
    {
      patterns: patronesSdkNube.map((grupo) => ({
        group: [grupo],
        message:
          "Los SDK/CLI de proveedores de nube solo pueden usarse en app/infrastructure/** o deploy/src/proveedores/** (FR-083).",
      })),
    },
  ],
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/.react-router/**",
      "**/.cache/**",
      "**/.shopify/**",
      "**/coverage/**",
      "public/build/**",
      "extensions/*/assets/selector-punto.js",
      "extensions/*/generated/**",
      "**/*.graphql.d.ts",
    ],
  },
  ...compat.extends("eslint:recommended"),
  ...compat.config({
    overrides: [
      {
        files: ["**/*.{js,jsx,ts,tsx}"],
        plugins: ["react", "jsx-a11y"],
        extends: [
          "plugin:react/recommended",
          "plugin:react/jsx-runtime",
          "plugin:react-hooks/recommended",
          "plugin:jsx-a11y/recommended",
        ],
        settings: {
          react: { version: "detect" },
          formComponents: ["Form"],
          linkComponents: [
            { name: "Link", linkAttribute: "to" },
            { name: "NavLink", linkAttribute: "to" },
          ],
          "import/resolver": { typescript: {} },
        },
        rules: {
          "react/no-unknown-property": ["error", { ignore: ["variant"] }],
        },
      },
      {
        files: ["**/*.{ts,tsx}"],
        plugins: ["@typescript-eslint", "import"],
        parser: "@typescript-eslint/parser",
        settings: {
          "import/internal-regex": "^~/",
          "import/resolver": {
            node: { extensions: [".ts", ".tsx"] },
            typescript: { alwaysTryTypes: true },
          },
        },
        extends: [
          "plugin:@typescript-eslint/recommended",
          "plugin:import/recommended",
          "plugin:import/typescript",
        ],
      },
      {
        files: [
          "vite.config.{js,ts}",
          ".graphqlrc.{js,ts}",
          "eslint.config.js",
          "shopify.server.{js,ts}",
          "**/*.server.{js,ts}",
          "packages/**/*.{js,ts}",
          "deploy/**/*.{js,ts}",
          "extensions/**/*.{js,ts}",
        ],
        env: { node: true },
      },
    ],
    globals: { shopify: "readonly" },
  }),
  {
    rules: { ...reglaSinSdkNube },
  },
  {
    files: [
      "app/infrastructure/**/*.{ts,tsx}",
      "deploy/src/proveedores/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
