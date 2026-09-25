---

description: "Task list template for feature implementation"
---

# Tasks: Puntos de recogida sin Shopify Plus

**Input**: Documento maestro `specs/001-puntos-recogida/spec.md` (SPEC + PLAN) y puntero `plan.md`.

**Prerequisites**: `plan.md` (apunta a `spec.md`), `spec.md` (contiene historias de usuario §4, requisitos §5,
decisiones §12 = research.md, modelo de datos y contratos §13 = data-model.md/contracts/, estructura del
repositorio §14, diseño por componente §15–§20, entornos y scripts §21, estrategia de pruebas §24 y Anexo B =
quickstart.md, requisitos de README §25, hoja de ruta §27).

**Tests**: Solicitados explícitamente (FR-090 a FR-092, cobertura ≥90% en capas dominio/aplicación). Cada fase
de historia de usuario incluye sus propias tareas de test según §24.

**Organization**: Las tareas están agrupadas por historia de usuario según la hoja de ruta §27.1/§27.3 del
documento maestro (FASE-0 a FASE-10), para permitir implementación y prueba independientes de cada historia.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1–US7)
- Se incluyen rutas de archivo exactas según §14 del documento maestro

## Path Conventions

Monorepo de app Shopify: `app/` (backend React Router, Clean Architecture), `packages/contratos` y
`packages/selector-carrito` (código compartido/cliente), `extensions/` (theme app extension, dos Delivery
Customization Functions, customer account UI extension), `deploy/` (CLI de despliegue). Árbol completo en
`spec.md` §14.

---

## Phase 1: Setup (FASE-0 + inicialización de repo de FASE-1)

**Purpose**: Cuentas, herramientas y esqueleto del monorepo.

- [ ] T001 Crear cuenta de Shopify Partners y una app de desarrollo (Partners Dashboard); registrar client_id de dev para `shopify.app.dev.toml`
- [ ] T002 [P] Crear dev store con temas Dawn y Horizon instalados (uno publicado, uno en vista previa) y cuentas de cliente nuevas habilitadas
- [ ] T003 [P] Crear proyecto de Google Cloud con facturación habilitada para el proveedor de referencia GCP
- [ ] T004 [P] Instalar y verificar versiones locales de Node.js 24 LTS, Shopify CLI y gcloud CLI
- [x] T005 Inicializar el proyecto backend con el template React Router de Shopify (sin Prisma) en `CODE/upango/` mediante `shopify app init`
- [x] T006 Configurar npm workspaces (`app`, `packages/*`, `extensions/*`, `deploy`) en `package.json` raíz
- [x] T007 [P] Configurar TypeScript strict en `tsconfig.base.json`
- [x] T008 [P] Configurar ESLint en `eslint.config.js`, incluyendo la regla de restricción de imports de FR-083 (SDK/CLI de nube solo en `app/infrastructure/**` y `deploy/src/proveedores/**`)
- [x] T009 [P] Configurar Prettier en `.prettierrc`
- [x] T010 [P] Configurar Vitest workspace en `vitest.workspace.ts`
- [x] T011 [P] Crear `.env.example` con las 16 variables de entorno de CT-09 (sin valores secretos)
- [x] T012 [P] Crear `.gitignore` y `.dockerignore` iniciales en la raíz del repo

**Checkpoint**: entorno de desarrollo listo; `npm install` funciona en el monorepo.

---

## Phase 2: Foundational (resto de FASE-1 — bloqueante para todas las historias)

**Purpose**: Infraestructura común (contratos compartidos, config, sesiones, logging, composition root, TOMLs,
webhooks, endpoints públicos) que todas las historias de usuario necesitan.

**⚠️ CRITICAL**: Ninguna historia de usuario puede comenzar hasta completar esta fase.

### Paquete de contratos compartidos

- [x] T013 Crear paquete `@puntos-recogida/contratos` en `packages/contratos/package.json`
- [x] T014 [P] Implementar normalización de texto (acentos/mayúsculas) en `packages/contratos/src/normalizacion.ts`
- [x] T015 [P] Implementar `esCarritoResolado` en `packages/contratos/src/carrito.ts`
- [x] T016 [P] Implementar `esTarifaRecogida` (comparación normalizada contra `TITULO_TARIFA_RECOGIDA`, DEC-08) en `packages/contratos/src/tarifa.ts`
- [x] T017 [P] Implementar `formatearTituloRecogida` (trim, quitar caracteres de control, colapsar espacios, truncar a 60 con "…") en `packages/contratos/src/tarifa.ts`
- [x] T018 [P] Definir `CLAVES_ATRIBUTO` (las 8 claves de CT-02) en `packages/contratos/src/atributos.ts`
- [x] T019 [P] Test de coherencia: leer los `.graphql` de ambas Functions y fallar si alguna clave no coincide con `CLAVES_ATRIBUTO`, en `packages/contratos/src/coherencia.test.ts`
- [x] T020 [P] Tests unitarios de contratos (normalización, `esCarritoResolado`, `esTarifaRecogida`, `formatearTituloRecogida`) en `packages/contratos/src/*.test.ts`

### Configuración, sesiones y observabilidad

- [x] T021 Implementar `config.server.ts` con validación zod de las 16 variables de entorno (CT-09), exponiendo un objeto tipado e inmutable, en `app/config/config.server.ts`
- [x] T022 [P] Test de `config.server.ts` (el proceso falla con mensaje claro si falta una variable requerida) en `app/config/config.server.test.ts`
- [x] T023 Implementar `FirestoreSessionStorage` (basado en `snippets/firestore-session-storage.server.ts`, colección/DB configurables) en `app/infrastructure/sesiones/firestoreSessionStorage.server.ts`
- [x] T024 [P] Implementar `fabricaSessionStorage.server.ts` que selecciona entre `MemorySessionStorage` y `FirestoreSessionStorage` según `SESSION_STORAGE_DRIVER`, en `app/infrastructure/sesiones/fabricaSessionStorage.server.ts`
- [x] T025 [P] Test de contrato compartido de `SessionStorage` (memoria + emulador de Firestore) en `app/infrastructure/sesiones/sessionStorage.contract.test.ts`
- [x] T026 [P] Implementar `RegistroJson` (logs JSON estructurados con severidad/evento/shop/duración, nunca secretos ni PII) en `app/infrastructure/observabilidad/registroJson.server.ts`
- [x] T027 [P] Implementar `RelojSistema` en `app/infrastructure/observabilidad/relojSistema.server.ts`

### Composition root y configuración de la app Shopify

- [x] T028 Implementar `contenedor.server.ts` (singletons: sessionStorage según driver, registro, reloj; factories por request) en `app/composition/contenedor.server.ts` (depende de T021, T023, T024, T026, T027)
- [x] T029 Configurar `shopify.server.ts` (`shopifyApp`, apiVersion 2026-07, `authPathPrefix="/auth"`, `distribution: AppDistribution.AppStore`, sessionStorage desde el contenedor) en `app/shopify.server.ts` (depende de T028)
- [x] T030 [P] Crear `shopify.app.toml` de producción (CT-08 completo: nombre, scopes mínimos FR-069, `auth.redirect_urls`, webhooks, `app_proxy`) en la raíz del repo
- [x] T031 [P] Crear `shopify.app.dev.toml` (DEC-18: client_id de dev, `automatically_update_urls_on_dev=true`) en la raíz del repo

### Webhooks y endpoints públicos base

- [x] T032 [P] Implementar `app/routes/webhooks.app.uninstalled.tsx` (FR-065: elimina sesiones de la tienda y limpia caché)
- [x] T033 [P] Implementar `app/routes/webhooks.app.scopes_update.tsx` (FR-066: actualiza el scope almacenado)
- [x] T034 [P] Implementar `app/routes/webhooks.compliance.tsx` (FR-067: `customers/data_request`, `customers/redact` solo registran; `shop/redact` elimina datos remanentes de la tienda)
- [x] T035 [P] Implementar `app/routes/healthz.tsx` (`GET /healthz` → 200, FR-075)
- [x] T036 [P] Implementar `app/routes/privacidad.tsx` (política de privacidad pública en español, FR-068)
- [x] T037 [P] Tests de `healthz.tsx` y de los webhooks base en `app/routes/*.test.ts`

**Checkpoint**: `npm test`, `npm run typecheck` y `npm run lint` en verde; `shopify app dev` instala la app en la
dev store sin errores. La implementación de historias de usuario puede comenzar.

---

## Phase 3: User Story 1 - El comerciante administra los puntos desde el admin nativo (Priority: P1) 🎯 MVP

**Goal**: El comerciante crea/edita/elimina puntos de recogida usando el CRUD nativo de metaobjetos de
Shopify (Content → Metaobjects → "Punto de recogida"), sin pantallas propias.

**Independent Test**: Instalar la app en una dev store, crear/editar/eliminar entradas del metaobjeto desde el
admin y verificar las validaciones de campos.

### Implementation for User Story 1

- [x] T038 [P] [US1] Implementar entidad `PuntoRecogida` + `Coordenadas` + validaciones de dominio en `app/domain/puntoRecogida.ts`
- [x] T039 [P] [US1] Tests de dominio de `PuntoRecogida` (construcción y validación) en `app/domain/puntoRecogida.test.ts`
- [x] T040 [US1] Añadir el bloque de definición del metaobjeto `$app:punto_recogida` (CT-01: 6 campos, `display_name_field="nombre"`, `access.admin="merchant_read_write"`, `access.storefront="none"`) a `shopify.app.toml` (depende de T030)
- [x] T041 [US1] Replicar el mismo bloque CT-01 en `shopify.app.dev.toml` (depende de T031)
- [x] T042 [US1] Implementar `EscritorPuntosShopify` (adapter de escritura, solo para semilla FR-005) en `app/infrastructure/shopify/escritorPuntosShopify.server.ts`
- [x] T043 [US1] Implementar el caso de uso `CrearPuntosDeEjemplo` (600 puntos por defecto, handles `ejemplo-0001...`, idempotente por handle, respeta throttling) en `app/application/use-cases/crearPuntosDeEjemplo.ts` (depende de T042)
- [x] T044 [US1] Registrar la acción de semilla en `app/routes/app._index.tsx` bajo `HABILITAR_SEMILLA` (ausente/falla al iniciar en producción) — ruta mínima, se completa en Fase 7 (US-5)
- [x] T045 [P] [US1] Tests del caso de uso `CrearPuntosDeEjemplo` (idempotencia, throttling) en `app/application/use-cases/crearPuntosDeEjemplo.test.ts`

**Checkpoint**: la definición del metaobjeto se despliega con `shopify app deploy`; el CRUD nativo del admin
valida campos vacíos, coordenadas fuera de rango y `direccion_corta` >60 caracteres; la herramienta de semilla
solo existe en dev.

---

## Phase 4: User Story 2 - El comprador elige un punto de recogida en el carrito (Priority: P1)

**Goal**: En `/cart` o en el drawer, con un carrito resolado, el comprador ve un selector con búsqueda y debe
elegir un punto antes de poder pagar.

**Independent Test**: Con puntos cargados y `tipo_carrito=resolado` (modo demo o `/cart/update.js`), abrir el
carrito en Dawn y Horizon, buscar, elegir un punto y verificar los atributos de `/cart.js` y el desbloqueo del
checkout.

### Backend: fuente de datos, caché y proxy

- [x] T046 [P] [US2] Definir el puerto `FuentePuntos` en `app/application/ports/fuentePuntos.ts`
- [x] T047 [P] [US2] Definir el puerto `CachePuntos` en `app/application/ports/cachePuntos.ts`
- [x] T048 [US2] Implementar `FuentePuntosShopify` (paginación cursor de 250, backoff exponencial ante throttling, reducción de tamaño de página) en `app/infrastructure/shopify/fuentePuntosShopify.server.ts` (depende de T046)
- [x] T049 [P] [US2] Tests de `FuentePuntosShopify` (múltiples páginas, throttling + reintentos, reducción de page size) con cliente GraphQL falso en `app/infrastructure/shopify/fuentePuntosShopify.server.test.ts`
- [x] T050 [US2] Implementar `CachePuntosMemoria` (TTL configurable, single-flight, stale-while-revalidate, stale-if-error hasta 24h, LRU con tope de 1000 tiendas) en `app/infrastructure/cache/cachePuntosMemoria.server.ts` (depende de T047)
- [x] T051 [P] [US2] Tests de `CachePuntosMemoria` (TTL, LRU, stale-if-error) en `app/infrastructure/cache/cachePuntosMemoria.server.test.ts`
- [x] T052 [US2] Implementar el caso de uso `ListarPuntosRecogida` (fresco/obsoleto+refresh en segundo plano/single-flight/stale-if-error/sin copia válida/descarta inválidos con log/orden alfabético español/detecta duplicados) en `app/application/use-cases/listarPuntosRecogida.ts` (depende de T048, T050, T038)
- [x] T053 [P] [US2] Tests de `ListarPuntosRecogida` con dobles de puertos en `app/application/use-cases/listarPuntosRecogida.test.ts`
- [x] T054 [P] [US2] Implementar errores de dominio `PuntoInvalidoError` y `PuntosNoDisponiblesError` en `app/domain/errores.ts`
- [x] T055 [US2] Implementar `app/routes/proxy.puntos.tsx` (`authenticate.public.appProxy`, forma JSON de CT-03, mapeo de errores 400/401/404/502/500, `Cache-Control: public, max-age=60`) (depende de T052, T054)
- [x] T056 [P] [US2] Tests de `proxy.puntos.tsx` (firma inválida → rechazo, sin sesión → 404, ok → JSON de CT-03, error de origen → 502) en `app/routes/proxy.puntos.test.ts`
- [x] T057 [US2] Registrar `FuentePuntos`, `CachePuntos` y `ListarPuntosRecogida` en `app/composition/contenedor.server.ts` (depende de T028, T048, T050, T052)

### Paquete de cliente de carrito (`packages/selector-carrito`)

- [x] T058 [P] [US2] Crear `packages/selector-carrito` con `package.json` y `build.mjs` (esbuild iife/minify/target es2019, sin comentarios de licencia, falla si el bundle supera 20KB)
- [x] T059 [P] [US2] Implementar la máquina de 8 estados en `packages/selector-carrito/src/dominio/estadoCarrito.ts`
- [x] T060 [P] [US2] Implementar `filtroPuntos.ts` (índice de búsqueda precalculado, `filtrar(indice, consulta, limite=50)`, insensible a acentos/mayúsculas) en `packages/selector-carrito/src/dominio/filtroPuntos.ts`
- [x] T061 [P] [US2] Implementar `revalidacion.ts` (`evaluarSeleccion` → vigente/desactualizada/inexistente) en `packages/selector-carrito/src/dominio/revalidacion.ts`
- [x] T062 [P] [US2] Definir los puertos `ClienteCarrito`, `ClientePuntos`, `VistaSelector`, `GuardiaCheckout`, `ObservadorCarrito` en `packages/selector-carrito/src/aplicacion/puertos.ts`
- [x] T063 [US2] Implementar `ControladorSelector.ts` (orquesta la máquina de estados) en `packages/selector-carrito/src/aplicacion/ControladorSelector.ts` (depende de T059, T060, T061, T062)
- [x] T064 [P] [US2] Implementar `ClienteCarritoAjax.ts` (`cart.js` / `cart/update.js`) en `packages/selector-carrito/src/infraestructura/ClienteCarritoAjax.ts`
- [x] T065 [P] [US2] Implementar `ClientePuntosProxy.ts` (timeout 8s, 1 reintento) en `packages/selector-carrito/src/infraestructura/ClientePuntosProxy.ts`
- [x] T066 [P] [US2] Implementar `VistaComboboxDom.ts` (patrón ARIA 1.2 combobox, siempre `textContent`) en `packages/selector-carrito/src/infraestructura/VistaComboboxDom.ts`
- [x] T067 [P] [US2] Implementar `GuardiaCheckoutDom.ts` (disabled + aria-disabled, listeners en fase de captura para click/submit, oculta contenedores de pago acelerado) en `packages/selector-carrito/src/infraestructura/GuardiaCheckoutDom.ts`
- [x] T068 [P] [US2] Implementar `ObservadorCarritoDom.ts` (envuelve fetch/XHR para `/cart/add|change|update|clear`, pubsub `cart-update` de Dawn, eventos de carrito de Horizon, `visibilitychange`, debounce 250ms, marcador interno anti-loop) en `packages/selector-carrito/src/infraestructura/ObservadorCarritoDom.ts`
- [x] T069 [P] [US2] Implementar `InsertadorWidgets.ts` (agrupa botones de checkout visibles, `MutationObserver` con debounce 100ms, bloqueo simplificado en contextos compactos EC-24) en `packages/selector-carrito/src/infraestructura/InsertadorWidgets.ts`
- [x] T070 [US2] Implementar `main.ts` (composition root del navegador, lee `#pr-config`) en `packages/selector-carrito/src/main.ts` (depende de T063–T069)
- [x] T071 [P] [US2] Tests de dominio y aplicación (filtro por acentos/mayúsculas/límite/orden, revalidación, transiciones de estado, limpieza en carrito normal) con dobles en `packages/selector-carrito/src/**/*.test.ts`
- [x] T072 [P] [US2] Tests DOM (inserción de widgets, bloqueo con disabled+captura de click/submit, ocultamiento de pagos acelerados, ARIA básica, reinserción tras re-render) con jsdom en `packages/selector-carrito/src/infraestructura/*.test.ts`

### Theme app extension (app embed)

- [ ] T073 [US2] Generar `extensions/selector-punto` con `shopify app generate extension --template theme_app_extension --name selector-punto`
- [ ] T074 [US2] Escribir `blocks/selector-punto.liquid` (contenedor raíz + `<script type="application/json" id="pr-config">` + `{% schema %}` con los 6 settings de contenido de CT-06) (depende de T073)
- [ ] T075 [US2] Configurar el script `build:embed` en `package.json` raíz para compilar `packages/selector-carrito` → `extensions/selector-punto/assets/selector-punto.js` vía esbuild (depende de T070)
- [ ] T076 [P] [US2] Escribir `extensions/selector-punto/assets/selector-punto.css` (prefijo `pr-`, variables CSS, foco visible, objetivos táctiles ≥44px, sin reset global)
- [ ] T077 [P] [US2] Crear `extensions/selector-punto/locales/es.default.json` (claves `selector.*`/`demo.*`) y `locales/es.default.schema.json` (depende de T074)

**Checkpoint**: los escenarios de US-2 pasan en Dawn y Horizon (`/cart` y drawer, escritorio y móvil); NFR-01 a
NFR-04 medidos.

---

## Phase 5: User Story 3 - El checkout ofrece únicamente la opción de recogida (Priority: P1)

**Goal**: En carritos resolados con punto seleccionado, el paso de entrega muestra una única opción de
recogida renombrada; los carritos normales no se ven afectados.

**Independent Test**: Con las Functions activas y la tarifa creada, llegar a la selección de entrega para (a)
resolado+punto, (b) resolado sin punto vía `/checkout` directo, (c) carrito normal; complementar con
`shopify app function run` sobre fixtures.

### Implementation for User Story 3

- [ ] T078 [P] [US3] Generar `extensions/ocultar-envios` con `shopify app generate extension --template delivery_customization --flavor typescript --name ocultar-envios`
- [ ] T079 [P] [US3] Generar `extensions/renombrar-recogida` con el mismo template y `--name renombrar-recogida`
- [ ] T080 [P] [US3] Escribir la query CT-04 en `extensions/ocultar-envios/src/cart.delivery-options.transform.graphql`
- [ ] T081 [P] [US3] Escribir la query CT-05 (incluye `puntoDireccionCorta`) en `extensions/renombrar-recogida/src/cart.delivery-options.transform.graphql`
- [ ] T082 [US3] Implementar el núcleo puro `decidirOcultamiento` (tabla de decisión CT-04, fail-closed) en `extensions/ocultar-envios/src/dominio/decidirOcultamiento.ts` (depende de T080, T018)
- [ ] T083 [US3] Implementar el núcleo puro `decidirRenombre` (tabla CT-05 + `formatearTituloRecogida`) en `extensions/renombrar-recogida/src/dominio/decidirRenombre.ts` (depende de T081, T017)
- [ ] T084 [US3] Implementar el adapter `src/index.ts` de `ocultar-envios` (mapea el input generado de Shopify al núcleo puro y produce `deliveryOptionHide`) (depende de T082)
- [ ] T085 [US3] Implementar el adapter equivalente de `renombrar-recogida` (produce `deliveryOptionRename`) (depende de T083)
- [ ] T086 [P] [US3] Tests unitarios de `decidirOcultamiento` (6 filas de la tabla CT-04 + casos límite: `tipo_carrito` vacío/mayúsculas, `punto_id` vacío/espacios, múltiples grupos de entrega) en `extensions/ocultar-envios/src/dominio/decidirOcultamiento.test.ts`
- [ ] T087 [P] [US3] Tests unitarios de `decidirRenombre` (3 casos de CT-05 + título nulo, dirección corta >60 caracteres, caracteres de control, variantes de mayúsculas/acentos del título de tarifa) en `extensions/renombrar-recogida/src/dominio/decidirRenombre.test.ts`
- [ ] T088 [P] [US3] Crear fixtures wasm por fila de CT-04 + caso peor (10 grupos × 20 opciones) en `extensions/ocultar-envios/tests/fixtures/*.json`
- [ ] T089 [P] [US3] Crear fixtures wasm equivalentes en `extensions/renombrar-recogida/tests/fixtures/*.json`
- [ ] T090 [P] [US3] Medir con `shopify app function run` el presupuesto de instrucciones de ambas Functions sobre el fixture de caso peor y verificar ≤50% del límite de la plataforma (NFR-06)
- [ ] T091 [US3] Añadir la dependencia `@puntos-recogida/contratos` a `package.json` de ambas extensiones (depende de T078, T079, T017, T018)

**Checkpoint**: `shopify app function run` sobre los fixtures confirma resolado+punto → 1 opción renombrada,
resolado sin punto → 0 opciones, carrito normal → sin cambios; NFR-06 cumplido; cada Function funciona de forma
independiente sin depender del backend (NFR-07).

---

## Phase 6: User Story 4 - El pedido conserva el punto; el comprador lo ve en la página de estado (Priority: P2)

**Goal**: Al pagar, el pedido guarda una instantánea de los atributos del carrito; el comprador ve el punto en
la página de estado del pedido y el comerciante en el detalle del pedido.

**Independent Test**: Completar un pedido resolado en la dev store, luego editar y eliminar el punto, y
verificar "Detalles adicionales" en el admin y la página de estado del pedido.

### Implementation for User Story 4

- [ ] T092 [P] [US4] Generar `extensions/punto-pedido` (customer account UI extension, Preact/TypeScript, target `customer-account.order-status.block.render`)
- [ ] T093 [US4] Implementar `src/PuntoPedido.tsx` (`leerSeleccionDeAtributos` sobre `shopify.attributes`, sección con nombre/dirección completa/`Identificador: {punto_id}`/enlace "Ver en el mapa" a Google Maps, sin peticiones de red) en `extensions/punto-pedido/src/PuntoPedido.tsx` (depende de T092, T018)
- [ ] T094 [P] [US4] Crear `extensions/punto-pedido/locales/es.default.json`
- [ ] T095 [P] [US4] Tests de `PuntoPedido.tsx` (no renderiza nada si `punto_id` está ausente; omite el enlace de mapa si las coordenadas son inválidas) en `extensions/punto-pedido/src/PuntoPedido.test.tsx`

**Checkpoint**: el pedido conserva los 8 atributos aunque el punto se edite o elimine después; el bloque
"Punto de recogida" es visible en la página de estado del pedido solo para pedidos resolados.

---

## Phase 7: User Story 5 - El comerciante entiende y configura la app desde la página del admin (Priority: P2)

**Goal**: La página del admin explica la app, lista 5 pasos de configuración con estado y enlaces/botón de
activación directos.

**Independent Test**: Abrir la app en una tienda recién instalada y completar la configuración usando
únicamente esa página.

### Implementation for User Story 5

- [ ] T096 [P] [US5] Definir el puerto `GatewayPersonalizaciones` en `app/application/ports/gatewayPersonalizaciones.ts`
- [ ] T097 [P] [US5] Definir el puerto `ConsultaConfiguracionTienda` en `app/application/ports/consultaConfiguracionTienda.ts`
- [ ] T098 [US5] Implementar `GatewayPersonalizacionesShopify` (query `deliveryCustomizations` filtrada por `appKey`, `deliveryCustomizationCreate`/`Update`) en `app/infrastructure/shopify/gatewayPersonalizacionesShopify.server.ts` (depende de T096)
- [ ] T099 [P] [US5] Tests de `GatewayPersonalizacionesShopify` (filtro por `appKey` + `handle`) en `app/infrastructure/shopify/gatewayPersonalizacionesShopify.server.test.ts`
- [ ] T100 [US5] Implementar `ConsultaConfiguracionTiendaShopify` (`metaobjectDefinitionByType`) en `app/infrastructure/shopify/consultaConfiguracionTiendaShopify.server.ts` (depende de T097)
- [ ] T101 [US5] Implementar el caso de uso `ObtenerEstadoConfiguracion` (total de puntos, estado de personalizaciones por handle, enlaces, título de tarifa, `semillaHabilitada`) en `app/application/use-cases/obtenerEstadoConfiguracion.ts` (depende de T100, T052)
- [ ] T102 [US5] Implementar el caso de uso `ActivarPersonalizacionesEntrega` (crear si falta con `functionHandle`+título, activar si inactiva, no-op si activa, idempotente, retorna `{creadas, activadas, errores}`) en `app/application/use-cases/activarPersonalizacionesEntrega.ts` (depende de T098)
- [ ] T103 [P] [US5] Tests de `ObtenerEstadoConfiguracion` en `app/application/use-cases/obtenerEstadoConfiguracion.test.ts`
- [ ] T104 [P] [US5] Tests de `ActivarPersonalizacionesEntrega` (crear/activar/idempotente/userErrors, incluye caso de 25 personalizaciones existentes) en `app/application/use-cases/activarPersonalizacionesEntrega.test.ts`
- [ ] T105 [US5] Registrar ambos casos de uso y sus adapters en `app/composition/contenedor.server.ts` (depende de T028, T098, T100, T101, T102)
- [ ] T106 [US5] Implementar loader/action de `app/routes/app._index.tsx` (loader → `ObtenerEstadoConfiguracion`; action con `intencion=activar|sembrar`) (depende de T101, T102, T043)
- [ ] T107 [US5] Implementar la UI con Polaris web components de la página admin (`s-page`, "Qué hace esta app", tabla de 5 pasos con deep links `shopify:admin/...`, "Cómo funciona", sección de modo demo, aviso "Antes de desinstalar" EC-20, botón de datos de ejemplo solo si `semillaHabilitada`) en `app/routes/app._index.tsx` (depende de T106)
- [ ] T108 [P] [US5] Textos en español de la página admin en `app/i18n/es.ts`
- [ ] T109 [P] [US5] Tests de `app._index.tsx` (loader falla → banner con reintento; action con errores → banner con `userErrors`) en `app/routes/app._index.test.tsx`

**Checkpoint**: una tienda recién instalada completa la configuración en ≤15 min solo con la página admin y el
README; el botón "Activar" es idempotente y nunca duplica personalizaciones.

---

## Phase 8: User Story 6 - El operador despliega el backend de forma portable (Priority: P3)

**Goal**: El operador despliega el backend a Google Cloud con un comando de CLI de despliegue según el
README; cambiar de proveedor implica solo un nuevo adapter, sin reescribir la app.

**Independent Test**: En un proyecto GCP vacío, seguir el README, ejecutar `npm run deploy -- --proveedor gcp`,
luego `shopify app deploy`, e instalar la app en una dev store.

### Implementation for User Story 6

- [ ] T110 [P] [US6] Escribir `Dockerfile` multi-stage (build: `node:24-alpine`, solo workspaces `app` + `packages/contratos`, build de React Router; final: `node:24-alpine`, `NODE_ENV=production`, solo deps de producción + `build/`, usuario no root, `EXPOSE 8080`)
- [ ] T111 [P] [US6] Escribir `.dockerignore` (excluye `extensions/`, `deploy/`, `specs/`, `.specify/`, `.claude/`, `node_modules/`, `tests/`, `.env*`)
- [ ] T112 [P] [US6] Definir los contratos TypeScript del CLI de despliegue (`ContextoDespliegue`, `ProveedorDespliegue`, `ResultadoDespliegue`, `EjecutorComandos`, CT-10) en `deploy/src/puertos/`
- [ ] T113 [P] [US6] Crear `deploy/deploy.config.json` (forma de CT-10)
- [ ] T114 [US6] Implementar `EjecutorComandosNode` (`child_process.spawn` sin shell, secretos pasados por stdin nunca como argumento, dry-run enmascara secretos) en `deploy/src/infraestructura/EjecutorComandosNode.ts` (depende de T112)
- [ ] T115 [US6] Implementar `OrquestadorDespliegue` (8 pasos de §20.3, idempotente, soporta `--paso` y `--dry-run`) en `deploy/src/aplicacion/OrquestadorDespliegue.ts` (depende de T112)
- [ ] T116 [P] [US6] Tests del orquestador (orden de pasos, `--paso`, `--dry-run`, manejo de errores, códigos de salida 0-4) con proveedor falso en `deploy/src/aplicacion/OrquestadorDespliegue.test.ts`
- [ ] T117 [US6] Implementar `ProveedorGcp` (`verificarPrerrequisitos`/`prepararInfraestructura`/`publicarSecretos`/`construirImagen`/`desplegarServicio`/`actualizarVariables` vía comandos `gcloud`, variables por `--env-vars-file` temporal, `--allow-unauthenticated`, cálculo determinista de la URL de Cloud Run antes del primer deploy) en `deploy/src/proveedores/gcp/` (depende de T114, T115)
- [ ] T118 [P] [US6] Tests de `ProveedorGcp` (comandos exactos por paso, idempotencia, secretos por stdin, archivo temporal de env vars eliminado tras usarse) con `EjecutorComandos` falso en `deploy/src/proveedores/gcp/*.test.ts`
- [ ] T119 [P] [US6] Crear el esqueleto documentado `deploy/src/proveedores/plantilla/` (lanza `ProveedorNoImplementadoError`)
- [ ] T120 [US6] Implementar el registro de proveedores en `deploy/src/proveedores/registro.ts` (depende de T117, T119)
- [ ] T121 [US6] Implementar `deploy/src/cli.ts` (parseo de `--proveedor`/`--dry-run`/`--paso`/`--etiqueta`, códigos de salida 0-4, lee `deploy.config.json` + secretos de `.env.deploy`/env) (depende de T115, T120)
- [ ] T122 [P] [US6] Añadir los scripts `deploy` y `deploy:shopify` en `package.json` raíz (depende de T121)
- [ ] T123 [P] [US6] Validar el contrato de `GET /healthz` (200) end-to-end tras un despliegue real en GCP (usa la ruta de T035)

**Checkpoint**: despliegue en un proyecto GCP vacío en ≤30 min con un solo comando (SC-009); `--dry-run` nunca
expone secretos; reintentar el despliegue no duplica infraestructura; un proveedor no implementado falla con un
mensaje claro que referencia la guía del README.

---

## Phase 9: User Story 7 - El evaluador prueba la app mediante modo demo (Priority: P3)

**Goal**: Dado que `tipo_carrito` normalmente lo escribe un sistema externo, el app embed ofrece un modo demo
para simular un carrito resolado sin herramientas de desarrollo.

**Independent Test**: Activar "Modo demo" en la configuración del embed en el editor de temas y recorrer el
flujo completo sin devtools.

### Implementation for User Story 7

- [ ] T124 [US7] Añadir el setting `modo_demo` (checkbox, apagado por defecto) al `{% schema %}` de `blocks/selector-punto.liquid` (depende de T074)
- [ ] T125 [US7] Implementar el toggle de modo demo en `packages/selector-carrito/src/main.ts` / `InsertadorWidgets.ts` (activar → `cart/update.js` con `tipo_carrito=resolado`; desactivar → limpia `tipo_carrito` y los 7 `punto_*`) (depende de T070)
- [ ] T126 [P] [US7] Tests de modo demo (el toggle no existe si `modo_demo=false`; activar/desactivar limpia los atributos correctos) en `packages/selector-carrito/src/**/*.test.ts`

**Checkpoint**: un evaluador completa el flujo completo (buscar, elegir, checkout, pedido) activando solo
"Modo demo" desde el editor de temas.

---

## Phase 10: Polish & Documentación (FASE-9)

**Purpose**: Documentación completa, validación E2E manual y hardening final que cruza todas las historias.

- [ ] T127 [P] Redactar `README.md` completo en español con las 23 secciones obligatorias de §25 (comandos en PowerShell y bash donde difieran)
- [ ] T128 [P] Documentar en el README la guía reproducible de compilación TS→wasm de las Functions (§18.3 completo) con el conteo real de instrucciones medido en T090 y el plan B en Rust
- [ ] T129 [P] Documentar en el README la guía paso a paso de despliegue en GCP (§20.5) y la guía para agregar otro proveedor (§20.7, ejemplo Azure)
- [ ] T130 [P] Documentar en el README la tabla de troubleshooting (§25 punto 20: sin opciones de entrega, selector no aparece, tarifa visible en carrito normal, proxy 404/401, Functions no se ejecutan, bloque de pedido no aparece, error de 25 personalizaciones, fallos por cada paso de deploy)
- [ ] T131 Ejecutar el checklist E2E manual completo del Anexo B (25 casos E2E-01 a E2E-25) en Dawn y Horizon, `/cart` y drawer, escritorio y móvil
- [ ] T132 [P] Auditoría de accesibilidad WCAG 2.1 AA sobre el selector de carrito y la página admin
- [ ] T133 [P] Medir Lighthouse en páginas de carrito con y sin la app, verificando pérdida ≤10 puntos (NFR-04) y cero llamadas al backend en carritos normales
- [ ] T134 Ejecutar `npm audit` y resolver vulnerabilidades críticas/altas
- [ ] T135 Verificar cobertura de línea ≥90% en `app/domain`, `app/application`, `packages/contratos`, `packages/selector-carrito/src/{dominio,aplicacion}`, `extensions/*/src/dominio`, `deploy/src/{dominio,aplicacion}` vía `npm run test:coverage`

**Checkpoint**: SC-001 a SC-011 verificados; Anexo B completo.

---

## Phase 11: Distribución (FASE-10 — operacional, puede quedar como tareas manuales finales)

**Purpose**: Publicación de la app en Shopify App Store (SC-012). No requiere código adicional del monorepo.

- [ ] T136 Configurar la app pública con distribución de visibilidad limitada en Partners Dashboard
- [ ] T137 [P] Redactar el listado en inglés con traducción al español para la revisión de Shopify
- [ ] T138 [P] Enlazar la política de privacidad pública (implementada en T036) desde el listado de la app
- [ ] T139 [P] Preparar capturas de pantalla y un video del flujo completo, incluyendo instrucciones de modo demo para el equipo de revisión
- [ ] T140 Configurar acceso de staff a la dev store para el equipo de revisión de Shopify
- [ ] T141 Enviar la app a revisión de App Store y dar seguimiento hasta su aprobación (SC-012)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede iniciar de inmediato
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias de usuario
- **User Story 1 (Phase 3, P1)**: depende de Foundational
- **User Story 2 (Phase 4, P1)**: depende de Foundational y de la entidad `PuntoRecogida` de US-1 (T038); no depende del resto de US-1
- **User Story 3 (Phase 5, P1)**: depende solo de Foundational (los contratos compartidos T014–T018); testeable de forma independiente vía `/cart/update.js` sin backend
- **User Story 4 (Phase 6, P2)**: depende de Foundational y de que existan pedidos reales con atributos (requiere US-2 y US-3 funcionando para pruebas de extremo a extremo, aunque la extensión en sí solo depende de CT-02)
- **User Story 5 (Phase 7, P2)**: depende de Foundational; integra el caso de uso de US-2 (`ListarPuntosRecogida`) y la acción de semilla de US-1 (T043)
- **User Story 6 (Phase 8, P3)**: depende solo de Foundational
- **User Story 7 (Phase 9, P3)**: depende de US-2 (extiende `extensions/selector-punto` y `packages/selector-carrito`)
- **Polish (Phase 10)**: depende de que todas las historias deseadas estén completas
- **Distribución (Phase 11)**: depende de Polish

### User Story Dependencies (resumen)

- US-1, US-3 y US-6 son independientes entre sí tras Foundational
- US-2 depende del dominio `PuntoRecogida` de US-1 (una sola tarea, T038)
- US-4 se prueba de extremo a extremo mejor después de US-2 y US-3, aunque su código no las requiere
- US-5 integra piezas de US-1 y US-2 pero puede construirse en paralelo a ellas usando dobles de prueba
- US-7 extiende directamente el código de US-2

### Parallel Opportunities

- Todas las tareas [P] de Setup pueden ejecutarse en paralelo
- Dentro de Foundational: el paquete de contratos (T013–T020), config (T021–T022), sesiones (T023–T025) y observabilidad (T026–T027) son pistas paralelas independientes
- Una vez completado Foundational, US-1, US-3 y US-6 pueden avanzar en paralelo
- Dentro de US-2: los adapters de backend (T046–T057) y el paquete `packages/selector-carrito` (T058–T072) son pistas paralelas; ambas deben converger antes de T075 (build del embed)
- Dentro de US-3: `ocultar-envios` y `renombrar-recogida` son completamente paralelas entre sí

---

## Parallel Example: User Story 2

```bash
# Backend (una persona/agente):
Task: "Implementar FuentePuntosShopify en app/infrastructure/shopify/fuentePuntosShopify.server.ts"
Task: "Implementar CachePuntosMemoria en app/infrastructure/cache/cachePuntosMemoria.server.ts"

# Cliente de carrito (otra persona/agente), en paralelo:
Task: "Implementar filtroPuntos.ts en packages/selector-carrito/src/dominio/filtroPuntos.ts"
Task: "Implementar revalidacion.ts en packages/selector-carrito/src/dominio/revalidacion.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3, todas P1)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO — bloquea todo)
3. Completar Phase 3 (US-1), Phase 4 (US-2) y Phase 5 (US-3) — juntas forman el flujo completo mínimo:
   comerciante carga puntos → comprador elige uno → checkout lo respeta
4. **STOP and VALIDATE**: recorrer un pedido resolado completo de punta a punta
5. Desplegar/demostrar si está listo

### Incremental Delivery

1. Setup + Foundational → base lista
2. US-1 + US-2 + US-3 → MVP funcional de punta a punta → demo
3. US-4 → el pedido conserva y muestra el punto → demo
4. US-5 → onboarding de comerciante sin soporte manual → demo
5. US-6 → despliegue portable en la nube → demo
6. US-7 → modo demo para evaluadores/revisión de Shopify → demo
7. Polish + Distribución → publicación en App Store

### Notas específicas de esta feature

- Los tres runtimes que comparten claves de atributos y lógica de tarifa (backend, cliente de carrito, wasm de
  las Functions) deben depender siempre de `packages/contratos`; nunca duplicar `CLAVES_ATRIBUTO` ni
  `TITULO_TARIFA_RECOGIDA` a mano
- `assets/selector-punto.js` es generado por esbuild (T075) y no debe editarse a mano
- Las Functions (US-3) son las únicas piezas de las que depende la garantía "sin backend, las reglas de
  checkout se mantienen" (NFR-07) — no introducir llamadas de red en su núcleo puro
- `shopify.app.dev.toml` y `shopify.app.toml` deben mantenerse sincronizados en cada cambio al bloque del
  metaobjeto (T040/T041) y a los webhooks
