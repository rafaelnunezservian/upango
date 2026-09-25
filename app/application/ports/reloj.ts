/**
 * Puerto de reloj: los casos de uso nunca llaman a `new Date()`
 * directamente, para poder controlar el tiempo en los tests (TTL de la
 * caché, `generadoEn`, expiración de sesiones).
 */
export interface Reloj {
  ahora(): Date;
}
