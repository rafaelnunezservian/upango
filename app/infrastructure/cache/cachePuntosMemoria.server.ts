import type { RespuestaPuntosDto } from "@puntos-recogida/contratos";
import type { CachePuntos, EntradaCachePuntos } from "../../application/ports/cachePuntos.js";
import type { Reloj } from "../../application/ports/reloj.js";

interface RegistroCache {
  readonly respuesta: RespuestaPuntosDto;
  readonly guardadaEn: number;
}

const CAPACIDAD_POR_DEFECTO = 1000;

/**
 * Implementación en memoria de `CachePuntos` (FR-016): un `Map` por tienda
 * con tope LRU (`capacidadMaxima`, 1.000 tiendas por defecto). Una entrada
 * cuya edad supera `staleMaxSegundos` se trata como inexistente (y se
 * elimina en la próxima lectura): más allá de ese límite no es válida ni
 * como respaldo ante errores. Dentro de ese límite se marca `fresca` según
 * `ttlSegundos`. El TTL y el máximo de vejez no se comparten entre tiendas.
 */
export class CachePuntosMemoria implements CachePuntos {
  private readonly mapa = new Map<string, RegistroCache>();

  constructor(
    private readonly reloj: Reloj,
    private readonly ttlSegundos: number,
    private readonly staleMaxSegundos: number,
    private readonly capacidadMaxima: number = CAPACIDAD_POR_DEFECTO,
  ) {}

  leer(tienda: string): EntradaCachePuntos | undefined {
    const registro = this.mapa.get(tienda);
    if (!registro) {
      return undefined;
    }

    const edadSegundos = this.edadEnSegundos(registro.guardadaEn);
    if (edadSegundos > this.staleMaxSegundos) {
      this.mapa.delete(tienda);
      return undefined;
    }

    // Marca la entrada como recientemente usada (política LRU).
    this.mapa.delete(tienda);
    this.mapa.set(tienda, registro);

    return { respuesta: registro.respuesta, fresca: edadSegundos <= this.ttlSegundos };
  }

  guardar(tienda: string, respuesta: RespuestaPuntosDto): void {
    this.mapa.delete(tienda);
    this.mapa.set(tienda, { respuesta, guardadaEn: this.reloj.ahora().getTime() });

    if (this.mapa.size > this.capacidadMaxima) {
      const masAntigua = this.mapa.keys().next().value;
      if (masAntigua !== undefined) {
        this.mapa.delete(masAntigua);
      }
    }
  }

  borrar(tienda: string): void {
    this.mapa.delete(tienda);
  }

  private edadEnSegundos(guardadaEn: number): number {
    return (this.reloj.ahora().getTime() - guardadaEn) / 1000;
  }
}
