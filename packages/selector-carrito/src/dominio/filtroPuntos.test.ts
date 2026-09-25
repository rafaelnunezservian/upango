import { describe, expect, it } from "vitest";
import { construirIndice, filtrar } from "./filtroPuntos.js";
import type { PuntoRecogidaDto } from "@puntos-recogida/contratos";

function puntoDe(id: string, nombre: string, direccion: string): PuntoRecogidaDto {
  return { id, nombre, direccion, direccionCorta: direccion, gid: `gid://x/${id}`, lat: 0, lng: 0 };
}

const puntos: readonly PuntoRecogidaDto[] = [
  puntoDe("PR-001", "Kiosko Sol", "Puerta del Sol 1, Madrid"),
  puntoDe("PR-002", "Librería Gràcia", "Carrer Gran de Gràcia 10, Barcelona"),
  puntoDe("PR-003", "Panadería Ñoño", "Calle Ñandú 5, Sevilla"),
];

describe("filtrar", () => {
  it("sin consulta devuelve los primeros `limite` en orden original y el total real", () => {
    const indice = construirIndice(puntos);
    const resultado = filtrar(indice, "", 2);
    expect(resultado.total).toBe(3);
    expect(resultado.resultados.map((p) => p.id)).toEqual(["PR-001", "PR-002"]);
  });

  it("filtra sin distinguir mayúsculas ni tildes, por nombre", () => {
    const indice = construirIndice(puntos);
    const resultado = filtrar(indice, "GRACIA");
    expect(resultado.resultados.map((p) => p.id)).toEqual(["PR-002"]);
  });

  it("filtra sin distinguir tildes en la propia consulta (ñ)", () => {
    const indice = construirIndice(puntos);
    const resultado = filtrar(indice, "ñoño");
    expect(resultado.resultados.map((p) => p.id)).toEqual(["PR-003"]);
  });

  it("filtra por dirección y por identificador", () => {
    const indice = construirIndice(puntos);
    expect(filtrar(indice, "sevilla").resultados.map((p) => p.id)).toEqual(["PR-003"]);
    expect(filtrar(indice, "PR-002").resultados.map((p) => p.id)).toEqual(["PR-002"]);
  });

  it("respeta el límite de resultados y devuelve el total de coincidencias, no del límite", () => {
    const indice = construirIndice(puntos);
    const resultado = filtrar(indice, "a", 1);
    expect(resultado.resultados.length).toBe(1);
    expect(resultado.total).toBeGreaterThan(1);
  });

  it("sin coincidencias devuelve una lista vacía y total 0", () => {
    const indice = construirIndice(puntos);
    const resultado = filtrar(indice, "no existe esto");
    expect(resultado.resultados).toEqual([]);
    expect(resultado.total).toBe(0);
  });
});
