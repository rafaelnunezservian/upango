/**
 * Límites de longitud de los campos del metaobjeto `$app:punto_recogida`
 * (CT-01). DEBEN coincidir con las validaciones declaradas en
 * `shopify.app.toml` y `shopify.app.dev.toml`.
 */
export const LIMITES = Object.freeze({
  identificador: 40,
  nombre: 100,
  direccion: 255,
  direccionCorta: 60,
});

/** Rangos válidos de coordenadas geográficas (CT-01). */
export const RANGOS_COORDENADAS = Object.freeze({
  lat: { min: -90, max: 90 },
  lng: { min: -180, max: 180 },
});
