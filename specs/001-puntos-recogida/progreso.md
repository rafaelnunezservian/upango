# Progreso: 001-puntos-recogida

Bitácora de handoff entre sesiones de Claude Code en la nube. Cada sesión la lee al empezar y la actualiza
al cerrar. Las tareas viven en [`tasks.md`](./tasks.md); el diseño, en [`spec.md`](./spec.md).

## Estado actual

- **Última fase completada**: Phase 6 — US-4 (T092–T095).
- **Siguiente sesión**: Phase 7 — User Story 5 (T096–T109).

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
| 8 | Phase 7 — US-5 | T096–T109 | ⏳ (siguiente) |
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
- Checkpoint de la extensión `selector-punto` (T073–T077, T124–T126): `shopify app dev`/`deploy` la
  registra como app embed activable en el editor de temas; falta probarla contra Dawn/Horizon reales (ver
  sesión 5) — bloqueo, combobox, modo demo y accesibilidad en el navegador.
- T090 (medir instrucciones de `ocultar-envios`/`renombrar-recogida` con `shopify app function run` sobre el
  fixture de peor caso, NFR-06): no se pudo completar en la sesión cloud. Ver sesión 6 para el diagnóstico
  exacto (`shopify app function schema` devuelve 403 sin una app vinculada a Partners) y qué falta para
  correrlo: T001 (Partners) y luego `npm run typegen`/`npm run build` en cada extensión.
- Checkpoint de la extensión `punto-pedido` (T092–T095, ver sesión 7): `shopify app dev`/`deploy` la registra
  como bloque de app disponible en Configuración → Checkout → Personalizar → página de estado del pedido;
  falta confirmar en una tienda real que el comerciante puede agregarla y que el bloque "Punto de recogida"
  aparece con los 7 atributos reales de un pedido resolado (en la sesión cloud solo se pudo simular
  `shopify.attributes`/`shopify.i18n` con dobles de test).

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
