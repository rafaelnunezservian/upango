# Progreso: 001-puntos-recogida

Bitácora de handoff entre sesiones de Claude Code en la nube. Cada sesión la lee al empezar y la actualiza
al cerrar. Las tareas viven en [`tasks.md`](./tasks.md); el diseño, en [`spec.md`](./spec.md).

## Estado actual

- **Última fase completada**: Phase 12 — Convergence (T143–T154; T142 pendiente de plataforma, ver sesión
  12).
- **Siguiente sesión**: 13 — volver a correr `/speckit-converge` para evaluar el código contra `spec.md`
  después de la Phase 12.

## Plan de sesiones

| # | Fase de `tasks.md` | Tareas | Estado |
|---|---|---|---|
| 1 | Paso 0: hook de sesión + verificación de Foundational | — | ✅ |
| 2 | Phase 3 — US-1 | T038–T045 | ✅ |
| 3 | Phase 4 — US-2 backend | T046–T057 | ✅ |
| 4 | Phase 4 — US-2 cliente de carrito | T058–T072 | ✅ |
| 5 | Phase 4 — US-2 embed + Phase 9 — US-7 | T073–T077, T124–T126 | ✅ |
| 6 | Phase 5 — US-3 Functions | T078–T091 | ✅ (T090 pendiente de plataforma) |
| 7 | Phase 6 — US-4 | T092–T095 | ✅ |
| 8 | Phase 7 — US-5 | T096–T109 | ✅ |
| 9 | Phase 8 — US-6 | T110–T122 | ✅ (T123 pendiente de plataforma) |
| 10 | Phase 10 — Docs y calidad | T127–T130, T134, T135 | ✅ (T131–T133, T136 fuera de alcance en la nube) |
| 11 | Cierre: `/speckit-converge` (el `/speckit-analyze` no se ejecutó) | — | ✅ (13 tareas nuevas, T142–T154) |
| 12 | Phase 12 — Convergence | T143–T154 | ✅ (T142 pendiente de plataforma) |
| 13 | `/speckit-converge` otra vez | — | ⏳ (siguiente) |

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
- Checkpoint de la extensión `selector-punto` (T073–T077, T124–T126): `shopify app dev`/`deploy` la
  registra como app embed activable en el editor de temas; falta probarla contra Dawn/Horizon reales (ver
  sesión 5) — bloqueo, combobox, modo demo y accesibilidad en el navegador.
- T090 (medir instrucciones de `ocultar-envios`/`renombrar-recogida` con `shopify app function run` sobre el
  fixture de peor caso, NFR-06): no se pudo completar en la sesión cloud. Ver sesión 6 para el diagnóstico
  exacto (`shopify app function schema` devuelve 403 sin una app vinculada a Partners) y qué falta para
  correrlo: T001 (Partners) y luego `npm run typegen`/`npm run build` en cada extensión. El README (§8) deja
  el conteo marcado como pendiente de medir en vez de inventarlo (sesión 10).
- T142 (fixtures de `ocultar-envios`/`renombrar-recogida` sobre el wasm compilado desde `npm test`, con el
  presupuesto del 50 % de instrucciones): mismo bloqueo que T090 — sin T001 (Partners) no hay
  `shopify app function schema`/`typegen`/`build`, así que no existe `dist/function.wasm` contra el que
  correr `shopify app function run`. Mientras tanto, T143 (sesión 12) ya valida los 11 fixtures sobre el
  `run` de TypeScript en `npm test`.
- Rutas públicas y `npm run dev` (sesión 12): falta probar en una tienda real `/auth/login` (formulario con
  Polaris web components cargados a mano, ver sesión 12), la landing `/` y que `npm run dev`
  (`scripts/dev.mjs`) levante `shopify app dev` con el watch del embed en PowerShell y bash (en la nube solo
  se probó el watch de esbuild, no `shopify app dev`).
- `Dockerfile` (sesión 12): el nuevo `CMD` en forma exec solo se validó por lectura. Además, al revisarlo
  apareció un riesgo previo, sin verificar por falta de Docker: la etapa `build` corre `npm run build` (que
  incluye `build:embed`) pero no copia `packages/selector-carrito` ni los `package.json` de los demás
  workspaces, así que `npm ci`/`npm run build` podrían fallar en un `docker build` real.
- T131 (checklist E2E manual del Anexo B, 25 casos), T132 (auditoría de accesibilidad WCAG 2.1 AA) y T133
  (Lighthouse con y sin la app): necesitan una development store real con Dawn/Horizon y un navegador,
  fuera del alcance de la sesión cloud (sesión 10). T136 (distribución en Partners Dashboard, FASE-10) es
  operativa y también queda fuera.
- Checkpoint de la extensión `punto-pedido` (T092–T095, ver sesión 7): `shopify app dev`/`deploy` la registra
  como bloque de app disponible en Configuración → Checkout → Personalizar → página de estado del pedido;
  falta confirmar en una tienda real que el comerciante puede agregarla y que el bloque "Punto de recogida"
  aparece con los 7 atributos reales de un pedido resolado (en la sesión cloud solo se pudo simular
  `shopify.attributes`/`shopify.i18n` con dobles de test).
- T123 (validar `GET /healthz` end-to-end tras un despliegue real en GCP): no se pudo completar en la sesión
  cloud (sin cuenta/proyecto de Google Cloud, ver sesión 9). Falta, con un proyecto GCP real: `npm run deploy
  -- --proveedor gcp` completo y luego `curl https://<url-del-servicio>/healthz` (o el paso equivalente del
  checklist E2E del Anexo B).
- CLI de despliegue (`deploy/`, sesión 9): se probó `--dry-run` de punta a punta contra el CLI real (arma
  todos los comandos `gcloud`, calcula la URL de Cloud Run, códigos de salida 0/1/2/4 verificados a mano),
  pero nunca contra un proyecto GCP real ni contra un `docker build` real (el contenedor de la sesión cloud
  no tiene el daemon de Docker corriendo — `docker info` falla con "no such file or directory" en
  `/var/run/docker.sock` — así que el `Dockerfile` solo se validó por lectura, no compilándolo). Falta, con
  Docker y un proyecto GCP reales: `docker build .` (confirmar el objetivo de ≤250 MB del NFR de la imagen,
  §20.2) y `npm run deploy -- --proveedor gcp` (sin `--dry-run`) de punta a punta en un proyecto vacío
  (Independent Test de la Phase 8).
- Página de admin (T096–T109, ver sesión 8): `GatewayPersonalizacionesShopify` usa `deliveryCustomizations`,
  `deliveryCustomizationCreate`/`Update` y `ConsultaConfiguracionTiendaShopify` usa
  `metaobjectDefinitionByType` sin poder validar los campos (`functionHandle`, `shopifyFunction.appKey`,
  `metaobjectsCount`, …) contra el esquema real 2026-07 (sin Partners en la sesión cloud, igual que las
  Functions de la sesión 6). Falta probar en una tienda real: que "Activar" crea/activa las 2
  personalizaciones de verdad, el deep link del paso "Puntos" (`shopify:admin/content/metaobjects/entries/
  {tipoResuelto}`) y el del app embed con `context=apps&activateAppId=...` (EC-21, EC-22, US-5.3 a US-5.6).

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

### Sesión 5 — Phase 4 (US-2 embed) + Phase 9 (US-7)

- `extensions/selector-punto/shopify.extension.toml` se escribió a mano (`name = "selector-punto"`,
  `type = "theme"`) porque `shopify app generate extension --template theme_app_extension` necesita una
  app vinculada a Partners (T001, sin acceso en la sesión cloud); el formato se confirmó clonando
  `Shopify/theme-extension-getting-started` como referencia y con la guía oficial de configuración de
  theme app extensions (no se pudo acceder a `shopify.dev` desde la sesión, bloqueado por el proxy de
  salida).
- `blocks/selector-punto.liquid` arma el JSON de `#pr-config` a mano (Liquid no tiene literales de
  objeto): cada valor pasa por `| json`, y `seleccion` es `null` o el objeto de 7 campos según
  `cart.attributes['punto_id']`. Se agregaron dos *fallbacks* con la clave `| t` no documentados
  literalmente en el CT-06 pero coherentes con FR-035 (locales en español): si el comerciante vacía
  `titulo` o `texto_ayuda` en el editor, se usa la traducción (`selector.titulo` / `selector.aviso_direccion`)
  en lugar de una cadena vacía.
- **`ajustes.textoAyuda` en el JSON vs. `textos.avisoDireccion` en `VistaComboboxDom`**: el CT-06 define
  `texto_ayuda` como ajuste editable por el comerciante y también lista `selector.aviso_direccion` como
  clave de locale; pero `VistaComboboxDom` (T066, sesión 4) ya usa `textos.avisoDireccion` (fijo, del
  locale) para el aviso bajo el título y no lee `ajustes.textoAyuda`. Se decidió NO tocar
  `VistaComboboxDom` (fuera del alcance T073–T077/T124–T126, con tests ya verdes de la sesión 4): el
  Liquid igual serializa `ajustes.textoAyuda` porque el contrato CT-06 lo exige, aunque hoy no lo consuma
  ningún JS. Pendiente para una sesión futura: decidir si `textoAyuda` reemplaza a `avisoDireccion` como
  fuente del aviso (hacerlo editable de verdad) o si son dos textos distintos a propósito.
- **Modo demo (T124–T126)**: el interruptor vive en un host DOM separado del `.pr-host` que controla
  `VistaComboboxDom` (que lo oculta por completo en `inactivo`), para que sea visible "aunque el carrito
  no sea resolado" (§17.6) sin pelear con esa lógica. `InsertadorWidgets.mostrar()` lo sincroniza con
  `estado.tipo !== "inactivo"` — que equivale exactamente a "carrito resolado", porque
  `ControladorSelector` solo produce `inactivo` cuando no lo es — así que no hace falta una lectura extra
  de `/cart.js`: el interruptor viaja gratis en el mismo flujo de estados del selector. Los atributos que
  se escriben (activar → `tipo_carrito=resolado`; desactivar → `tipo_carrito` y los 7 `punto_*` vacíos) se
  aislaron en `src/dominio/modoDemo.ts` (`atributosModoDemo`) para poder testearlos sin DOM y sumar a la
  cobertura de dominio (T135). El propio `ObservadorCarritoDom` (envoltorio de `fetch`, ya implementado en
  T068) detecta el `POST /cart/update.js` del interruptor y dispara la reevaluación normal del carrito, sin
  cableado adicional.
- El bundle de `packages/selector-carrito` quedó en 19 698 bytes tras sumar el interruptor de modo demo,
  a 782 bytes del límite de 20 KB (NFR-03, `build.mjs` corta el build si se supera). Queda poco margen:
  una sesión futura que agregue código a este paquete debe vigilar el tamaño del bundle de cerca.
- `extensions/selector-punto/assets/selector-punto.css` (T076): variables CSS con `currentColor`/`inherit`
  para heredar tipografía y color del tema, sin ningún selector fuera de `.pr-*` (sin reset global),
  objetivos táctiles de 44px en botones/input/opciones/interruptor y `:focus-visible` visible.
- `locales/es.default.json` y `es.default.schema.json` (T077): las claves `{total}`/`{n}`/`{nombre}` usan
  llaves simples a propósito (no `{{ }}` de Shopify), porque las interpola `interpolar()` en
  `VistaComboboxDom.ts` (T066) del lado del cliente, no el filtro `| t` de Liquid.
- Verificado: `npm test` (148 tests OK, 6 omitidos), `npm run typecheck`, `npm run lint` y
  `npm run build:embed` sin errores. No se pudo activar el embed ni probar el modo demo en una dev store
  real (sin Partners/dev store en la sesión cloud) — queda para la fase de testing junto con el resto de
  checkpoints pendientes de plataforma, agregado arriba.

### Sesión 6 — Phase 5 (US-3 Functions)

- **Decisión pendiente de la sesión 5 (`texto_ayuda` vs. `avisoDireccion`), resuelta antes de arrancar la
  fase**: `texto_ayuda` (CT-06) pasa a ser la fuente real del aviso bajo el título, editable por el
  comerciante. Motivo: el valor por defecto de `texto_ayuda` en el CT-06 es literalmente el texto del
  FR-030, y el propio Liquid ya usaba `selector.aviso_direccion | t` como *fallback* de `texto_ayuda`
  cuando el comerciante lo vacía — dos señales de que es el mismo texto, no dos textos distintos a
  propósito. Cambios: `VistaComboboxDom` (T066, `packages/selector-carrito`) recibe un tercer parámetro de
  constructor `textoAyuda: string` (mismo patrón que `titulo`) y ya no lee `textos.avisoDireccion`, que se
  quitó de `TextosSelector`; `main.ts` lo pasa desde `config.ajustes.textoAyuda`; el Liquid ya no serializa
  `textos.avisoDireccion` (queda solo en `ajustes.textoAyuda`, que ya lo incluía). `selector.aviso_direccion`
  sigue existiendo en los locales: ahora es *solo* el valor por defecto de `texto_ayuda` del lado de Liquid,
  no algo que lea el JS. CT-06 en `spec.md` (§ tras el JSON de ejemplo) documenta la relación. Tests nuevos
  en `VistaComboboxDom.test.ts` verifican que el texto mostrado es el `textoAyuda` inyectado, no uno fijo.
- **Functions escritas a mano (T078/T079)**: `shopify app generate extension --template
  delivery_customization` necesita una app vinculada a Partners (T001, sin acceso en la sesión cloud), igual
  que en sesiones anteriores. Se clonó `Shopify/function-examples` (repo público, solo lectura, no forma
  parte de este repo) como referencia de la forma real de `shopify.extension.toml`
  (`[[extensions]] type="function"` + `[[extensions.targeting]] target/input_query/export` +
  `[extensions.build] command/path`) y de `package.json` (`codegen` apuntando a `schema.graphql` →
  `generated/api.ts`, dependencia `@shopify/shopify_function`). Los ejemplos clonados son de la API vieja
  (`purchase.delivery-customization.run`, sin los tipos `deliveryOptionHide`/`deliveryOptionRename` del
  CT-04/CT-05 de este proyecto, que usan el target nuevo `cart.delivery-options.transform.run`), así que solo
  se reusó la *forma* de los archivos, no su contenido.
- **`export = "run"` + `export default run` en `src/index.ts`**: el paquete `@shopify/shopify_function`
  cambió de convención entre versiones — la 1.x (usada en los ejemplos clonados) llama a la función nombrada
  según el `export` del TOML; la 2.x (`~2.0.0`, la que exige el `shopify app function build` real, ver
  abajo) llama al *default export* del archivo (`import * as userFunction from "user-function"; run
  (userFunction?.default)`, visto en el código fuente de `@shopify/shopify_function@2.0.1` bajado con `npm
  pack`). Ambos adaptadores exportan `run` con nombre y por defecto para cubrir las dos convenciones sin
  costo real; si una sesión futura confirma cuál usa el CLI real para la API 2026-07, se puede simplificar.
- **`generated/api.ts` a mano**: reproduce la forma de la query de cada `.graphql` (con `Attribute { value:
  string | null }` para los `attribute(key: ...)`, que pueden ser `null`) y de las `operations` del §18.2
  (`deliveryOptionHide`/`deliveryOptionRename`, ambas en el `Operation` de las dos extensiones por
  realismo, aunque cada adaptador solo use una). No se creó `schema.graphql` (no hay forma honesta de
  reproducir a mano el schema real de la API de Functions, y un `schema.graphql` falso sería peor que no
  tenerlo) — el `codegen` de `package.json` ya apunta a `schema.graphql`, listo para cuando
  `shopify app function typegen` lo descargue de verdad.
- **Se intentó `shopify app function build` de verdad** (novedad frente a sesiones anteriores: no hacía
  falta una app vinculada para los pasos de compilación en sí). Primer intento sin `@shopify/shopify_function`
  en `package.json`: el CLI abortó pidiendo exactamente `"@shopify/shopify_function": "~2.0.0"` — se agregó
  esa dependencia (y el script `typegen`/`build`, y el bloque `codegen`) a ambos `package.json` con ese dato
  real. Con eso, `build` avanza hasta `graphql-codegen`, que falla porque no existe `schema.graphql`. Se
  probó `shopify app function schema` (subcomando dedicado a bajar el schema) y devuelve HTTP 403 del
  servicio de autorización de Shopify: confirma que hace falta una app vinculada a Partners (T001) para
  completar T090 (y para que `generated/api.ts` deje de ser manual). Una sesión con Partners solo necesita
  correr `npm run typegen` y `npm run build` en cada extensión (scripts ya listos) y luego
  `shopify app function run --input tests/fixtures/<caso>.json --export run` para T090.
- **Fixtures (T088/T089)**: siguen el formato `{ export, target, input, output }` del §18.4 (coincide con el
  harness real de fixtures de Shopify Functions, no es una convención inventada). 6 fixtures de
  `ocultar-envios` (una por fila del CT-04) + 1 de peor caso (10 grupos × 20 opciones, generado con un script
  de Node, todas las opciones ocultas: `resolado` sin punto); 3 de `renombrar-recogida` (2 filas explícitas
  del CT-05 + una combinación que no renombra nada) + 1 de peor caso (200 opciones renombradas). Los 11
  fixtures se verificaron programáticamente contra los adaptadores reales (`npx tsx` + import dinámico de
  `src/index.ts`, script descartado al cerrar la sesión) antes de darlos por buenos, ya que no se puede
  correr el harness real sobre el wasm sin T090.
- `packages/contratos/src/coherencia.test.ts` (T019, ya existía desde la Fase 2) recorre `extensions/**/*.graphql`
  buscando `attribute(key: "...")` y falla si alguna clave no está en `CLAVES_ATRIBUTO`: pasó sin cambios en
  cuanto existieron los `.graphql` de esta fase, confirmando que las claves usadas (`tipo_carrito`,
  `punto_id`, `punto_direccion_corta`) coinciden con el contrato compartido.
- Verificado: `npm test` (169 tests OK, 6 omitidos — suma los 11 tests de `ocultar-envios` y los 9 de
  `renombrar-recogida`), `npm run typecheck` y `npm run lint` sin errores. `npm run typecheck`/`test` por
  workspace (`--workspace=ocultar-envios`/`renombrar-recogida`) también en verde. No se pudo completar T090
  (medición real de instrucciones) ni generar el `schema.graphql`/`generated/api.ts` reales — pendiente de
  plataforma, agregado arriba.

### Sesión 7 — Phase 6 (US-4)

- **Extensión escrita a mano (T092), con más certeza que las anteriores**: `shopify app generate extension
  --template customer_account_ui_extension --flavor typescript-preact --name punto-pedido` necesita una app
  vinculada a Partners (T001), igual que en sesiones anteriores. A diferencia de esas, esta vez el formato de
  `shopify.extension.toml` y de `src/PuntoPedido.tsx` se verificó contra el **código fuente real** del paquete
  publicado `@shopify/ui-extensions@2026.7.4` (bajado con `npm pack` — `shopify.dev` y la API de búsqueda de
  código de GitHub no son alcanzables desde la sesión, pero `github.com`/`registry.npmjs.org` sí lo son) y
  contra las cadenas literales del `@shopify/cli@3.93.2` ya instalado en el repo (confirma `type =
  "ui_extension"` y las claves `target`/`module` de `[[extensions.targeting]]`). El propio `README.md` del
  paquete trae el ejemplo canónico Preact (`import '@shopify/ui-extensions/preact'; import {render} from
  'preact'; export default function extension() { render(<Extension/>, document.body); }`), que es la base de
  `PuntoPedido.tsx`.
- **`shopify.attributes` es una lista `{key, value}[]`, no un mapa**: la `OrderStatusApi` real
  (`api/order-status/order-status.ts` del paquete) expone `attributes: SubscribableSignalLike<Attribute[] |
  undefined>`, distinto del `AtributosCarrito` (`Record<string, string>`) que espera `leerSeleccionDeAtributos`
  (T018, pensado para la Ajax Cart API del embed). `PuntoPedido.tsx` agrega `comoMapaDeAtributos()` para
  convertir la lista a mapa antes de reusar la función de `@puntos-recogida/contratos` sin duplicar su lógica.
- **No hay `declare global { const shopify: Api }` posible para `customer-account`**: al tipar el global a
  mano (necesario porque `shopify app dev`/`typegen` lo generarían solos con una app vinculada, T001) apareció
  un choque real del paquete: el tipo `Api` del target (`@shopify/ui-extensions/customer-account.order-
  status.block.render`) importa `extension-targets.d.ts` → `StandardComponents.d.ts` → `../../checkout`, que
  sí declara de forma ambiental `declare global { const shopify: ShopifyGlobal }` (con solo `.extend()`/
  `.reload()`, del modelo viejo de targets dinámicos). Con `skipLibCheck` esa colisión no se reporta como
  redeclaración, pero el checker resuelve `shopify` al `ShopifyGlobal` de `checkout`, no al `Api` propio, y
  `shopify.attributes`/`shopify.i18n` dejan de tipar. Se evitó por completo declarando un global propio: en su
  lugar, `obtenerShopify()` castea `globalThis.shopify` a `Api` en cada llamada — el mismo patrón que usa el
  propio paquete en su hook `useApi()` (`preact/api.ts`: `(globalThis as any)?.shopify as
  ApiForRenderExtension<Target>`). Leerlo en cada render (no una vez a nivel de módulo) también es lo que
  permite a los tests reemplazar `globalThis.shopify` entre casos.
- **Coordenadas válidas del enlace a Google Maps**: `enlaceMapa()` reusa `RANGOS_COORDENADAS` de
  `@puntos-recogida/contratos` (las mismas del CT-01/dominio) en vez de inventar un rango propio, y primero
  filtra con `tieneValor()` — `Number("")` da `0`, una coordenada técnicamente "válida" que hubiera armado un
  enlace a `(0,0)` para un pedido sin `punto_lat`/`punto_lng`.
- `locales/es.default.json` (T094) usa `shopify.i18n.translate()` (la API real de i18n de customer account,
  no el `interpolar()` casero del embed) con placeholders de una sola llave (`{punto_id}`), igual que el
  ejemplo `translate("banner.title")` del propio paquete.
- Tests (T095) con Preact + jsdom, sin librerías nuevas: `render()` de `preact` sobre un `<div>` descartable
  por test y aserciones por `querySelector`/`textContent` sobre las etiquetas `s-*` reales (confirmadas contra
  los `.d.ts` de componentes del paquete: `s-section`, `s-text`, `s-paragraph`, `s-link`). El `translate` falso
  del test devuelve la clave (más las opciones serializadas) en vez de texto en español, para no acoplar los
  tests al contenido de `locales/es.default.json`.
- Nuevas dependencias: `@shopify/ui-extensions` (`~2026.7.4`), `preact` (`^10.24.3`) y `@preact/signals`
  (`^2.3.0`, peer dependency real del paquete — sin ella, `import "@shopify/ui-extensions/preact"` revienta en
  tiempo de ejecución con "Cannot find package '@preact/signals'"). `tsconfig.json` fija `jsx: "react-jsx"` +
  `jsxImportSource: "preact"` (a diferencia del `tsconfig.json` raíz, que es para React); `vitest.config.ts`
  fija lo mismo en `esbuild` para no depender de que Vite detecte el `tsconfig.json` del paquete.
- Verificado: `npm test` (175 tests OK, 6 omitidos — suma los 6 de `PuntoPedido.test.tsx`), `npm run
  typecheck` y `npm run lint` sin errores; `npm run typecheck`/`test --workspace=punto-pedido` también en
  verde. No se pudo previsualizar el bloque en una página de estado de pedido real (sin Partners/dev store en
  la sesión cloud) — queda para la fase de testing, agregado arriba.

### Sesión 8 — Phase 7 (US-5)

- **`GatewayPersonalizacionesShopify` escrito contra la letra del CT (§15.4), sin poder validarlo contra el
  esquema real**: igual que las Functions de la sesión 6, no hay Partners en la sesión cloud para correr
  `shopify app function schema` ni para probar mutaciones reales. `crear()` envía
  `deliveryCustomizationCreate(deliveryCustomization: { functionHandle, title, enabled: true })` porque así
  lo dice literalmente el §15.4/FR-057 del spec, aunque la Admin API pública documentada usa normalmente
  `functionId` (el GID de la Function, no su handle) en `DeliveryCustomizationInput`. Se prefirió seguir el
  contrato del proyecto en vez de adivinar el campo real; una sesión con Partners debe confirmarlo contra el
  esquema 2026-07 y corregir el nombre del campo si hace falta (y el test correspondiente en
  `gatewayPersonalizacionesShopify.server.test.ts`, que solo verifica lo que se envía, no lo que Shopify
  acepta).
- **`listarDeEstaApp()` filtra por `appKey` en el cliente, no en la query**: la Admin API no tiene un
  argumento para filtrar `deliveryCustomizations` por app, así que se pide la página completa (`first: 25`,
  el máximo de personalizaciones por tienda según EC-22) y se descartan las de otras apps comparando
  `shopifyFunction.appKey` con `SHOPIFY_API_KEY` del contenedor.
- **`ConsultaConfiguracionTiendaShopify.contarPuntos()` no reutiliza `ListarPuntosRecogida`**: aunque T101
  lista a T052 como dependencia, esa dependencia ya estaba satisfecha desde la sesión 3 (T052 es
  `ListarPuntosRecogida`, no algo que esta sesión debía tocar). Contar puntos con
  `metaobjectDefinitionByType { metaobjectsCount }` (§15.4) evita paginar todas las entradas solo para un
  número, que es justamente lo que `ListarPuntosRecogida` sí necesita hacer para servir la lista completa al
  selector del carrito.
- **`PERSONALIZACIONES_ENTREGA` (handles + títulos) vive en `activarPersonalizacionesEntrega.ts`** y
  `obtenerEstadoConfiguracion.ts` lo importa de ahí en vez de duplicar la lista: los títulos son literalmente
  el `name` de `extensions/ocultar-envios/shopify.extension.toml` y
  `extensions/renombrar-recogida/shopify.extension.toml` (sesión 6), para que la personalización creada se
  vea con el mismo nombre que ya usa el comerciante para identificar la Function en Configuración → Envío y
  entrega.
- **Enlace del paso "Puntos" sin definición de metaobjeto todavía**: si `metaobjectDefinitionByType` devuelve
  `null` (antes del primer `shopify app deploy` con el bloque CT-01), `enlaces.entradasPuntos` cae a
  `shopify:admin/content/metaobjects` (la lista general) en vez de construir una URL con un `tipoResuelto`
  vacío; no está en el CT literal, es la única forma razonable de no romper el deep link en ese estado.
- **`app._index.tsx` se rediseñó por completo** (como preveían las sesiones 2 y 7): se quitó todo el demo del
  template (`productCreate`/`productVariantsBulkUpdate`/metaobjeto `$app:example`, "Generate a product"); el
  `loader` llama a `ObtenerEstadoConfiguracion` envuelto en `try/catch` (si falla, banner crítico con
  "Reintentar" vía `useRevalidator`, sin relanzar el error como error boundary de la ruta, tal como pide
  "todo el estado sale de Shopify" del §16); la `action` distingue `intencion=activar` (nueva,
  `ActivarPersonalizacionesEntrega`) de `intencion=sembrar` (la de la sesión 2, sin cambios de comportamiento,
  solo reubicada).
- **Los 5 pasos son "Verificar manualmente" salvo Puntos y Personalizaciones**: Tarifa, App embed y Bloque de
  pedido no tienen forma de consultarse por GraphQL (una tarifa de envío manual no es una entidad con API
  propia consultable así, la activación de un app embed tampoco es legible desde la Admin API), así que su
  "estado" en el §16 es literalmente el texto fijo "Verificar manualmente" con instrucciones, no un valor real
  como en Puntos (conteo) o Personalizaciones (`activa`/`inactiva`/`inexistente` por delivery customization).
- Textos en `app/i18n/es.ts` (T108): objeto plano `as const` sin librería de i18n (no hay ninguna en el
  backend todavía, a diferencia de `shopify.i18n` de la extensión de customer account, sesión 7); dos claves
  son funciones (`pasos.puntos.estado(total)`, `datosDeEjemplo.exito(creados)`) para interpolar sin plantillas.
- Tests de `app._index.tsx` (T109) solo ejercitan `loader`/`action` (no el componente `Index`): el workspace
  `app` corre Vitest en `environment: "node"` (sin jsdom), igual que el resto de rutas del backend; se
  verifica que el `loader` devuelve `{ estado: null, error }` cuando el `admin.graphql` falla y que la
  `action` devuelve `{ activado: { errores } }` con los `userErrors` de Shopify cuando `crear()` los reporta,
  que es el dato que el componente usa para pintar los banners — renderizar el JSX y comprobar el HTML
  queda fuera del alcance de este workspace sin DOM.
- Bug propio detectado por los tests antes de cerrar la sesión: `obtenerEstadoConfiguracion` devolvía
  `ReferenceError: semillaHabilitada is not defined` por una propiedad abreviada (`{ semillaHabilitada }`) que
  no coincidía con el nombre del parámetro desestructurado (`habilitarSemilla`); corregido a
  `semillaHabilitada: habilitarSemilla`.
- Verificado: `npm test` (194 tests OK, 6 omitidos — suma los 19 nuevos: 5 de
  `gatewayPersonalizacionesShopify.server.test.ts`, 6 de `activarPersonalizacionesEntrega.test.ts`, 3 de
  `obtenerEstadoConfiguracion.test.ts` y 5 de `app._index.test.tsx`), `npm run typecheck` y `npm run lint`
  sin errores. No se pudo probar "Activar" ni los deep links contra una tienda real (sin Partners/dev store
  en la sesión cloud) — queda para la fase de testing, agregado arriba.

### Sesión 9 — Phase 8 (US-6)

- **`Dockerfile`/`.dockerignore` (T110/T111) ya existían desde el scaffold (sesión 1, commit `01fc05e`)** y,
  revisados contra el §20.2 literal, ya cumplían todo lo pedido (multi-stage `node:24-alpine`, `npm ci`
  limitado a la raíz + `packages/contratos/package.json`, `NODE_ENV=production` + deps de producción en la
  etapa final, `USER node`, `EXPOSE 8080`, sin Prisma, exclusiones correctas); no hizo falta tocarlos, solo
  marcarlos `[x]`. Igual que en sesiones anteriores con `deploy`, `npm ci` con `"workspaces":
  ["packages/*","extensions/*","deploy"]` en `package.json` no falla aunque el contexto de Docker no tenga
  copiados `packages/selector-carrito`, `extensions/*` ni `deploy/`: npm ignora en silencio los workspaces
  declarados que no existen en disco, no son un error.
- **`package.json` raíz ya traía los scripts `deploy`/`deploy:shopify` (T122) desde el scaffold**, apuntando
  a `tsx deploy/src/cli.ts` (que esta sesión recién crea) y a `shopify app deploy`; solo se verificaron, sin
  cambios.
- **`deploy/` como workspace real**: `package.json` raíz ya declaraba `"deploy"` en `workspaces` desde el
  scaffold (anticipando esta fase), pero el directorio no existía. Se agregó `deploy/package.json` (mismo
  patrón que `packages/contratos` y `packages/selector-carrito`: `type: module`, scripts `typecheck`/`test`),
  `deploy/tsconfig.json` (extiende `tsconfig.base.json`, `types: ["node"]`) y `deploy/vitest.config.ts`; se
  agregó `"deploy/vitest.config.ts"` a `vitest.workspace.ts` a mano porque `"deploy"` no es un glob (a
  diferencia de `packages/*`/`extensions/*`) — sin este paso `npm test` de la raíz no corría los tests de
  `deploy/`.
- **`deploy/src/dominio/` (esquema zod + errores + pasos) no es una tarea numerada**, igual que otras piezas
  de "pegamento" de sesiones anteriores (p. ej. `contenedor.crearEscritorPuntos` en la sesión 2): T112 solo
  pide los *puertos* (interfaces de CT-10), pero T115 (orquestador) necesita validar `deploy.config.json` y
  las 4 clases de error del §20.3 en algún lado, así que se crearon junto con T112 antes de tocar el
  orquestador.
- **`ConfigProveedor` (bloque `proveedores.<nombre>`) es opaco para el esquema neutral y para el
  orquestador a propósito**: `deploy/src/dominio/configDespliegue.ts` valida `proveedores` como
  `Record<string, Record<string, unknown>>` sin conocer los campos de `gcp`; cada proveedor valida su propio
  bloque (`deploy/src/proveedores/gcp/config.ts` con su propio esquema zod). Es lo que permite que "agregar
  un proveedor" (§20.7) no toque el esquema neutral ni el orquestador — la alternativa (un esquema único que
  conociera `gcp` con campos opcionales para futuros proveedores) hubiera violado el OCP que pide la
  constitución para esta pieza.
- **Comandos `gcloud` sin `--project=`**: el §20.4 literal no incluye esa flag en ningún comando de la tabla
  (asume que el operador ya corrió `gcloud config set project <id>` en el paso 1 del §20.5); `ProveedorGcp`
  reproduce los comandos tal como están en la tabla (mismo orden de flags, mismos nombres) para que los tests
  de "comandos exactos" (T118) verifiquen contra el contrato literal y no contra una flag inventada.
- **Dry-run e idempotencia, una decisión de diseño explícita**: en `--dry-run`, `EjecutorComandosNode` no
  ejecuta nada de verdad (ni siquiera los `describe` de solo lectura que deciden si hace falta crear un
  recurso), así que no hay forma honesta de saber si el repositorio/base/cuenta/secreto ya existen.
  `ProveedorGcp.existeOSimulado()` trata `ctx.simulacion === true` como "no existe siempre", para mostrar el
  comando de creación de más antes que ocultarlo: el escenario documentado en el README (§20.5, paso 4) es
  justamente el de un proyecto vacío donde `--dry-run` debe mostrar la secuencia completa. En un despliegue
  real posterior al primero, esto no aplica (`ctx.simulacion === false` usa el resultado real de `describe`).
- **`SHOPIFY_APP_URL` puede llegar vacía; las demás `variablesDesdeEntorno` no**: es la única variable de
  `deploy.config.json#variablesDesdeEntorno` que el operador no tiene por qué conocer antes del primer
  despliegue (§20.4, "el backend necesita `SHOPIFY_APP_URL` para arrancar… la CLI la calcula"). `cli.ts` deja
  pasar `""` solo para ese nombre; `ProveedorGcp.desplegarServicio()` la completa con la URL determinista de
  Cloud Run (`https://<servicio>-<número-de-proyecto>.<región>.run.app`) únicamente si sigue vacía en ese
  momento, y el orquestador decide llamar a `actualizarVariables` en el paso 7 comparando esa URL contra
  `resultado.url` real.
- **`--paso servicio` construye la imagen antes de desplegar**: `ProveedorDespliegue.desplegarServicio`
  exige un `ReferenciaImagen` como parámetro y el CT-10 no da otra forma de obtenerlo sin pasar por
  `construirImagen`; se decidió que el paso aislado `servicio` encadene `construirImagen` +
  `desplegarServicio` (nunca solo lectura de una imagen ya construida) para no inventar un método fuera del
  contrato. Cada etiqueta genera una imagen nueva (§20.4), así que repetir el build no es incorrecto, solo
  consume minutos de Cloud Build de más si se usa `--paso servicio` de forma aislada.
- **`EjecutorComandosNode` nunca rechaza la promesa**: el primer intento dejaba que el evento `"error"` de
  `child_process` (por ejemplo `ENOENT` si `gcloud` no está instalado) hiciera `reject()`, lo que rompía
  `verificarPrerrequisitos` con un error nativo sin envolver en `PrerrequisitoError` (código de salida 1 en
  vez de 2). Se corrigió para que ese caso resuelva con `{ codigo: 127, ... }` como cualquier otro fallo de
  proceso, cumpliendo el contrato de `EjecutorComandos` ("siempre resuelve") y dejando que cada proveedor
  interprete el código de salida. Verificado a mano invocando el CLI real sin `gcloud` instalado en la sesión
  cloud (ver más abajo).
- **`no-unused-vars` de ESLint no ignora el prefijo `_` en parámetros** (a diferencia del `noUnusedParameters`
  de `tsc`, que si lo ignora salvo en *parameter properties*): el esqueleto `ProveedorPlantilla` y el
  proveedor falso de `OrquestadorDespliegue.test.ts` se escribieron sin declarar los parámetros que no usan
  (TypeScript permite implementar un método de una interfaz con menos parámetros que la firma) en vez de
  prefijarlos con `_`, porque esto último seguía marcando error en `npm run lint` aunque `tsc --noEmit`
  pasara.
- **Probado a mano de punta a punta contra el CLI real** (sin proyecto GCP, ver el punto de "pendiente de
  plataforma" de arriba): `npm run deploy -- --proveedor gcp --dry-run` con variables de entorno de prueba
  imprime la secuencia completa de comandos `gcloud` sin ejecutarlos y termina en código 0; sin
  `--proveedor` → mensaje + código 1; `--proveedor azure` (no registrado) → código 4 citando la guía del
  README; sin el secreto `SHOPIFY_API_SECRET` en el entorno → código 1; `--paso no-existe` → código 1;
  `--paso verificar` sin `gcloud` instalado en el contenedor → código 2 (`PrerrequisitoError`).
- Verificado: `npm test` (232 tests OK, 6 omitidos — suma los 38 nuevos de `deploy/`: 15 de
  `OrquestadorDespliegue.test.ts`, 19 de `ProveedorGcp.test.ts`, 4 de `EjecutorComandosNode.test.ts`),
  `npm run typecheck` (raíz y `--workspace=deploy`) y `npm run lint` sin errores. No se pudo compilar el
  `Dockerfile` (sin daemon de Docker en la sesión cloud) ni desplegar contra un proyecto GCP real — T123 y el
  resto quedan en "Pendiente de validar en plataforma" arriba.

### Sesión 10 — Phase 10 (Docs y calidad)

- **`README.md` reescrito por completo** (T127–T130): las 23 secciones de §25, con comandos en bash y
  PowerShell donde difieren. La guía TS→wasm (§8 del README, §18.3 del spec) y el plan B en Rust están
  completos; el conteo real de instrucciones del fixture de peor caso queda marcado explícitamente como
  pendiente de medir (T090 sigue bloqueado por Partners, sesión 6) en vez de inventado. Despliegue en GCP
  (§14) y guía para agregar un proveedor con el ejemplo de Azure (§16) documentados a partir del §20.4/20.7
  literal del spec. Tabla de troubleshooting (§20 del README) con los 8 síntomas mínimos del §25 punto 20.
- **`npm audit` (T134) — 2 críticas resueltas, 15 altas + 1 moderada sin fix publicado**: el estado al
  empezar la sesión era 2 críticas y 23 altas (`vitest`/`@vitest/coverage-v8` 2.1.9 vulnerables a lectura
  arbitraria de archivos vía el servidor de UI y a *path traversal* vía `@vitest/mocker`; cadena de
  `@typescript-eslint/*` 6.21 con `minimatch` vulnerable a ReDoS; cadena de `@graphql-codegen/*` vía
  `@shopify/api-codegen-preset` 1.2.0 y `@shopify/shopify_function` con `lodash` vulnerable). Se subieron
  `vitest`/`@vitest/coverage-v8` a **4.1.11** en los 7 `package.json` del monorepo (root +
  `packages/contratos`, `packages/selector-carrito`, `deploy`, `extensions/ocultar-envios`,
  `extensions/punto-pedido`, `extensions/renombrar-recogida` — cada workspace fija su propia versión de
  `vitest`, no solo la raíz), `vite` a `^7.3.6` (peer de vitest 4) y `@typescript-eslint/eslint-plugin`/
  `@typescript-eslint/parser` a `^8.70.1`. Se probó primero `vitest@5.0.2` (la última en ese momento): sube
  igual de bien las críticas, pero se descartó porque el hallazgo de fondo (ver el punto siguiente) aparece
  igual en la 5.x y la 4.1.11 ya trae el parche de ambos CVE (rangos `<3.2.6` y `<4.1.11` respectivamente),
  así que se prefirió el salto de versión más chico. La cadena de `@graphql-codegen/*` (11 paquetes) +
  `lodash` no tiene fix disponible incluso con `@shopify/api-codegen-preset` en su última versión (3.0.0):
  llega también por `@shopify/shopify_function@~2.0.0` (fijado a esa versión exacta desde la sesión 6 porque
  es la que exige `shopify app function build` real), que trae su propia copia vieja de
  `@graphql-codegen/cli`. `npm audit` confirma `fixAvailable: false` en los paquetes de nivel más alto de esa
  cadena. Quedan documentadas en el README (§19) como devDependencies que nunca corren en producción (el
  `Dockerfile` no instala `devDependencies` en la etapa final) ni en `npm test`/`typecheck`/`lint`/`build`.
- **Hallazgo no numerado, encontrado al validar el bump de `vitest`**: subir de la rama 2.x a la 4.x/5.x
  rompió los tests de `packages/selector-carrito` y `extensions/punto-pedido` (`ReferenceError: document is
  not defined`, con archivos de test duplicados y ejecutados dos veces bajo el proyecto equivocado). Causa
  raíz: `vitest.workspace.ts` (formato de `defineWorkspace`, deprecado desde Vitest 3) no tenía un
  `vitest.config.ts` propio en la raíz, así que Vitest terminaba usando el `vite.config.ts` de la app (con
  el plugin de React Router) como base de **todos** los proyectos del workspace — de ahí que cada ejecución
  mostrara los *Future Flag Warning* de React Router incluso al testear `deploy/` o `packages/contratos`, y
  que el `environment: "jsdom"` de `selector-carrito`/`punto-pedido` se perdiera al mezclarse con el
  `environment: "node"` por defecto. Arreglado reemplazando `vitest.workspace.ts` por un `vitest.config.ts`
  en la raíz con `test.projects` (la sucesión soportada desde Vitest 3) y agregando `root:
  import.meta.dirname` a cada `vitest.config.ts` de workspace, para que cada proyecto quede anclado a su
  propio directorio sin depender de cómo Vitest resuelva el root del monorepo. No estaba en ningún tasks.md
  porque no es una tarea de esta fase: es una regresión de la propia migración de dependencias, necesaria
  para que T134 no dejara el `npm test` roto.
- **Cobertura (T135) — ya cumplía el umbral antes de tocar nada**: al medir con `npm run test:coverage`, los
  6 scopes de dominio/aplicación ya estaban en 100% salvo `app/application` (98.3%),
  `packages/selector-carrito/src/aplicacion` (95.2%) y `deploy/src/aplicacion` (90.0%, justo en el borde) —
  todos por encima del 90% exigido. El único hueco real de código sin ejercitar (no solo interfaces
  `*.ts` que se compilan a cero sentencias, como los `app/application/ports/*.ts`, que no cuentan ni suman
  ni restan) era `deploy/src/dominio/pasos.ts` (`esPasoValido`, 11 líneas, 0% cubierto): se agregó
  `deploy/src/dominio/pasos.test.ts` (8 tests) para cerrarlo, aunque el reporte de cobertura de la nueva
  versión de `@vitest/coverage-v8` ya no lo contaba en el denominador (cambio de comportamiento entre
  versiones: antes, un archivo importado pero sin ejecutar contaba como 0%; ahora, un archivo que ningún
  test importa directamente queda fuera del reporte). Se prefirió escribir el test igual, en vez de confiar
  en que el umbral se cumpliera "por omisión" del reporte.
- Verificado: `npm test` (240 tests OK, 6 omitidos), `npm run typecheck` y `npm run lint` sin errores;
  `npm audit`: 0 críticas (antes 2), 15 altas + 1 moderada + 1 baja sin fix publicado (antes 23 altas + 3
  moderadas + 1 baja); cobertura de línea ≥90% verificada en los 6 scopes de dominio/aplicación exigidos por
  T135 (100% en 6 de ellos, 98.3%/95.2%/90.0% en los otros 3). No se pudo ejecutar T131 (checklist E2E
  manual), T132 (accesibilidad WCAG 2.1 AA) ni T133 (Lighthouse) — necesitan una tienda real y un navegador
  contra Dawn/Horizon, fuera del alcance de la sesión cloud (agregado arriba en la fase de testing). T136
  (Partners Dashboard) tampoco: es la FASE-10, operativa y explícitamente fuera de esta sesión.

### Sesión 11 — `/speckit-converge`

- Se evaluó el código contra `spec.md` (FR, NFR, SC, US/AC, EC, CT y §14–§25), `tasks.md` y la constitución.
  Resultado: 13 hallazgos agregados como `## Phase 12: Convergence` (T142–T154) al final de `tasks.md`, sin
  tocar `spec.md`, `plan.md` ni código.
- Hallazgos principales: los fixtures de las Functions no se ejecutan en `npm test` (ni sobre wasm, T142,
  bloqueado por Partners; ni sobre los adaptadores TS, T143); `test:coverage` no tiene umbral del 90 %
  (T144); falta `app/routes/auth.login/*` del template (T145); restos del template en inglés (T146, T147);
  catálogo de logs del §22 incompleto y con otros nombres (T148); `stale: true` también en SWR (T149);
  respaldo del EC-15 sin implementar (T150).
- Menores: watch del embed en `npm run dev` (T151), enlace compacto sin `Shopify.routes.root` (T152),
  `SIGTERM` con `npm` como PID 1 (T153) y `process.env` directo en `app.tsx` (T154).
- Aviso para T150: el bundle está en 19 717 bytes (margen de 763 bytes hasta el límite de 20 KB).
- Verificado: `npm test` (240 OK, 6 omitidos) y `npm run build:embed` en verde; no hubo cambios de código.

### Sesión 12 — Phase 12 (Convergence)

- **T143**: `extensions/*/src/fixtures.test.ts` recorre `tests/fixtures/*.json` y compara `run(input)` con
  `output` (7 fixtures de `ocultar-envios` + 4 de `renombrar-recogida`, todos OK sin cambios de código).
- **T144**: `coverage` es opción global en Vitest 4 (`defineProject` no la admite), así que los umbrales
  viven en el `vitest.config.ts` raíz, uno por glob de cada scope del §24.1, con `coverage.include` limitado
  a esos scopes (un archivo sin tests cuenta como 0 %). Se comprobó que el umbral falla subiéndolo a 99 %.
  Ningún scope quedaba debajo del 90 %; `deploy/src/aplicacion` estaba justo en 90,00 %, así que se
  agregaron tests de `--paso verificar/secretos/imagen` (ahora 100 %).
- **T145**: `auth.login` del template oficial (`Shopify/shopify-app-template-react-router`, rama `main`,
  que usa `@shopify/shopify-app-react-router` 1.x) con textos en `app/i18n/es.ts`. Adaptación necesaria: la
  v3.0.0 instalada aquí quitó `<AppProvider embedded={false}>` (en v1 solo cargaba el script de Polaris sin
  App Bridge), así que la ruta carga ese mismo script (`polaris.js`) a mano. En v3 `authenticate.admin` ya no
  redirige a `/auth/login` (renderiza App Bridge), pero sin esta ruta `/auth/login` caía en `auth.$` y
  respondía 500. `_index` ahora reutiliza `auth.login/error.server.tsx` (se borró su copia en inglés).
- **Hallazgo no numerado**: `flatRoutes()` registraba cada `*.test.ts(x)` de `app/routes` como ruta hija
  (`/healthz/test`, `/proxy/puntos/test`, …) y los empaquetaba en el build del servidor. Arreglado con
  `ignoredRouteFiles: ["**/*.test.{ts,tsx}"]` en `app/routes.ts` (verificado con `react-router routes` y
  `npm run build`). También `<html lang="es">` en `app/root.tsx`.
- **T146/T147/T154**: sin `app.additional.tsx`; navegación, landing (con enlace a `/privacidad`) e inicio
  de sesión en español desde `es.ts`; `app.tsx` lee `contenedor.config.shopifyApiKey`.
- **T148**: eventos del §22 (`proxy.puntos.respuesta`, `puntos.carga`, `puntos.invalido` con `gid`,
  `puntos.duplicado` con `gids`, `puntos.carga.error` con `reintentos`, `personalizaciones.activacion` con
  `tienda`, `webhook.recibido` en `app/uninstalled` y `app/scopes_update`). Para las métricas, el puerto
  `FuentePuntos.obtenerTodos()` ahora devuelve `{ puntos, metricas: { paginas, costo, reintentos } }` y, si
  falla, `FuentePuntosError` con los reintentos y la causa. `requestId` sale de `traceparent`
  (trace-id W3C) o `x-cloud-trace-context` mediante un `AsyncLocalStorage`
  (`infrastructure/observabilidad/contextoPeticion.server.ts`) que `RegistroJson` consulta; las rutas lo
  activan con `contenedor.conContextoPeticion`. El 500 del proxy loguea `stack`. README §18 actualizado.
- **T149**: `ListarPuntosRecogida.ejecutar` devuelve `{ respuesta, estadoCache }`; la copia vencida sale con
  `stale: false` en el camino normal (SWR) y `stale: true` solo mientras el último refresco de esa tienda
  falló (se limpia con el siguiente que funcione).
- **T150/T152**: sin botones reconocibles, el widget se inserta justo antes de `.pr-embed-raiz` (y se retira
  cuando aparece un botón); el enlace compacto usa `raizDeRutas()` (`Shopify.routes.root`, o `rutaRaiz` de
  `#pr-config` con la barra final agregada). **Bundle: 19 908 bytes** (antes 19 717; quedan 572 bytes).
- **T151**: `build.mjs --watch` (contexto de esbuild con el control de peso en cada rebuild, sin cortar el
  watch) y `npm run dev` → `scripts/dev.mjs`, que lanza el watch y `shopify app dev --config dev` sin
  dependencias nuevas y detiene ambos cuando termina uno.
- **T153**: `CMD ["node_modules/.bin/react-router-serve", "./build/server/index.js"]` (react-router-serve ya
  atiende SIGTERM/SIGINT con `server.close`); documentado en README §14.
- **Pendiente sin tarea**: `tsc --noEmit` dentro de `packages/selector-carrito` da 2 errores previos a esta
  sesión en `src/main.ts` (`exactOptionalPropertyTypes` con `interruptorDemo` y el tipo de
  `atributosModoDemo`); el `npm run typecheck` raíz no cubre ese workspace, aunque el §21.4 dice "en todos
  los workspaces". Candidato para el próximo `/speckit-converge`.
- Verificado: `npm test` (278 OK, 6 omitidos), `npm run typecheck`, `npm run lint`, `npm run test:coverage`
  (umbrales cumplidos), `npm run build:embed` (19 908 bytes) y `npm run build` en verde.
