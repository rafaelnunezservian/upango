export {
  normalizarTexto,
  quitarCaracteresDeControl,
  tieneValor,
  truncarConElipsis,
} from "./normalizacion.js";
export { LIMITES, RANGOS_COORDENADAS } from "./limites.js";
export { VALOR_TIPO_RESOLADO, esCarritoResolado } from "./carrito.js";
export { TITULO_TARIFA_RECOGIDA, esTarifaRecogida, formatearTituloRecogida } from "./tarifa.js";
export {
  CLAVE_TIPO_CARRITO,
  CLAVES_ATRIBUTO,
  CLAVES_ATRIBUTO_PUNTO,
  atributosDeSeleccion,
  atributosVaciosSeleccion,
  leerSeleccionDeAtributos,
} from "./atributos.js";
export type {
  AtributosCarrito,
  ClaveAtributo,
  ClaveAtributoPunto,
  SeleccionPunto,
} from "./atributos.js";
export type {
  CodigoErrorProxy,
  ErrorProxyDto,
  PuntoRecogidaDto,
  RespuestaPuntosDto,
} from "./dto.js";
