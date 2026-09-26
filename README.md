# Puntos de Recogida

App de Shopify que resuelve la recogida en tienda (*click & collect*) sin necesitar el plan **Shopify
Plus**: el comprador elige un punto de recogida en el carrito, el checkout de ese pedido solo ofrece la
opción de recogida en ese punto (las demás tarifas quedan ocultas) y el pedido guarda una copia
inmutable del punto elegido, visible en la página de estado del pedido del cliente.

> Este documento es la referencia completa del proyecto: qué hace la app, cómo está construida, cómo
> ponerla en marcha, cómo desplegarla y cómo solucionar los problemas más comunes. Los comandos se dan en
> bash y, cuando difieren, también en PowerShell.

## Índice

1. [Qué es y qué problema resuelve](#1-qué-es-y-qué-problema-resuelve)
2. [Cómo funciona todo](#2-cómo-funciona-todo)
3. [Conceptos de Shopify necesarios](#3-conceptos-de-shopify-necesarios)
4. [Arquitectura del código](#4-arquitectura-del-código)
5. [Requisitos previos](#5-requisitos-previos)
6. [Puesta en marcha local](#6-puesta-en-marcha-local)
7. [Configuración de la tienda](#7-configuración-de-la-tienda)
8. [Functions: de TypeScript a WebAssembly](#8-functions-de-typescript-a-webassembly)
9. [El app embed](#9-el-app-embed)
10. [La extensión de pedido](#10-la-extensión-de-pedido)
11. [La página de admin](#11-la-página-de-admin)
12. [Pruebas](#12-pruebas)
13. [Despliegue del backend: arquitectura abstraída](#13-despliegue-del-backend-arquitectura-abstraída)
14. [Despliegue en Google Cloud paso a paso](#14-despliegue-en-google-cloud-paso-a-paso)
15. [Despliegue de extensiones y configuración de Shopify](#15-despliegue-de-extensiones-y-configuración-de-shopify)
16. [Agregar otro proveedor](#16-agregar-otro-proveedor)
17. [Distribución en el App Store](#17-distribución-en-el-app-store)
18. [Operación y observabilidad](#18-operación-y-observabilidad)
19. [Seguridad y privacidad](#19-seguridad-y-privacidad)
20. [Solución de problemas](#20-solución-de-problemas)
21. [Límites conocidos y decisiones](#21-límites-conocidos-y-decisiones)
22. [Hoja de ruta v2+](#22-hoja-de-ruta-v2)
23. [Glosario y referencias](#23-glosario-y-referencias)

El diseño completo (requisitos, decisiones, contratos entre piezas) vive en
[`specs/001-puntos-recogida/spec.md`](specs/001-puntos-recogida/spec.md); este README resume lo que hace
falta para trabajar en el día a día sin tener que leer ese documento entero. El progreso de construcción,
sesión a sesión, está en [`specs/001-puntos-recogida/progreso.md`](specs/001-puntos-recogida/progreso.md).

## 1. Qué es y qué problema resuelve

Sin Shopify Plus, un comerciante no tiene forma nativa de decir "para *este* pedido, solo ofrece recogida
en *este* punto concreto, y oculta las demás formas de envío". Las herramientas nativas (tarifas de envío,
Delivery Customizations) trabajan sobre *todo el carrito según su dirección*, no sobre "este carrito es
distinto porque viene de un flujo externo de recogida".

Esta app resuelve ese caso con piezas que **sí** están disponibles en cualquier plan (salvo Starter):
metaobjetos app-owned para los puntos, una theme app extension para elegir el punto en el carrito,
Delivery Customization Functions para ocultar/renombrar tarifas en el checkout, y una customer account UI
extension para mostrar el punto elegido en la página de pedido. Nada de esto usa APIs exclusivas de Plus.

**Flujo que ve el comerciante**: carga sus puntos de recogida en Contenido → Metaobjetos (interfaz nativa,
sin pantallas propias de la app), crea una tarifa de envío manual llamada exactamente "Recogida en punto de
entrega" en todas sus zonas, activa el app embed en el editor de temas y activa 2 personalizaciones de
entrega desde la página de la app. Todo eso se hace una sola vez.

**Flujo que ve el comprador** (en un carrito marcado externamente como "resolado", ver
[§3](#3-conceptos-de-shopify-necesarios)): ve un selector de puntos de recogida junto a los botones de
checkout, elige uno, y al llegar al checkout la única opción de entrega es "Recogida en punto de entrega ·
`<nombre del punto>`". El resto de tarifas (Estándar, Exprés, …) no aparecen. Tras pagar, la página de
estado del pedido muestra el punto elegido con nombre, dirección y un enlace a Google Maps.

## 2. Cómo funciona todo

### 2.1 Diagrama de componentes

```text
                ┌──────────────────────────────────────────────────────────────────┐
                │ [T] Backend de la app · contenedor OCI · React Router · Node 24  │
                │     rutas → casos de uso → puertos ← adaptadores                 │
                │     (Admin API de Shopify · Firestore · memoria · logs JSON)     │
                └──────▲──────────────────────▲──────────────────────▲─────────────┘
                       │ session token        │ App Proxy (HMAC)     │ webhooks (HMAC)
                       │                      │                      │
   [S] Página de admin ┘        [S] App embed (tema)                 Shopify
       (iframe · Polaris)           │ lee /cart.js · escribe /cart/update.js
                                    ▼
 [D] Metaobjetos             [D] Atributos del carrito ──copia al pagar──▶ [D] Atributos del pedido
     $app:punto_recogida          │ input query                                │ Attributes API
     ▲ Admin API (solo backend)   ▼                                            ▼
                             [S] Functions (wasm, sin red)            [S] Extensión de página de pedido
                                 ocultar-envios · renombrar-recogida      punto-pedido (Preact)

 [T] lo hospeda la app (proveedor intercambiable)   [S] código de la app que ejecuta Shopify
 [D] datos que viven en Shopify
```

Las Functions no tienen ninguna flecha hacia el backend: **no hacen ninguna llamada de red**, ni falta que
les hace. Es la garantía de que el checkout nunca depende de que el backend esté arriba (NFR-07).

### 2.2 Recorrido de punta a punta

1. **Instalación.** OAuth con *token exchange* (app embebida). La sesión offline de la tienda se guarda en
   el `SessionStorage` configurado (memoria en desarrollo, Firestore en producción). `shopify app deploy`
   ya dejó creada la definición del metaobjeto y registradas las extensiones, las Functions, el App Proxy y
   los webhooks: nada de eso se crea "a mano" desde el backend.
2. **Configuración.** El comerciante carga los puntos, crea la tarifa en todas las zonas, activa el embed
   con el deep link que ofrece la página de admin, pulsa "Activar" (el backend ejecuta
   `deliveryCustomizationCreate` una vez por cada una de las 2 Functions) y agrega el bloque de pedido.
3. **Carrito.** Un sistema externo al carrito (un flujo de reserva, un botón "Recoger en tienda", lo que
   sea) escribe el atributo `tipo_carrito=resolado` en el carrito. El app embed lo detecta (al cargar la
   página o al reevaluar tras un cambio) y pide `GET /apps/puntos-recogida/puntos`. Shopify firma esa
   petición y la reenvía a `/proxy/puntos` en el backend; el backend verifica la firma HMAC, obtiene un
   cliente Admin API con la sesión offline de esa tienda, responde desde caché o pagina los metaobjetos, y
   devuelve el JSON de puntos.
4. **Selección.** El comprador elige un punto en el combobox; el widget hace
   `POST /cart/update.js` con los 7 atributos `punto_*` (el *snapshot* del punto) y el checkout se
   habilita (antes de elegir, queda bloqueado).
5. **Checkout.** Shopify calcula las tarifas de envío según la zona de la dirección del comprador (todas
   las que apliquen, incluida "Recogida en punto de entrega") y ejecuta las 2 Functions con su input query.
   `ocultar-envios` oculta todo lo que no sea esa tarifa; `renombrar-recogida` la renombra con el nombre del
   punto elegido. El comprador ve una sola opción de entrega, ya renombrada.
6. **Pedido.** Al pagar, Shopify copia los atributos del carrito a `Order.customAttributes`. Esa copia ya
   no cambia aunque el punto original se edite o se borre después: es la garantía de "snapshot inmutable"
   (US-4).
7. **Página de pedido.** La extensión `punto-pedido` lee `shopify.attributes` (reactivo) en la página de
   estado del pedido del cliente y, si hay una selección, muestra nombre, dirección y un enlace a Google
   Maps con las coordenadas.

### 2.3 Por qué existe cada pieza

| Pieza | Por qué existe |
|---|---|
| Metaobjeto `$app:punto_recogida` | Fuente de datos de los puntos, con el CRUD nativo del admin ya construido por Shopify: la app no necesita pantallas propias para gestionar puntos |
| App Proxy (`/proxy/puntos`) | El carrito (Liquid/JS del storefront) no puede llamar directo a la Admin API; el proxy es la única forma segura (firmada por Shopify) de exponer datos de la tienda al navegador del comprador |
| `packages/selector-carrito` + extensión `selector-punto` | El *widget* que el comprador ve y usa; vive en el tema, no en un iframe, para poder leer/escribir el carrito directamente |
| Functions `ocultar-envios`/`renombrar-recogida` | La única garantía real de que el checkout muestra lo correcto: corren dentro del propio cálculo del checkout, sin red, así que no dependen de que nada más esté funcionando |
| Extensión `punto-pedido` | Sin ella, el cliente no vería en ningún sitio propio de Shopify qué punto había elegido después de pagar |
| Página de admin | Guía al comerciante a través de una configuración con piezas repartidas en 4 sitios distintos del admin (metaobjetos, envíos, editor de temas, personalizaciones de entrega, checkout) |
| CLI de despliegue (`deploy/`) | El backend necesita vivir en algún proveedor de nube; la CLI lo abstrae para no atar el proyecto a uno solo |

## 3. Conceptos de Shopify necesarios

- **App pública frente a custom**: una *custom app* solo se instala en una tienda concreta y, si usa
  Shopify Functions, exige plan Plus. Una *app pública* (aunque tenga visibilidad limitada, sin listing
  buscable) funciona en cualquier plan salvo Starter. Por eso esta app se distribuye como pública con
  visibilidad limitada ([§17](#17-distribución-en-el-app-store)), no como custom.
- **Metaobjetos app-owned (`$app:`)**: un tipo de dato cuya *definición* pertenece a la app (se declara en
  `shopify.app.toml` y se crea/actualiza con cada `shopify app deploy`), pero cuyas *entradas* las gestiona
  el comerciante con el CRUD nativo del admin. Desde la API 2026-04 la app dueña de un metaobjeto `$app:` lo
  usa sin necesitar scopes adicionales.
- **App Proxy y firma HMAC**: una ruta bajo el dominio de la tienda (aquí,
  `/apps/puntos-recogida/*`) que Shopify reenvía, firmada, al backend de la app. Solo puede haber un app
  proxy por app. `authenticate.public.appProxy` (del paquete `@shopify/shopify-app-react-router`) verifica
  la firma antes de que el código de la ruta se ejecute; si falla, corta con un 400 antes de llegar al
  `loader`.
- **Theme app extensions y app embeds**: bloques de una extensión que el comerciante activa desde el
  editor de temas. Un *app embed* se inyecta antes de `</body>` en todas las páginas del tema. La app **no
  puede activarlo por sí sola**: solo puede ofrecer un *deep link*
  (`context=apps&activateAppId={api_key}/{handle}`) que abre el editor de temas con el interruptor listo
  para pulsar.
- **Functions y WebAssembly**: código que Shopify ejecuta *dentro* del cálculo del checkout, compilado a un
  módulo WebAssembly. No tiene red, sistema de archivos ni reloj: solo recibe un input (vía GraphQL) y
  devuelve operaciones. Por eso el checkout nunca depende de que el backend esté disponible.
- **Delivery customizations**: el registro de la tienda que activa una Function de personalización de
  entrega. Las operaciones disponibles son ocultar (`deliveryOptionHide`), renombrar
  (`deliveryOptionRename`) y mover (`deliveryOptionMove`); esta app usa las dos primeras. Máximo 25
  personalizaciones por tienda (de cualquier app).
- **Customer account UI extensions**: extensiones que corren en la página de cuenta del cliente (incluida
  la página de estado del pedido), con componentes propios (`s-*`) y una API reactiva
  (`shopify.attributes`, `shopify.i18n`) en vez de DOM directo.
- **Atributos del carrito y su copia al pedido**: el carrito de Shopify admite atributos libres
  (clave/valor) que cualquier script puede leer o escribir vía la Ajax Cart API
  (`/cart.js`, `/cart/update.js`). Al completarse la compra, Shopify copia esos atributos a
  `Order.customAttributes` **tal cual estaban en ese momento**: es una copia inmutable, no una referencia.

## 4. Arquitectura del código

### 4.1 Estructura del repositorio

```text
app/                                    # Backend (React Router 7, Node 24)
├── domain/                             # Entidades y reglas puras (PuntoRecogida, errores)
├── application/
│   ├── ports/                          # Interfaces que necesita la aplicación
│   └── use-cases/                      # Un caso de uso por módulo
├── infrastructure/                     # Adaptadores concretos (*.server.ts): Shopify, Firestore, memoria, logs
├── composition/                        # Composition root (contenedor.server.ts)
├── routes/                             # Controladores delgados (React Router)
├── i18n/es.ts                          # Textos en español de la página de admin
└── config/                             # Validación de variables de entorno (CT-09)

packages/
├── contratos/                          # @puntos-recogida/contratos: constantes y funciones puras compartidas
└── selector-carrito/                   # JS del carrito: dominio → aplicación → infraestructura (DOM/fetch)

extensions/
├── selector-punto/                     # Theme app extension (bloque + assets del selector)
├── ocultar-envios/                     # Delivery Customization Function
├── renombrar-recogida/                 # Delivery Customization Function
└── punto-pedido/                       # Customer account UI extension (Preact)

deploy/                                 # CLI de despliegue portable (dominio → aplicación → proveedores)

specs/001-puntos-recogida/              # spec.md (diseño completo), tasks.md, progreso.md
```

### 4.2 Capas por pieza (Clean Architecture proporcional)

| Pieza | Capas | Regla de dependencias |
|---|---|---|
| Backend (`app/`) | `domain` → `application` (`ports`, `use-cases`) → `infrastructure` (`*.server.ts`) → `composition` → `routes` | El dominio no importa nada externo; la aplicación importa solo dominio y puertos; la infraestructura implementa puertos; las rutas solo invocan casos de uso que les entrega el contenedor |
| Functions (`extensions/ocultar-envios`, `extensions/renombrar-recogida`) | `src/dominio/*` (decisión pura) + adaptador generado por la CLI (input → dominio → operaciones) | El dominio no conoce los tipos generados de Shopify; el adaptador traduce |
| JS del carrito (`packages/selector-carrito`) | `dominio` (puro) → `aplicacion` (controlador y puertos) → `infraestructura` (DOM, `fetch`) → `main.ts` | El dominio no toca ni DOM ni red |
| Extensión de pedido (`extensions/punto-pedido`) | Lectura pura de la selección (desde contratos) + presentador Preact | Sin red |
| CLI de despliegue (`deploy/`) | `dominio` → `aplicacion` (orquestador) → `puertos` → `proveedores/*` / `infraestructura` | El orquestador no sabe nada de `gcloud` |
| Contratos (`packages/contratos`) | Constantes y funciones puras, sin dependencias | Lo importan todas las piezas |

### 4.3 SOLID aplicado

| Principio | Dónde se ve |
|---|---|
| **S**RP | Un caso de uso por módulo (`ListarPuntosRecogida`, `ActivarPersonalizacionesEntrega`, …). Una Function oculta, otra renombra |
| **O**CP | Un proveedor de nube nuevo es una carpeta nueva en `deploy/src/proveedores/<nombre>` más un registro, sin tocar el orquestador ([§16](#16-agregar-otro-proveedor)) |
| **L**SP | Suites de contract tests compartidas para `SessionStorage` (Firestore y memoria) y para `ProveedorDespliegue` (con un `EjecutorComandos` falso) |
| **I**SP | Puertos pequeños y específicos: `FuentePuntos`, `CachePuntos`, `GatewayPersonalizaciones`, `Registro`, `Reloj`, `ClienteCarrito`, `ClientePuntos`, `EjecutorComandos`, … |
| **D**IP | Los casos de uso y el controlador del carrito reciben sus puertos por constructor; los composition roots (`app/composition/contenedor.server.ts`, `packages/selector-carrito/src/main.ts`, `deploy/src/cli.ts`) eligen las implementaciones concretas |

### 4.4 `@puntos-recogida/contratos`: qué tocar para cada tipo de cambio

Es la fuente única de verdad para todo lo que dos o más piezas deben interpretar igual: las 8 claves de
atributo del carrito (`packages/contratos/src/atributos.ts`), el título exacto de la tarifa
(`tarifa.ts`), los límites compartidos (`limites.ts`) y las funciones de normalización de texto
(`normalizacion.ts`) que usan tanto las Functions como el backend. Una guía rápida de qué archivo tocar
según el cambio que se necesite:

| Cambio que se quiere hacer | Dónde empezar |
|---|---|
| Agregar un campo al punto de recogida | `shopify.app.toml`/`shopify.app.dev.toml` (metaobjeto) → `app/domain/puntoRecogida.ts` → `packages/contratos/src/dto.ts` → adaptadores que leen/escriben el metaobjeto |
| Cambiar una regla del checkout (ocultar/renombrar) | `extensions/ocultar-envios/src/dominio` o `extensions/renombrar-recogida/src/dominio` (nunca el adaptador generado) |
| Cambiar qué se muestra en el selector del carrito | `packages/selector-carrito/src/infraestructura/VistaComboboxDom.ts` y sus locales en `extensions/selector-punto/locales/` |
| Cambiar qué se guarda en el pedido | `packages/contratos/src/atributos.ts` (las 7 claves `punto_*`) — cambia el contrato entre carrito, Functions y extensión de pedido a la vez |
| Agregar un proveedor de nube | Ver [§16](#16-agregar-otro-proveedor) |

## 5. Requisitos previos

| Herramienta | Versión | Notas |
|---|---|---|
| [Node.js](https://nodejs.org/) | 24 LTS | `engine-strict=true` en `.npmrc`: `npm install` falla con una versión distinta |
| [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) | 3.93.x o superior | Se instala como dependencia del proyecto (`@shopify/cli` en `package.json`); no hace falta instalarlo aparte |
| [gcloud CLI](https://cloud.google.com/sdk/docs/install) | Reciente | Solo para desplegar contra el proveedor de referencia (Google Cloud); no hace falta para desarrollar |
| Cuenta de [Shopify Partners](https://www.shopify.com/partners) | — | Para crear la app de desarrollo y una development store |
| Development store | Dawn y Horizon instalados | Uno publicado, el otro en vista previa; cuentas de cliente nuevas habilitadas |
| Proyecto de Google Cloud con facturación | — | Solo para el despliegue de referencia ([§14](#14-despliegue-en-google-cloud-paso-a-paso)) |

Verificación rápida:

```bash
node -v          # v24.x
npx shopify version
gcloud --version # solo si vas a desplegar
```

## 6. Puesta en marcha local

```bash
# 1. Instalar dependencias (workspaces: app, packages/*, extensions/*, deploy)
npm install

# 2. Enlazar (o crear) la app de desarrollo: genera shopify.app.dev.toml
npm run config:link

# 3. Variables de entorno
cp .env.example .env            # bash
copy .env.example .env          # PowerShell
# En desarrollo: SESSION_STORAGE_DRIVER=memoria (ya es el valor por defecto)

# 4. Arrancar: watch del embed + shopify app dev (túnel, instalación en la dev store,
#    vista previa de extensiones y recompilación de las Functions al guardar)
npm run dev
```

`shopify app dev` se ejecuta **siempre** con la configuración de desarrollo
(`shopify.app.dev.toml`); nunca con `shopify.app.toml` (la de producción). Con la app instalada en la
development store, seguí con [§7](#7-configuración-de-la-tienda) y probá el flujo completo con el **modo
demo** del embed ([§9](#9-el-app-embed)) para no depender de un sistema externo que escriba
`tipo_carrito=resolado`.

Las 16 variables de entorno de `.env.example` corresponden al contrato CT-09 de `spec.md` §13; ninguna
trae un valor secreto real en el archivo de ejemplo.

## 7. Configuración de la tienda

Una vez instalada la app, el comerciante (o quien esté probando en la development store) completa 5 pasos,
en el orden que también sigue la [página de admin](#11-la-página-de-admin):

1. **Puntos de recogida**: Contenido → Metaobjetos → "Punto de recogida" → crear entradas con
   Identificador, Nombre, Dirección, Dirección (formato reducido), Latitud y Longitud. Para probar a
   escala, la página de admin ofrece "Crear puntos de ejemplo" (600 puntos) cuando `HABILITAR_SEMILLA=true`
   en desarrollo — **nunca** en producción, el arranque falla si se combina con `NODE_ENV=production`.
2. **Tarifa de recogida**: Configuración → Envío y entrega → crear una tarifa de envío manual llamada
   **exactamente** "Recogida en punto de entrega", con el precio que se prefiera, en **todas las zonas de
   todos los perfiles de envío** que puedan participar en un carrito resolado. Si falta en alguna zona, esos
   checkouts se quedan sin ninguna opción de entrega (ver [§20](#20-solución-de-problemas)).
3. **App embed**: Tienda online → Temas → Personalizar → App embeds → activar "Punto de recogida" (o usar
   el deep link que ofrece la página de admin) y Guardar.
4. **Personalizaciones de entrega**: desde la página de la app, botón "Activar" (crea las 2 delivery
   customizations, una por Function). También se pueden revisar en Configuración → Envío y entrega →
   Personalizaciones de entrega.
5. **Bloque de pedido**: Configuración → Checkout → Personalizar → página de estado del pedido → Agregar
   bloque de app → "Punto de recogida".

Además: **cuentas de cliente nuevas** habilitadas (la extensión de pedido vive en la customer account) y,
si se quiere completar pedidos de prueba, la pasarela **Bogus Gateway**.

## 8. Functions: de TypeScript a WebAssembly

`extensions/ocultar-envios` y `extensions/renombrar-recogida` son Delivery Customization Functions escritas
en TypeScript y compiladas a WebAssembly por la Shopify CLI. El flujo reproducible:

1. **Instalar**: `npm install` en la raíz (instala también `@puntos-recogida/contratos`, que ambas
   Functions importan).
2. **Regenerar tipos** tras cambiar una input query (`src/*.graphql`):
   ```bash
   cd extensions/ocultar-envios && npm run typegen   # o: shopify app function typegen
   ```
   Actualiza `generated/api.ts`.
3. **Compilar**: `npm run build` dentro de la carpeta de la extensión (o `shopify app build` en la raíz,
   para todas las extensiones a la vez). La CLI empaqueta el TypeScript con esbuild — lo que incluye
   `@puntos-recogida/contratos` — y lo compila con **Javy** a `dist/function.wasm`. Javy incrusta el motor
   JavaScript QuickJS; el runtime que ejecuta el módulo lo aporta Shopify, por eso el binario resultante es
   pequeño.
4. **Ejecutar en local** contra un fixture:
   ```bash
   shopify app function run --input tests/fixtures/07-peor-caso-10-grupos-20-opciones.json --export run
   ```
   (el nombre del `export` está en `shopify.extension.toml` de cada extensión). El comando imprime la
   salida **y las instrucciones consumidas**.
5. **Probar**: `npm test` corre los tests unitarios del núcleo (Vitest, sobre `src/dominio/*`) y, cuando el
   wasm está compilado, los fixtures de `tests/fixtures/*.json` sobre ese wasm con el harness de la CLI.
6. **Desarrollar contra la tienda**: `shopify app dev` recompila al guardar. Las ejecuciones reales en la
   development store quedan en `.shopify/logs/`, visibles con `shopify app logs`, y se pueden copiar a
   `tests/fixtures/` como casos nuevos.
7. **Desplegar**: `shopify app deploy` sube el wasm dentro de la versión de la app — no hay un despliegue
   aparte para las Functions (ver [§15](#15-despliegue-de-extensiones-y-configuración-de-shopify)).

### Límites vigentes

Según lo verificado en el Anexo A de `spec.md` (2026-09-25; **confirmar contra la documentación vigente de
shopify.dev antes de cada release**, porque estos límites pueden cambiar entre versiones de la API):
del orden de **256 kB** de tamaño de binario, **128 kB** de tamaño de input, **11 millones** de
instrucciones y **20 kB** de tamaño de output.

### Cómo leer el conteo de instrucciones y sumar fixtures desde los logs

`shopify app function run` imprime, junto con la salida, el número de instrucciones que consumió esa
ejecución concreta. El presupuesto del proyecto (NFR-06) exige que el **fixture de peor caso** — 10 grupos
de entrega × 20 opciones cada uno, `tests/fixtures/07-peor-caso-10-grupos-20-opciones.json` en
`ocultar-envios` y `tests/fixtures/04-peor-caso-10-grupos-20-opciones.json` en `renombrar-recogida` — se
quede por debajo del **50 %** de ese límite, para dejar margen frente a cambios futuros del checkout
(más métodos de envío, más zonas). Para sumar una ejecución real de la development store como fixture
nuevo: copiar el JSON de `.shopify/logs/` a `tests/fixtures/<nombre>.json` con la forma
`{ export, target, input, output }` y agregarlo a la suite de Vitest de esa extensión.

**Conteo real de instrucciones del fixture de peor caso: pendiente de medir.** No se pudo ejecutar
`shopify app function run` en la sesión cloud porque `shopify app function schema` devuelve 403 sin una
app vinculada a Shopify Partners (T001, sin acceso en la sesión cloud; ver
`specs/001-puntos-recogida/progreso.md`, sesión 6 y "Pendiente de validar en plataforma"). Con Partners
disponible, el procedimiento es: `npm run typegen && npm run build` en cada extensión y luego el comando
del paso 4 sobre el fixture de peor caso de cada una; anotar aquí el resultado (instrucciones consumidas y
porcentaje del límite) en cuanto se mida.

### Plan B: Rust

Si una medición real muestra que el peor caso supera el 50 % del límite de instrucciones (DEC-07), el plan
es generar la misma Function con `shopify app generate extension --template delivery_customization
--flavor rust` y portar el núcleo de decisión (no la traducción de tipos generados) a Rust, compilando con
`cargo build --target=wasm32-unknown-unknown --release`. Los contratos compartidos y los fixtures de test
se conservan tal cual: solo cambia el lenguaje del adaptador, no el contrato de entrada/salida. Rust (u
otro lenguaje que compile directo a wasm) rinde más que JavaScript/TypeScript en instrucciones consumidas y
es lo que Shopify recomienda para apps públicas de alto volumen; TypeScript es válido igualmente para el
resto de los casos.

## 9. El app embed

`extensions/selector-punto` es una theme app extension de tipo `theme` con un único bloque de app embed
(`blocks/selector-punto.liquid`). Su JavaScript vive en `packages/selector-carrito` (dominio → aplicación →
infraestructura del navegador) y se empaqueta con **esbuild**:

```bash
npm run build:embed
```

`packages/selector-carrito/build.mjs` genera un único archivo IIFE, minificado, en
`extensions/selector-punto/assets/selector-punto.js`, y **falla el build si supera 20 KB** (NFR-03,
margen ajustado: el bundle actual ronda ese límite, así que cualquier cambio a este paquete debe vigilar el
peso de cerca). `npm run dev` lo ejecuta en modo watch (`npm run build:embed:watch`, que avisa del peso en
cada rebuild sin cortar el watch) junto a `shopify app dev` mediante `scripts/dev.mjs`, sin dependencias
extra, así que funciona igual en PowerShell y en bash.

**Ajustes editables por el comerciante** (ver `extensions/selector-punto/locales/es.default.schema.json`):

| Ajuste | Para qué sirve |
|---|---|
| `titulo` | Encabezado del selector |
| `texto_ayuda` | Texto bajo el título (editable; por defecto explica que la dirección exacta se confirma con el punto elegido) |
| `selector_botones_checkout` | Selector CSS de los botones junto a los que se inserta el widget y que la guardia bloquea sin selección |
| `selector_pagos_acelerados` | Selector CSS de los contenedores de pago acelerado, que se ocultan mientras no haya punto elegido |
| `selector_insercion` (opcional) | Si se completa, el widget se inserta ahí en lugar de justo antes de los botones de checkout |
| `selector_contextos_compactos` | Selector CSS de zonas donde solo cabe un enlace breve al carrito (p. ej. la notificación de carrito) |
| `modo_demo` | Solo para pruebas: muestra un interruptor que simula un carrito resolado sin depender de un sistema externo — **desactivar antes de producción** |

**Compatibilidad con temas**: la app no asume un tema concreto (Dawn, Horizon o cualquier otro custom):
todo lo que cambia entre temas son los 4 selectores CSS de arriba, configurables desde el editor de temas
sin tocar código. La Function del checkout es la garantía real; el widget es una ayuda para el comprador.

**Adaptar los selectores a un tema nuevo**: inspeccionar en el navegador los botones de checkout del
carrito (`/cart` y el drawer) de ese tema, copiar un selector CSS que los identifique de forma estable
(clase o atributo, no texto) y pegarlo en el ajuste correspondiente del editor de temas.

**Depurar en el navegador**: `ObservadorCarritoDom` envuelve `fetch` para detectar cualquier
`POST /cart/update.js` (incluido el del propio widget) y disparar una reevaluación; `console.log` en el
`main.ts` del composition root (`packages/selector-carrito/src/main.ts`) es el punto de entrada más simple
para trazar el estado del selector (`EstadoSelector`) paso a paso. El modo demo es la forma más rápida de
forzar un carrito resolado sin depender de nada externo.

## 10. La extensión de pedido

`extensions/punto-pedido` es una customer account UI extension (Preact + TypeScript) que se coloca como
bloque de app en la página de estado del pedido. Lee `shopify.attributes` (reactivo) y, si hay una
selección de punto (`punto_id` no vacío), muestra una sección con el nombre del punto, su dirección y un
enlace a Google Maps (validando que la latitud y la longitud estén en rango antes de armar el enlace). Si
no hay selección, no renderiza nada — no hace ninguna petición de red.

**Colocarla**: es un *block target*, así que el comerciante la agrega desde Configuración → Checkout →
Personalizar → página de estado del pedido → Agregar bloque de app → "Punto de recogida"
([§7](#7-configuración-de-la-tienda), paso 5). La CLI la empaqueta con `shopify app deploy`;
`shopify app dev` ofrece vista previa.

## 11. La página de admin

`app/routes/app._index.tsx` muestra 5 pasos de configuración, en el mismo orden que [§7](#7-configuración-de-la-tienda):

1. **Puntos de recogida** — estado real: cuántos puntos existen (vía `metaobjectDefinitionByType`,
   `metaobjectsCount`), con acceso directo a Contenido → Metaobjetos.
2. **Tarifa "Recogida en punto de entrega"** — no es consultable por API (una tarifa de envío manual no es
   una entidad con API propia), así que su "estado" es siempre "Verificar manualmente" con las
   instrucciones y un acceso directo a Configuración → Envío y entrega.
3. **App embed "Punto de recogida"** — tampoco es consultable (la activación de un embed no es legible
   desde la Admin API); "Verificar manualmente" con el deep link al editor de temas.
4. **Personalizaciones de entrega** — estado real por cada una: activa, inactiva o inexistente (vía
   `deliveryCustomizations`); un botón "Activar" ejecuta `deliveryCustomizationCreate`/`Update` para las 2
   Functions a la vez.
5. **Bloque en la página de pedido** — no consultable; "Verificar manualmente" con el acceso directo a
   Configuración → Checkout → Personalizar.

Todo el estado que se puede leer sale de Shopify en cada carga (`loader` → `ObtenerEstadoConfiguracion`);
si la consulta falla, la página muestra un banner con "Reintentar" en vez de romper. En desarrollo, con
`HABILITAR_SEMILLA=true`, aparece además la sección "Datos de ejemplo" para crear 600 puntos de prueba.

## 12. Pruebas

```bash
npm test              # todas las suites (Vitest workspace + fixtures de las Functions)
npm run test:coverage # igual, con reporte de cobertura (umbral: 90% en dominio y aplicación)
npm run typecheck     # react-router typegen + tsc --noEmit en todos los workspaces
npm run lint          # ESLint (incluida la regla de imports del FR-083)
```

Cada workspace tiene su propio `vitest.config.ts` (nombre, entorno — `node` o `jsdom` —, patrón de
`include`); `vitest.config.ts` en la raíz los agrupa con `test.projects` para que `npm test` corra todo de
una vez y `npm run test:coverage` agregue la cobertura de todos.

**Qué cubre cada capa**:

- **Dominio y aplicación** (`app/domain`, `app/application`, `packages/contratos`,
  `packages/selector-carrito/src/{dominio,aplicacion}`, `extensions/*/src/dominio`,
  `deploy/src/{dominio,aplicacion}`): tests unitarios con Vitest, sin mocks de infraestructura real (los
  puertos se sustituyen por dobles de test). Es el código con el umbral de cobertura del 90 % de línea.
- **Infraestructura** (adaptadores `*.server.ts`, DOM, `gcloud`): tests de comportamiento contra dobles
  (por ejemplo, un `EjecutorComandos` falso que registra los comandos que se le piden ejecutar) o contra
  jsdom para el código de navegador. No cuenta para el umbral de cobertura de dominio/aplicación.
- **Functions**: unitarias sobre el núcleo (`src/dominio/*`, una por fila de cada tabla de decisión del
  spec) y, cuando el wasm está compilado, fixtures reales ejecutados con el harness de la CLI
  ([§8](#8-functions-de-typescript-a-webassembly)).
- **Contract tests**: `SessionStorage` (Firestore y memoria) y `ProveedorDespliegue` comparten la misma
  suite de tests contra la interfaz, para que cualquier implementación nueva se valide contra el mismo
  contrato ([§4.3](#43-solid-aplicado), LSP).

**Checklist E2E manual**: el Anexo B de `spec.md` (25 casos, E2E-01 a E2E-25) se ejecuta a mano en la
tienda de prueba, en Dawn y Horizon, en `/cart` y en el drawer, en escritorio y en móvil. No se pudo
correr en la sesión cloud (sin development store disponible); queda como tarea de la fase de testing junto
con la auditoría de accesibilidad WCAG 2.1 AA y la medición de Lighthouse (NFR-04).

**Estado al cerrar esta sesión**: `npm test` (240 tests, 6 omitidos — los contract tests de Firestore que
necesitan el emulador), `npm run typecheck` y `npm run lint` sin errores. Cobertura de línea en los
directorios de dominio/aplicación listados arriba: 100 % en `app/domain`, `packages/contratos`,
`packages/selector-carrito/src/dominio`, `extensions/ocultar-envios/src/dominio`,
`extensions/renombrar-recogida/src/dominio` y `deploy/src/dominio`; 98.3 % en `app/application`; 95.2 % en
`packages/selector-carrito/src/aplicacion`; 90.0 % en `deploy/src/aplicacion` — todos por encima del umbral
del 90 % (T135).

## 13. Despliegue del backend: arquitectura abstraída

El backend corre en cualquier proveedor que ofrezca contenedores OCI escuchando en `PORT` con un
`/healthz`. La abstracción vive en `deploy/`, que **nunca** importa un SDK de nube fuera de
`deploy/src/proveedores/**` (regla de ESLint del FR-083):

| Carpeta | Contenido |
|---|---|
| `deploy/src/dominio/` | `ConfigDespliegue` (esquema zod de `deploy.config.json`), el plan de pasos y los 4 errores del §20.3 (`ConfiguracionInvalidaError`, `PrerrequisitoError`, `ComandoFallidoError`, `ProveedorNoImplementadoError`) |
| `deploy/src/puertos/` | `ProveedorDespliegue`, `EjecutorComandos` y `Consola` |
| `deploy/src/aplicacion/OrquestadorDespliegue.ts` | Ejecuta los pasos en orden, sin saber de ningún proveedor concreto |
| `deploy/src/proveedores/registro.ts` | Mapa nombre → fábrica del proveedor (en v1 solo `gcp`) |
| `deploy/src/proveedores/gcp/` | `ProveedorGcp`: usa solo `EjecutorComandos` para invocar `gcloud` |
| `deploy/src/proveedores/plantilla/` | Esqueleto documentado para un proveedor nuevo, no registrado |
| `deploy/src/infraestructura/EjecutorComandosNode.ts` | `child_process.spawn` sin shell, secretos por stdin; en `--dry-run` solo imprime (enmascarando secretos) |
| `deploy/src/cli.ts` | Composition root: lee opciones, carga `deploy.config.json` y `.env.deploy`, elige el proveedor e invoca el orquestador |

**Pasos del orquestador** (`npm run deploy -- --proveedor <nombre>`, o `--paso <uno-de-ellos>` para
ejecutar solo ese paso tras validar la configuración): validar configuración →
`verificarPrerrequisitos` → `prepararInfraestructura` → `publicarSecretos` → `construirImagen` →
`desplegarServicio` → (si la URL real difiere de `SHOPIFY_APP_URL`) `actualizarVariables` → resumen final
con la URL, la revisión y los pasos siguientes.

**Variables y secretos**: `deploy.config.json` (en el repo, sin secretos) define el servicio, los recursos
y las variables no sensibles; `.env.deploy` (fuera del repo) trae `SHOPIFY_API_KEY` y `SHOPIFY_API_SECRET`
de la app de producción. Los secretos nunca se pasan como argumento de un comando: van por stdin.

## 14. Despliegue en Google Cloud paso a paso

```bash
# 1. Autenticación y proyecto
gcloud auth login
gcloud config set project <id-del-proyecto>
# y facturación habilitada en ese proyecto

# 2. Completar deploy/deploy.config.json (proyecto y región de proveedores.gcp)

# 3. Crear .env.deploy en la raíz (NO se commitea) con las credenciales de la app de producción
#    SHOPIFY_API_KEY=...
#    SHOPIFY_API_SECRET=...

# 4. Revisar los comandos sin ejecutarlos
npm run deploy -- --proveedor gcp --dry-run

# 5. Desplegar de verdad: crea/actualiza infraestructura, publica secretos, construye
#    la imagen con Cloud Build y despliega en Cloud Run. Devuelve la URL del servicio.
npm run deploy -- --proveedor gcp

# 6. Pegar esa URL en application_url y redirect_urls de shopify.app.toml
#    (el proxy y los webhooks son rutas relativas: no cambian)

# 7. Desplegar la configuración y las extensiones de Shopify
npm run deploy:shopify

# 8. Instalar la app en la development store y configurarla (§7)
```

**Qué recursos crea** `ProveedorGcp` (todos idempotentes: repetir el comando no falla ni duplica nada):

| Paso | Recursos |
|---|---|
| Infraestructura | Habilita `run`, `cloudbuild`, `artifactregistry`, `firestore` y `secretmanager`; crea el repositorio de Artifact Registry, la base de Firestore y la cuenta de servicio de Cloud Run (con el rol `roles/datastore.user`) si no existen |
| Secretos | Crea el secreto `SHOPIFY_API_SECRET` en Secret Manager (si no existe) y publica una versión nueva solo si el valor cambió; concede acceso a la cuenta de servicio |
| Imagen | `gcloud builds submit` construye la imagen con Cloud Build (no necesita Docker local) y la sube a Artifact Registry |
| Servicio | `gcloud run deploy` crea una revisión nueva en Cloud Run: 1 CPU, 512 MiB, 0 a 3 instancias, concurrencia 80, `--allow-unauthenticated` (necesario porque Shopify llama al proxy, los webhooks y el OAuth sin credenciales de Google — la autenticación real la hace la app con HMAC y session tokens) |

**Primer despliegue**: el backend necesita `SHOPIFY_APP_URL` para arrancar, así que la CLI la calcula antes
de desplegar con el formato determinista de Cloud Run
(`https://<servicio>-<número-de-proyecto>.<región>.run.app`) y, después de desplegar, la compara contra la
URL real del servicio.

**Ver logs**: en el Logs Explorer de Google Cloud, o con `gcloud run services logs read <servicio>`.

**Apagado ordenado**: al escalar a cero o al cambiar de revisión, Cloud Run envía `SIGTERM` y, 10 segundos
después, `SIGKILL`. El `Dockerfile` arranca el servidor en forma exec, sin `npm` en medio
(`CMD ["node_modules/.bin/react-router-serve", "./build/server/index.js"]`), para que el propio servidor
sea el PID 1 y reciba la señal: `react-router-serve` la atiende cerrando el servidor HTTP después de
terminar las peticiones en curso. `npm run start` sigue sirviendo para arrancarlo a mano, pero no como
`CMD` del contenedor (npm no reenvía `SIGTERM` a su hijo). Si se ejecuta la imagen con `docker run`
fuera de Cloud Run, `docker run --init` agrega además un init mínimo que recoge procesos huérfanos.

**Costos**: con 0 instancias mínimas, Cloud Run se paga solo por uso. Firestore guarda unos pocos documentos
de sesión, Secret Manager un secreto, Artifact Registry las imágenes (conviene una política de limpieza) y
Cloud Build consume minutos de build. Ver las páginas oficiales de precios de cada servicio para cifras
actualizadas; este README no las repite porque cambian con frecuencia.

**Actualizaciones**: repetir `npm run deploy -- --proveedor gcp`; la revisión nueva recibe el 100 % del
tráfico automáticamente.

**Reversión del backend** (fuera de la CLI en v1):

```bash
gcloud run services update-traffic <servicio> --region <region> --to-revisions <revision-anterior>=100
```

## 15. Despliegue de extensiones y configuración de Shopify

Son **dos despliegues independientes**:

| Despliegue | Qué publica | Comando | Dónde |
|---|---|---|---|
| Backend | Contenedor con la página de admin, el proxy y los webhooks | `npm run deploy -- --proveedor gcp` | Proveedor de nube ([§14](#14-despliegue-en-google-cloud-paso-a-paso)) |
| Shopify | Configuración de la app (scopes, proxy, webhooks, metaobjeto), theme app extension, Functions y extensión de pedido | `npm run deploy:shopify` | Shopify (nueva versión de la app) |

`npm run deploy:shopify` ejecuta `npm run build:embed` (bundle del selector) y después
`shopify app deploy --config shopify.app.toml`, que crea una versión nueva de la app con todas las
extensiones, Functions, la definición del metaobjeto, el App Proxy y los webhooks. Se despliega primero el
backend (para conocer su URL antes de fijarla en `shopify.app.toml`) y después Shopify; un cambio que solo
toca extensiones no requiere volver a desplegar el backend, y viceversa.

**Reversión de extensiones/configuración**: `npm run deploy:shopify` siempre crea una versión nueva; para
volver a una anterior se usa el Dev Dashboard (fuera de la CLI de este repo).

## 16. Agregar otro proveedor

Nada de esto toca `app/domain` ni `app/application` (por diseño, OCP):

1. Crear `deploy/src/proveedores/<nombre>/` a partir de `deploy/src/proveedores/plantilla/` e implementar
   la interfaz `ProveedorDespliegue` usando **solo** `EjecutorComandos` (nunca un SDK del proveedor
   directamente).
2. Registrarlo en `deploy/src/proveedores/registro.ts` y agregar su bloque
   (`proveedores.<nombre>`) en `deploy/deploy.config.json`.
3. Elegir el almacenamiento de sesiones: un adaptador oficial de Shopify (por ejemplo, el de MongoDB, que
   sirve para Azure Cosmos DB con su API de MongoDB) o uno propio que pase los contract tests de
   `SessionStorage`. Registrar el valor de `SESSION_STORAGE_DRIVER` correspondiente en
   `app/composition/contenedor.server.ts`.
4. Escribir los tests del proveedor con un `EjecutorComandos` falso: verificar los comandos exactos que se
   piden ejecutar, la idempotencia y que los secretos siempre van por stdin, nunca como argumento.
5. Documentarlo aquí.

**Ejemplo orientativo para Azure**: Container Apps (cómputo, en vez de Cloud Run), `az acr build` sobre
Azure Container Registry (imagen, en vez de Cloud Build + Artifact Registry), Key Vault (secretos, en vez
de Secret Manager) y Cosmos DB con su API de MongoDB (sesiones, con el adaptador oficial de Shopify para
MongoDB, en vez de Firestore). El mapeo completo de capacidades portables está en `spec.md` §20.1.

## 17. Distribución en el App Store

La app se distribuye como **pública con visibilidad limitada**: no aparece en búsquedas ni categorías, se
instala solo desde la URL del listing, y esa visibilidad se puede cambiar en cualquier momento (a
diferencia de la elección entre pública/custom, que es irreversible una vez hecha). Esto permite usar
Shopify Functions en cualquier plan salvo Starter sin necesitar Plus.

**Paquete para la revisión** (FASE-10 de la hoja de ruta, operativa y fuera del alcance de esta sesión
cloud): listing en inglés con traducción al español, política de privacidad
(`app/routes/privacidad.tsx`, ya servida por el backend), capturas de pantalla, video del flujo completo
(instalación → configuración → carrito → checkout → página de pedido), instrucciones de prueba para el
revisor usando el **modo demo** del embed ([§9](#9-el-app-embed)) para no depender de un sistema externo, y
una development store con acceso de staff para el equipo de revisión.

**Instalación desde la URL del listing**: una vez aprobada, cualquier comerciante la instala visitando esa
URL directamente (no aparece en el listado público de apps).

## 18. Operación y observabilidad

Todos los logs son JSON a stdout (`RegistroJson`, que Cloud Logging — o el sistema de logs de cualquier
otro proveedor — interpreta sin configuración adicional):

| Evento | Nivel | Datos |
|---|---|---|
| `proxy.puntos.respuesta` | INFO | `tienda`, `estadoCache` (`fresca`, `vencida`, `cargada` o `stale`), `total`, `duracionMs` |
| `puntos.carga` | INFO | `tienda`, `paginas`, `total`, `invalidos`, `duplicados`, `costo` (suma del costo real de las consultas), `duracionMs` |
| `puntos.invalido` | WARNING | `tienda`, `gid`, `motivo` |
| `puntos.duplicado` | WARNING | `tienda`, `identificador`, `gids` |
| `puntos.carga.error` | ERROR | `tienda`, `error`, `reintentos` |
| `proxy_puntos.error_inesperado` | ERROR | `tienda`, `motivo`, `stack` (respuesta 500; nunca la sesión ni el token) |
| `personalizaciones.activacion` | INFO | tienda, creadas, activadas, errores |
| `webhook.recibido` | INFO | topic, tienda |
| `sesiones.borradas` | INFO | tienda, cantidad |
| `config.invalida` | ERROR | nombres de las variables faltantes (**nunca** sus valores) |

Cada log incluye `requestId` cuando la petición trae `traceparent` (el *trace-id* W3C) o
`x-cloud-trace-context` (el que agrega Cloud Run), para correlacionar una petición del proxy con su carga
de puntos y sus reintentos. Las rutas lo propagan con `contenedor.conContextoPeticion` (un
`AsyncLocalStorage` que `RegistroJson` consulta al escribir cada línea).

**Alertas sugeridas**: tasa de respuestas 5xx en `/proxy/puntos`, repetición de `puntos.carga.error` y
reinicios del contenedor.

**Comportamiento de la caché**: `CachePuntos` guarda una copia por tienda con TTL (`PUNTOS_CACHE_TTL_SEGUNDOS`,
5 minutos por defecto) y un máximo de vejez (`PUNTOS_CACHE_STALE_MAX_SEGUNDOS`, 24 h por defecto) antes de
dejar de servirla incluso como respaldo. Mientras la copia está vencida pero no supera el máximo de vejez,
el proxy la sirve igual (*stale-while-revalidate*, con un refresco en segundo plano; `stale: false`) y, si
la fuente falla, sigue sirviéndola marcada `stale: true` hasta que un refresco vuelva a funcionar
(*stale-if-error*, `estadoCache: "stale"` en el log). **Para ver un cambio recién hecho en un punto al instante**: esperar
a que venza el TTL, o redesplegar el backend (que reinicia la caché en memoria).

## 19. Seguridad y privacidad

- **Toda entrada está autenticada**: HMAC en el App Proxy y en los webhooks, session token en el admin
  embebido (NFR-08). No hay cookies en el App Proxy.
- **Qué guarda la app**: solo las sesiones (el token offline de cada tienda), hasta que llega
  `app/uninstalled` o `shop/redact`.
- **Qué no guarda**: datos de compradores, pedidos o direcciones. Los atributos del pedido viven en
  Shopify, no en la app (ver `app/routes/privacidad.tsx`, servida en producción en `/privacidad`).
- **Webhooks de cumplimiento** (`app/routes/webhooks.compliance.tsx`): `customers/data_request` y
  `customers/redact` responden 200 sin ninguna acción (la app no guarda datos de compradores);
  `shop/redact` borra las sesiones de esa tienda.
- **Secretos**: variables de entorno (Secret Manager en Google Cloud, inyectado como variable de entorno
  al contenedor — nunca en el código ni en logs).
- **Mínimo privilegio**: solo 2 scopes, `write_delivery_customizations` y `write_app_proxy`
  (`shopify.app.toml`); los metaobjetos app-owned no necesitan scope adicional desde la API 2026-04.
- **Sin XSS**: el selector del carrito nunca inserta HTML de datos de Shopify sin escapar (verificado por
  test: un nombre de punto con etiquetas se muestra como texto plano, nunca como marcado).

### Estado de `npm audit` (T134)

Al cerrar esta sesión, `npm audit` reporta **0 vulnerabilidades críticas**, 1 baja, 1 moderada y 15 altas.
Las 2 críticas que había al empezar (`vitest` y `@vitest/coverage-v8`, por una lectura arbitraria de
archivos cuando el servidor de UI de Vitest está escuchando) se resolvieron subiendo `vitest` de la rama
2.x a la 4.1.11 en todos los workspaces — la primera versión publicada que trae el parche — junto con
`vite` (^7.3.6, requerido como peer) y `@typescript-eslint/*` (^8.70.1, también con una vulnerabilidad alta
resuelta). Esa migración obligó además a reemplazar `vitest.workspace.ts` (formato obsoleto desde Vitest 3)
por un `vitest.config.ts` propio en la raíz con `test.projects`, porque sin esto Vitest 4 heredaba por
error el `vite.config.ts` de la app (con el plugin de React Router) como base de cada proyecto de test, lo
que rompía el entorno `jsdom` de `packages/selector-carrito` y `extensions/punto-pedido`.

Las **15 altas y 1 moderada restantes** son, todas, dependencias de desarrollo del árbol de
`@graphql-codegen/*` (usado solo por `npm run graphql-codegen`, para regenerar tipos de GraphQL — no se
ejecuta en producción ni en `npm test`/`typecheck`/`lint`/`build`), arrastradas por una versión antigua de
`lodash` (inyección de código vía `_.template`, *prototype pollution* en `_.unset`/`_.omit`). Llegan por
dos caminos que confluyen en el mismo `lodash` vulnerable:
`@shopify/api-codegen-preset` (ya en su última versión publicada, 3.0.0) y `@shopify/shopify_function`
(fijado en `~2.0.0` en `extensions/ocultar-envios` y `extensions/renombrar-recogida` porque es la versión
exacta que exige `shopify app function build` real, según la sesión 6 de `progreso.md`). Ninguna versión
publicada de ninguno de los dos corta esa cadena (`npm audit` confirma `fixAvailable: false` para los
paquetes `@graphql-codegen/*` de nivel más alto); son dependencias de una herramienta de línea de comandos
que nunca corre con datos de una tienda real, no del código que se despliega (el `Dockerfile` no instala
`devDependencies` en la etapa final, ver [§20.2 del spec](specs/001-puntos-recogida/spec.md)). Revisar de
nuevo con cada actualización de `@shopify/cli`/`@shopify/shopify_function` (`npm audit`), por si una
versión futura corta la cadena.

## 20. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| No hay opciones de entrega en el checkout de un carrito resolado | Falta la tarifa "Recogida en punto de entrega" en la zona/perfil de envío de esa dirección | Página de admin, paso 2: crearla en **todas** las zonas de **todos** los perfiles que puedan aplicar |
| El selector no aparece en el carrito | El app embed no está activado en el tema que se está viendo, o el carrito no está marcado como resolado | Verificar Tienda online → Temas → Personalizar → App embeds; comprobar `tipo_carrito=resolado` en `/cart.js`; probar con el modo demo |
| La tarifa de recogida aparece en un carrito normal | Las Functions se ejecutan siempre, pero solo actúan si detectan `tipo_carrito=resolado`; en un carrito normal no deberían tocar nada — si la tarifa igual aparece, revisar que no se haya creado por error fuera del flujo de recogida | Confirmar que las 2 personalizaciones de entrega están activas (página de admin, paso 4) y que el título de la tarifa coincide exactamente con "Recogida en punto de entrega" |
| El App Proxy responde 404 | La URL no coincide con `/apps/<prefix>/<subpath>` configurado en `shopify.app.toml` (`apps/puntos-recogida`), o el backend desplegado no es el que Shopify tiene registrado | Revisar `[app_proxy]` en `shopify.app.toml` y que `application_url` apunte al backend desplegado vigente |
| El App Proxy responde 401 (o el `loader` nunca se ejecuta) | Firma HMAC inválida o ausente | `authenticate.public.appProxy` corta antes del `loader`; probar la URL solo a través del dominio de la tienda, nunca llamando directo al backend |
| Las Functions no se ejecutan | No existe la delivery customization de esa Function, o `write_delivery_customizations` no está concedido | Página de admin, paso 4 ("Activar"); revisar Configuración → Envío y entrega → Personalizaciones de entrega |
| El bloque de pedido no aparece | El comerciante no lo agregó, o el pedido no tiene una selección de punto (carrito normal) | Configuración → Checkout → Personalizar → página de estado del pedido → Agregar bloque de app |
| Error al activar personalizaciones: "límite de 25 alcanzado" | La tienda ya tiene 25 delivery customizations de cualquier app | Borrar o desactivar personalizaciones de entrega que no se usen antes de reintentar |
| `npm run deploy` falla en "Verificar" (código 2) | Falta `gcloud`, o no hay sesión activa (`gcloud auth login`) | Instalar el SDK de Google Cloud y autenticarse antes de reintentar |
| `npm run deploy` falla en "Configuración" (código 1) | Falta una variable/secreto requerido (`SHOPIFY_API_SECRET` en `.env.deploy`, un campo de `deploy.config.json`) | El mensaje de error nombra la variable o el campo faltante; nunca imprime valores |
| `npm run deploy` falla con "proveedor no implementado" (código 4) | `--proveedor` no está registrado en `deploy/src/proveedores/registro.ts` | En v1 solo `gcp` está registrado; ver [§16](#16-agregar-otro-proveedor) para agregar uno nuevo |
| `npm run deploy` falla en "Imagen" o "Servicio" | Error real de `gcloud builds submit`/`gcloud run deploy` (permisos, facturación no habilitada, cuota) | Leer el mensaje de `gcloud` que la CLI reenvía tal cual; no lo reinterpreta |
| `shopify app deploy` falla por Functions sin compilar | No se corrió `npm run build:embed`/`shopify app build` antes, o falta `schema.graphql` en una Function | Ver [§8](#8-functions-de-typescript-a-webassembly): requiere una app vinculada a Partners para `shopify app function schema`/`typegen` |

## 21. Límites conocidos y decisiones

| Límite o riesgo | Impacto | Mitigación |
|---|---|---|
| Los atributos del carrito se pueden manipular desde el navegador | Un comprador podría inventar un punto o una dirección | La Function no tiene red para verificarlo. v2: webhook `orders/create` que valide `punto_gid` |
| La tarifa se reconoce por su título exacto | Si el comerciante la renombra, los carritos resolado se quedan sin opciones | Normalización tolerante de texto; avisos en la página de admin y aquí. v2: título configurable |
| Falta la tarifa en alguna zona o perfil | El checkout resolado se queda sin opciones en esa zona | Página de admin, paso 2, y tabla de [§20](#20-solución-de-problemas) |
| Functions en TypeScript, no en Rust | Consumen más instrucciones por ejecución | Presupuesto del NFR-06 medido en tests; plan B en Rust ([§8](#8-functions-de-typescript-a-webassembly)) |
| El app embed no se activa solo | La app no hace nada en el tema hasta que el comerciante lo activa | Deep link y paso 3 de la página de admin |
| Variedad de temas | Botones y estructura de carrito distintos entre temas | Selectores CSS configurables; la Function sigue siendo la garantía real |
| Caché por instancia y arranques en frío | Primera carga lenta tras desplegar; cambios se ven al vencer el TTL | *Stale-while-revalidate* y *stale-if-error* ([§18](#18-operación-y-observabilidad)). v2: snapshot compartido |
| Plan Shopify Starter | No tiene Shopify Functions | Requisito de plan documentado en [§5](#5-requisitos-previos) |
| Desinstalación | La tarifa de recogida queda visible para todos los compradores | Aviso en la página de admin ("Antes de desinstalar") |
| Punto borrado y comprador que llega directo al checkout | El pedido se completa con un punto que ya no existe | Revalidación en el carrito y copia inmutable del pedido. v2: validación posterior a la compra |
| Evolución de las APIs de Shopify | Deprecaciones futuras | API fechada 2026-07; revisar trimestralmente |
| Cadena de vulnerabilidades de devDependencies sin fix publicado | Ninguno en producción (no se instalan `devDependencies` en el contenedor) | Ver [§19](#19-seguridad-y-privacidad); revisar con cada actualización de `@shopify/cli` |

Las decisiones de diseño numeradas (DEC-01 a DEC-2x) están en `specs/001-puntos-recogida/spec.md` §12; las
decisiones específicas de cada sesión de construcción, en `specs/001-puntos-recogida/progreso.md`.

## 22. Hoja de ruta v2+

1. *Cart and Checkout Validation Function*: mensaje claro ("Elige un punto de recogida en el carrito") en
   vez de "no hay envíos disponibles"; cubre también los pagos acelerados.
2. Webhook `orders/create` con un metacampo verificado en el pedido (requiere `read_orders` y aprobación de
   datos protegidos del cliente).
3. Título de la tarifa configurable (metacampo `jsonValue` de la personalización, leído en la input query).
4. Bloque en la página de Gracias.
5. Mapa con los puntos (latitud y longitud ya disponibles en los datos).
6. Búsqueda en el servidor para más de 5.000 puntos.
7. Caché compartida o snapshot en Firestore, con invalidación por eventos de metaobjetos.
8. Activar y desactivar puntos sin borrarlos (`capabilities.publishable`).
9. Adaptadores de Azure y AWS implementados, con CI/CD e infraestructura como código.
10. Interfaz en inglés.
11. Detección automática de la tarifa en las zonas (`read_shipping`) y del embed activo (`read_themes`).
12. Migración de las Functions a Rust si el volumen lo exige (ver [§8](#8-functions-de-typescript-a-webassembly)).

## 23. Glosario y referencias

### Glosario

- **Carrito resolado**: carrito cuyo atributo `tipo_carrito`, normalizado (sin espacios en los extremos y
  en minúsculas), vale `resolado`. Cualquier otro carrito es **normal**.
- **Punto de recogida**: entrada del metaobjeto `$app:punto_recogida`.
- **Selección (snapshot) del punto**: copia de los datos del punto en los atributos `punto_*` del carrito,
  que Shopify copia al pedido al pagar y que ya no cambia después.
- **Tarifa de recogida**: tarifa de envío manual llamada exactamente "Recogida en punto de entrega" que el
  comerciante crea en sus zonas de envío.
- **Metaobjeto app-owned (`$app:`)**: tipo de dato cuya definición pertenece a la app; se declara en
  `shopify.app.toml` y se crea o actualiza con cada `shopify app deploy`.
- **App Proxy**: ruta del dominio de la tienda (`/apps/puntos-recogida/*`) que Shopify reenvía, firmada, al
  backend.
- **App embed**: bloque de una theme app extension que se inyecta antes de `</body>` en todas las páginas
  y que el comerciante activa en el editor de temas.
- **Function**: módulo WebAssembly que Shopify ejecuta dentro del cálculo del checkout; sin red, sistema de
  archivos ni reloj.
- **Delivery customization (personalización de entrega)**: registro de la tienda que activa una Function de
  personalización de entrega. Máximo 25 por tienda.
- **Fail-closed**: ante datos faltantes o inválidos, no ofrecer entrega en lugar de ofrecer cualquiera.
- **Puerto / adaptador**: interfaz que define una capacidad que necesita la aplicación / implementación
  concreta de esa interfaz para una tecnología determinada.
- **Proveedor**: plataforma de nube donde corre el backend (Google Cloud en la referencia).

### Referencias

- [Intro a Shopify apps](https://shopify.dev/docs/apps/getting-started)
- [Shopify App React Router](https://shopify.dev/docs/api/shopify-app-react-router)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [Metaobjetos app-owned](https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions)
- [App Proxy](https://shopify.dev/docs/apps/build/online-store/app-proxies)
- [Theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration)
- [Shopify Functions](https://shopify.dev/docs/api/functions)
- [Delivery Customization API (2026-07)](https://shopify.dev/docs/api/functions/2026-07/delivery-customization)
- [Rust para Functions](https://shopify.dev/docs/apps/build/functions/programming-languages/rust-for-functions)
- [Customer Account UI Extensions — Attributes API](https://shopify.dev/docs/api/customer-account-ui-extensions/2026-07/target-apis/order-apis/attributes-api)
- [Distribución y visibilidad de apps](https://shopify.dev/docs/apps/launch/distribution/visibility)
- [Ajax Cart API](https://shopify.dev/docs/api/ajax/reference/cart)

Un listado más extenso de hechos de plataforma verificados, con fuente y fecha, está en el Anexo A de
[`specs/001-puntos-recogida/spec.md`](specs/001-puntos-recogida/spec.md).
