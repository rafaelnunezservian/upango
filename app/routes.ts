import { flatRoutes } from "@react-router/fs-routes";

// Los tests viven junto a las rutas: sin este filtro, flatRoutes registra cada
// `*.test.ts(x)` como una ruta hija (p. ej. `/healthz/test`) y los empaqueta
// en el build del servidor.
export default flatRoutes({ ignoredRouteFiles: ["**/*.test.{ts,tsx}"] });
