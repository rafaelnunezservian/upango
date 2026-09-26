/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FunctionRunResult, RunInput } from "../generated/api.js";
import { run } from "./index.js";

interface Fixture {
  readonly input: RunInput;
  readonly output: FunctionRunResult;
}

/**
 * T143 (FR-091, §18.4): pasa cada fixture de `tests/fixtures/*.json` por el
 * `run` de TypeScript, sin wasm. El harness sobre el wasm compilado
 * (`shopify app function run`, T142) necesita una app vinculada a Partners.
 */
const directorioFixtures = new URL("../tests/fixtures/", import.meta.url);
const archivos = readdirSync(directorioFixtures)
  .filter((archivo) => archivo.endsWith(".json"))
  .sort();

describe("fixtures de la Function (FR-091)", () => {
  it("hay fixtures para recorrer", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos)("%s: run(input) === output", (archivo) => {
    const fixture = JSON.parse(
      readFileSync(new URL(archivo, directorioFixtures), "utf8"),
    ) as Fixture;

    expect(run(fixture.input)).toEqual(fixture.output);
  });
});
