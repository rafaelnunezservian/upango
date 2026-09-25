import { beforeEach, describe, expect, it, vi } from "vitest";
import { ControladorSelector } from "./ControladorSelector.js";
import type { TextosControladorSelector } from "./ControladorSelector.js";
import type { ClienteCarrito, ClientePuntos, GuardiaCheckout, ObservadorCarrito, VistaSelector } from "./puertos.js";
import type { AtributosCarrito, PuntoRecogidaDto } from "@puntos-recogida/contratos";
import { atributosDeSeleccion, atributosVaciosSeleccion } from "@puntos-recogida/contratos";

const punto: PuntoRecogidaDto = {
  id: "PR-001",
  gid: "gid://shopify/Metaobject/1",
  nombre: "Kiosko Sol",
  direccion: "Puerta del Sol 1, Madrid",
  direccionCorta: "Pta. del Sol 1, Madrid",
  lat: 40.416775,
  lng: -3.70379,
};

const textos: TextosControladorSelector = {
  motivoBloqueo: "Elige un punto de recogida para continuar",
  errorCarga: "No se pudieron cargar los puntos",
  vacio: "No hay puntos de recogida disponibles",
  puntoNoDisponible: "El punto que elegiste ya no está disponible",
  errorGuardado: "No se pudo guardar el punto",
};

function crearDobles(atributosCarrito: AtributosCarrito, puntos: readonly PuntoRecogidaDto[]) {
  let atributos = { ...atributosCarrito };
  const escuchadores: Array<() => void> = [];

  const clienteCarrito: ClienteCarrito = {
    leer: vi.fn(async () => atributos),
    actualizarAtributos: vi.fn(async (nuevos) => {
      atributos = { ...atributos, ...nuevos };
    }),
  };
  const clientePuntos: ClientePuntos = {
    listar: vi.fn(async () => puntos),
  };
  const vista: VistaSelector = { mostrar: vi.fn() };
  const guardia: GuardiaCheckout = { bloquear: vi.fn(), desbloquear: vi.fn() };
  const observador: ObservadorCarrito = {
    alCambiar: (escuchador) => escuchadores.push(escuchador),
  };

  return {
    deps: { clienteCarrito, clientePuntos, vista, guardia, observador },
    clienteCarrito,
    clientePuntos,
    vista,
    guardia,
    escuchadores,
  };
}

describe("ControladorSelector", () => {
  let dobles: ReturnType<typeof crearDobles>;
  let controlador: ControladorSelector;

  beforeEach(() => {
    dobles = crearDobles({ tipo_carrito: "" }, [punto]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
  });

  it("en carrito normal muestra inactivo y no toca la guardia", async () => {
    await controlador.iniciar({ tipo_carrito: "normal" });
    expect(dobles.vista.mostrar).toHaveBeenCalledWith({ tipo: "inactivo" });
    expect(dobles.guardia.bloquear).not.toHaveBeenCalled();
    expect(dobles.guardia.desbloquear).not.toHaveBeenCalled();
  });

  it("en carrito normal con punto_* previos los limpia (FR-029)", async () => {
    dobles = crearDobles({ tipo_carrito: "normal", ...atributosDeSeleccion(punto) }, [punto]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "normal", ...atributosDeSeleccion(punto) });
    expect(dobles.clienteCarrito.actualizarAtributos).toHaveBeenCalledWith(atributosVaciosSeleccion());
  });

  it("en carrito resolado sin puntos pasa a vacio y bloquea", async () => {
    dobles = crearDobles({ tipo_carrito: "resolado" }, []);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado" });
    expect(dobles.vista.mostrar).toHaveBeenLastCalledWith({ tipo: "vacio" });
    expect(dobles.guardia.bloquear).toHaveBeenCalled();
  });

  it("en carrito resolado sin selección pasa a sin_seleccion y bloquea", async () => {
    dobles = crearDobles({ tipo_carrito: "resolado" }, [punto]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado" });
    expect(dobles.vista.mostrar).toHaveBeenLastCalledWith({ tipo: "sin_seleccion", puntos: [punto] });
    expect(dobles.guardia.bloquear).toHaveBeenCalledWith(textos.motivoBloqueo);
  });

  it("si falla la carga pasa a error y bloquea", async () => {
    dobles = crearDobles({ tipo_carrito: "resolado" }, [punto]);
    dobles.clientePuntos.listar = vi.fn(async () => {
      throw new Error("caído");
    });
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado" });
    expect(dobles.vista.mostrar).toHaveBeenLastCalledWith({ tipo: "error", mensaje: textos.errorCarga });
  });

  it("elegir un punto guarda los atributos y pasa a con_seleccion, desbloqueando", async () => {
    dobles = crearDobles({ tipo_carrito: "resolado" }, [punto]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado" });

    await controlador.elegir(punto);

    expect(dobles.clienteCarrito.actualizarAtributos).toHaveBeenCalledWith(atributosDeSeleccion(punto));
    expect(dobles.guardia.desbloquear).toHaveBeenCalled();
    const ultimaLlamada = (dobles.vista.mostrar as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(ultimaLlamada.tipo).toBe("con_seleccion");
    expect(ultimaLlamada.seleccion.puntoId).toBe(punto.id);
  });

  it("si falla el guardado pasa a error_guardado y mantiene el bloqueo", async () => {
    dobles = crearDobles({ tipo_carrito: "resolado" }, [punto]);
    dobles.clienteCarrito.actualizarAtributos = vi.fn(async () => {
      throw new Error("caído");
    });
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado" });

    await controlador.elegir(punto);

    const ultimaLlamada = (dobles.vista.mostrar as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(ultimaLlamada).toEqual({
      tipo: "error_guardado",
      puntos: [punto],
      puntoElegido: punto,
      mensaje: textos.errorGuardado,
    });
    expect(dobles.guardia.bloquear).toHaveBeenCalledWith(textos.motivoBloqueo);
  });

  it("reintentarGuardado reintenta con el mismo punto que falló", async () => {
    dobles = crearDobles({ tipo_carrito: "resolado" }, [punto]);
    const actualizar = vi
      .fn()
      .mockRejectedValueOnce(new Error("caído"))
      .mockResolvedValueOnce(undefined);
    dobles.clienteCarrito.actualizarAtributos = actualizar;
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado" });

    await controlador.elegir(punto);
    await controlador.reintentarGuardado();

    expect(actualizar).toHaveBeenCalledTimes(2);
    const ultimaLlamada = (dobles.vista.mostrar as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(ultimaLlamada.tipo).toBe("con_seleccion");
  });

  it("revalida una selección vigente al iniciar y desbloquea", async () => {
    dobles = crearDobles({ tipo_carrito: "resolado", ...atributosDeSeleccion(punto) }, [punto]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado", ...atributosDeSeleccion(punto) });

    const ultimaLlamada = (dobles.vista.mostrar as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(ultimaLlamada.tipo).toBe("con_seleccion");
    expect(dobles.guardia.desbloquear).toHaveBeenCalled();
  });

  it("revalida una selección de un punto inexistente: la borra y vuelve a sin_seleccion con aviso", async () => {
    const puntoBorrado = { ...punto, id: "PR-999" };
    dobles = crearDobles({ tipo_carrito: "resolado", ...atributosDeSeleccion(puntoBorrado) }, [punto]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado", ...atributosDeSeleccion(puntoBorrado) });

    expect(dobles.clienteCarrito.actualizarAtributos).toHaveBeenCalledWith(atributosVaciosSeleccion());
    const ultimaLlamada = (dobles.vista.mostrar as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(ultimaLlamada).toEqual({ tipo: "sin_seleccion", puntos: [punto], aviso: textos.puntoNoDisponible });
  });

  it("revalida una selección desactualizada: actualiza los atributos con los datos vigentes", async () => {
    const puntoNuevo = { ...punto, nombre: "Kiosko Sol (nuevo)" };
    dobles = crearDobles({ tipo_carrito: "resolado", ...atributosDeSeleccion(punto) }, [puntoNuevo]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "resolado", ...atributosDeSeleccion(punto) });

    expect(dobles.clienteCarrito.actualizarAtributos).toHaveBeenCalledWith(atributosDeSeleccion(puntoNuevo));
    const ultimaLlamada = (dobles.vista.mostrar as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(ultimaLlamada.seleccion.puntoNombre).toBe("Kiosko Sol (nuevo)");
  });

  it("un cambio del carrito notificado por el observador reevalúa el estado", async () => {
    dobles = crearDobles({ tipo_carrito: "normal" }, [punto]);
    controlador = new ControladorSelector({ ...dobles.deps, textos });
    await controlador.iniciar({ tipo_carrito: "normal" });

    dobles.clienteCarrito.leer = vi.fn(async () => ({ tipo_carrito: "resolado" }));
    expect(dobles.escuchadores.length).toBe(1);
    dobles.escuchadores[0]!();
    await vi.waitFor(() => {
      expect(dobles.vista.mostrar).toHaveBeenLastCalledWith({ tipo: "sin_seleccion", puntos: [punto] });
    });
  });
});
