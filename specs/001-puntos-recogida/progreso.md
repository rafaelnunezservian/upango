# Progreso: 001-puntos-recogida

Bitácora de handoff entre sesiones de Claude Code en la nube. Cada sesión la lee al empezar y la actualiza
al cerrar. Las tareas viven en [`tasks.md`](./tasks.md); el diseño, en [`spec.md`](./spec.md).

## Estado actual

- **Última fase completada**: Phase 4 — US-2 cliente de carrito (T058–T072).
- **Siguiente sesión**: Phase 4 — US-2 embed + Phase 9 — US-7 (T073–T077, T124–T126).

## Plan de sesiones

| # | Fase de `tasks.md` | Tareas | Estado |
|---|---|---|---|
| 1 | Paso 0: hook de sesión + verificación de Foundational | — | ✅ |
| 2 | Phase 3 — US-1 | T038–T045 | ✅ |
| 3 | Phase 4 — US-2 backend | T046–T057 | ✅ |
| 4 | Phase 4 — US-2 cliente de carrito | T058–T072 | ✅ |
| 5 | Phase 4 — US-2 embed + Phase 9 — US-7 | T073–T077, T124–T126 | ⏳ (siguiente) |
| 6 | Phase 5 — US-3 Functions | T078–T091 | ⏳ |
| 7 | Phase 6 — US-4 | T092–T095 | ⏳ |
| 8 | Phase 7 — US-5 | T096–T109 | ⏳ |
| 9 | Phase 8 — US-6 | T110–T122 | ⏳ |
| 10 | Phase 10 — Docs y calidad | T127–T130, T134, T135 | ⏳ |
| 11 | Cierre: `/speckit-analyze` + `/speckit-converge` | — | ⏳ |

## Cómo trabaja cada sesión

1. Arranque: "Lee `specs/001-puntos-recogida/progreso.md` y ejecuta `/speckit-implement` solo para la
   sesión N".
2. El hook `.claude/hooks/session-start.sh` ya dejó Node 24, dependencias e identidad git.
3. Cierre (Definition of Done): `npm test`, `npm run typecheck` y `npm run lint` en verde → tareas
   marcadas `[x]` en `tasks.md` → esta bitácora actualizada → commit y push de la rama de la sesión.
   El PR lo abre el dueño del repo (squash merge).

## Qué no se puede hacer en la nube

La sesión cloud no tiene cuentas de Shopify Partners, dev store ni Google Cloud. Por eso los generadores
`shopify app generate` se reemplazan escribiendo a mano los archivos que generaría el template, y todo lo
que necesita plataforma queda en la lista de abajo.

## Pendiente de validar en plataforma (fase de testing)

- T001–T004: cuentas, dev store, proyecto GCP, herramientas locales.
- Checkpoint de Foundational: `shopify app dev` instala la app en la dev store.
- Checkpoint de US-1: `shopify app deploy` despliega la definición del metaobjeto `$app:punto_recogida`
  y el CRUD nativo del admin valida los 6 campos (T040/T041 no se pudieron probar contra una tienda real
  en la sesión cloud).

## Decisiones y notas por sesión

### Sesión 1 — Paso 0

- Node 24 se instala desde nodejs.org en `~/.node24` porque el contenedor trae Node 22 y `.npmrc` tiene
  `engine-strict=true`.
- Verificado: 49 tests OK (6 omitidos: contract tests de Firestore sin emulador), `typecheck` y `lint`
  sin errores.

### Sesión 2 — Phase 3 (US-1)

- `PuntoRecogida` (`app/domain/puntoRecogida.ts`) valida campos obligatorios, límites de longitud, regex
  del identificador y rango de coordenadas del CT-01; lanza `PuntoInvalidoError` con motivo (FR-014). Vive
  junto a la entidad porque `app/domain/errores.ts` (con `PuntosNoDisponiblesError`) recién se crea en la
  Fase 4 (T054) — se puede centralizar ahí en esa sesión si conviene.
- El bloque `[metaobjects.app.punto_recogida]` (CT-01, 6 campos) se agregó igual en `shopify.app.toml` y
  `shopify.app.dev.toml`; ambos se validaron con `tomllib` (sintaxis TOML correcta), pero no se pudo
  ejecutar `shopify app deploy`/`shopify app dev` contra una tienda real desde la sesión cloud (sin
  Partners/dev store) — queda pendiente de plataforma.
- `EscritorPuntosShopify` (T042) usa la misma mutación `metaobjectUpsert(handle, values: JSON!)` que ya
  usa el demo del template en `app._index.tsx`, para no arriesgar un contrato GraphQL distinto sin poder
  validarlo contra el esquema real de la API 2026-07.
- Se agregó `contenedor.crearEscritorPuntos(admin)` (fábrica por request) porque el principio I exige que
  ninguna ruta instancie infraestructura directamente; no es una tarea numerada, pero la necesitaba T044.
- `CrearPuntosDeEjemplo` reintenta con backoff exponencial (base 500 ms, hasta 5 intentos) solo ante
  `GraphqlQueryError` con `extensions.code === "THROTTLED"`; cualquier otro error se propaga de inmediato.
  La idempotencia es por handle determinista (`ejemplo-0001…`), no por un registro aparte.
- `app/routes/app._index.tsx` se tocó lo mínimo: se agregó el branch `intencion=sembrar` en el `action` y
  un botón condicionado a `semillaHabilitada` (del loader), sin tocar el demo de "Generate a product" del
  template — la página se rediseña por completo en la Fase 7 (US-5, T106–T107).
- Verificado: `npm test` (77 tests OK, 6 omitidos), `npm run typecheck` y `npm run lint` sin errores.

### Sesión 3 — Phase 4 (US-2 backend)

- `PuntoInvalidoError` se centralizó en `app/domain/errores.ts` (con la nueva `PuntosNoDisponiblesError`,
  T054), tal como preveía la nota de la sesión 2; `app/domain/puntoRecogida.ts` la re-exporta para no romper
  los imports existentes de sus tests.
- **División de responsabilidades TTL/single-flight (decisión de diseño, no está en el CT)**: el puerto
  `CachePuntos` (T047) es solo almacenamiento por tienda (`leer`/`guardar`/`borrar`); `CachePuntosMemoria`
  (T050) decide si una entrada sigue "fresca" (TTL) y deja de servirla del todo pasado
  `PUNTOS_CACHE_STALE_MAX_SEGUNDOS` (con LRU de 1000 tiendas). El *single-flight* de cargas concurrentes y el
  "a lo sumo un refresco en segundo plano por tienda" (SWR) viven en `ListarPuntosRecogida` (T052), porque
  solo el caso de uso conoce `FuentePuntos`; el puerto de caché no podía implementarlos por sí solo. Se eligió
  así en vez de mover TTL/SWR al `CachePuntos` para mantener el puerto mínimo y testeable sin `FuentePuntos`.
- `FuentePuntosShopify` (T048) reintenta con backoff exponencial (mismo patrón que `CrearPuntosDeEjemplo`)
  solo ante `THROTTLED`, y reduce el tamaño de página a la mitad (mínimo 1) ante `MAX_COST_EXCEEDED`,
  manteniendo el tamaño reducido para las páginas siguientes. El mapeo de `fields{key,value}` a
  `DatosPuntoRecogida` no valida nada: un campo ausente o `lat`/`lng` no numérico produce `NaN`/cadena vacía,
  que el dominio (`crearPuntoRecogida`) descarta igual que cualquier otro dato inválido (FR-014), sin lógica
  duplicada en el adaptador.
- `ListarPuntosRecogida.ejecutar(tienda, fuente)` recibe la `FuentePuntos` por llamada (atada al cliente
  Admin de esa petición) pero mantiene estado propio entre llamadas (`Map`/`Set` de cargas y refrescos en
  curso) para el single-flight; se registró como singleton en el contenedor porque ese estado debe
  compartirse entre peticiones concurrentes de la misma tienda.
- `procesarDesinstalacion` (FR-065) ahora también llama a `cachePuntos.borrar(shop)` — quedaba pendiente de
  la Fase 2 ("se conecta cuando exista `CachePuntos`"); se propagó la dependencia a
  `webhooks.app.uninstalled.tsx` y a `webhooks.compliance.tsx` (que reutiliza las mismas dependencias para
  `shop/redact`).
- `app/routes/proxy.puntos.tsx` no valida la firma HMAC ella misma: `authenticate.public.appProxy` ya lanza
  un `Response` 400 antes de llegar al loader si la firma falta o es inválida (verificado en el código fuente
  de `@shopify/shopify-app-react-router`), por eso el CT-03 solo necesita mapear 404/502/500 explícitamente.
- Verificado: `npm test` (99 tests OK, 6 omitidos), `npm run typecheck` y `npm run lint` sin errores. No se
  pudo probar contra una tienda real (sin Partners/dev store en la sesión cloud) — queda para la fase de
  testing junto con el resto de checkpoints pendientes de plataforma.

### Sesión 4 — Phase 4 (US-2 cliente de carrito)

- Nuevo workspace `@puntos-recogida/selector-carrito` (T058–T072): dominio puro (`estadoCarrito.ts`,
  `filtroPuntos.ts`, `revalidacion.ts`), aplicación (`ControladorSelector.ts` + `puertos.ts`) e
  infraestructura del navegador (`ClienteCarritoAjax`, `ClientePuntosProxy`, `VistaComboboxDom`,
  `GuardiaCheckoutDom`, `ObservadorCarritoDom`, `InsertadorWidgets`) y el composition root `main.ts`. El
  `build.mjs` (esbuild, IIFE/minify/es2019) genera `extensions/selector-punto/assets/selector-punto.js`
  (18.0 KB, dentro del límite de 20 KB del NFR-03); `extensions/selector-punto/` todavía no existe como
  extensión completa (bloques, locales, CSS) — se crea en la Fase 4 siguiente (T073–T077).
- `estadoCarrito.ts` amplió el estado `error_guardado` con `puntoElegido` (no estaba en el §17.3 literal)
  para que `ControladorSelector.reintentarGuardado()` pueda reintentar el mismo punto sin pedir al
  comprador que vuelva a elegirlo; es la única desviación del contrato de estados.
- "Cambiar" (§17.3) no es un estado nuevo: es un toggle local de `VistaComboboxDom` dentro de
  `con_seleccion` que reabre el combobox sin tocar la guardia ni el carrito — el checkout sigue habilitado
  mientras se busca, tal como pide la nota "sigue valiendo hasta que se elija otra".
- En contextos compactos (EC-24), `InsertadorWidgets` no registra el host en `VistaComboboxDom`: inserta
  directamente un `<a href="/cart">` cuyo `hidden` sincroniza con el estado (oculto en `inactivo`/
  `con_seleccion`). La guardia bloquea esos botones igual que a cualquier otro, por selector CSS.
- `GuardiaCheckoutDom` e `InsertadorWidgets` exponen `destruir()` (quitar listeners / desconectar el
  `MutationObserver`) solo por aislamiento entre tests; en la página real viven hasta que se descarga, como
  toda instancia única del composition root.
- Cobertura de dominio/aplicación con dobles de los 5 puertos (T071); tests con jsdom para inserción,
  bloqueo (disabled + captura de click/submit), ocultamiento de pago acelerado, ARIA básica del combobox y
  reinserción tras `MutationObserver` (T072). `packages/selector-carrito/src/infraestructura/**` no cuenta
  para el 90 % de T135 (solo dominio/aplicación), así que sus tests son de comportamiento, no de cobertura.
- Se amplió `eslint.config.js` (`packages/**/*.{js,ts,mjs}`) para que `build.mjs` tenga los globals de Node
  (`console`, `process`); es el primer `.mjs` del monorepo.
- Verificado: `npm test` (143 tests OK, 6 omitidos), `npm run typecheck`, `npm run lint` y
  `npm run build:embed` sin errores. No se pudo probar en un tema real de Dawn/Horizon (sin dev store en la
  sesión cloud) — queda para la fase de testing junto con el resto de checkpoints pendientes de plataforma.
