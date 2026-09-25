# Especificación maestra (SPEC + PLAN): Puntos de recogida sin Shopify Plus

**Feature**: `001-puntos-recogida` (carpeta `specs/001-puntos-recogida/`)

**Created**: 2026-09-25

**Status**: Aprobada para `/speckit-tasks`

**Versión del documento**: 1.0.0

**Input**: Prueba técnica de Upango (`enunciado.md`), solución acordada (`1-solucion-resumen.md`,
`2-explicacion.md`), adaptador existente `snippets/firestore-session-storage.server.ts` y las decisiones
tomadas en la sesión de especificación del 2026-09-25.

**Constitución aplicable**: `.specify/memory/constitution.md` v1.0.0

---

## Cómo leer este documento

Este es el **archivo maestro** de la feature. Une en un solo documento la especificación de Spec Kit
(el qué y el por qué) y el plan técnico (el cómo). Está escrito para que una persona o una IA sin
contexto previo entienda la solución completa y pueda generar las tareas con `/speckit-tasks` e
implementarla sin consultar otras fuentes.

- **Parte I — Especificación**: problema, alcance, historias de usuario con escenarios de aceptación,
  requisitos, criterios de éxito, supuestos y trazabilidad con el enunciado.
- **Parte II — Plan técnico**: stack, principios, arquitectura, decisiones, contratos de datos,
  estructura del repositorio, diseño de cada componente, despliegue, estrategia de pruebas, requisitos
  del README, riesgos y hoja de ruta de construcción.
- **Anexos**: hechos de plataforma verificados con su fuente y checklist E2E.

Lo que **no** contiene: la lista de tareas (la genera `/speckit-tasks`) ni código de implementación.
Los fragmentos de TOML, GraphQL, JSON o firmas de interfaces que aparecen son **contratos**: definen lo
que el código debe cumplir, no cómo escribirlo.

**Convenciones**

- **DEBE / NO DEBE**: obligatorio. **DEBERÍA**: recomendado; apartarse exige justificación escrita.
  **PUEDE**: opcional.
- IDs estables: `US-n` historias, `EC-nn` casos borde, `FR-nnn` requisitos funcionales, `NFR-nn` no
  funcionales, `SC-nnn` criterios de éxito, `DEC-nn` decisiones, `CT-nn` contratos, `FASE-n` hoja de ruta.
- Las rutas de archivos son relativas a la raíz del repositorio de la app: `CODE/upango/`.
- Versión de las APIs de Shopify: **2026-07** (última estable al 2026-09-25), salvo indicación.
- Idioma de la interfaz: español. Idioma del código: dominio en español, términos de framework en inglés.

---

# PARTE I — ESPECIFICACIÓN (qué y por qué)

## 1. Contexto y problema

### 1.1 El problema de negocio

Una tienda Shopify **sin plan Plus** tiene un tipo de pedido especial que se debe entregar en un **punto
de recogida** elegido por el cliente, en lugar de en su dirección de envío. Estos pedidos se reconocen
porque el carrito tiene el atributo `tipo_carrito` con el valor `resolado`. El comerciante define los
puntos (hoy pocos; en el futuro, más de 500) y el cliente elige el que le resulte más cómodo para ir a
buscar su pedido cuando esté listo. Los carritos sin ese atributo se procesan como hasta ahora, con la
dirección de envío que indica el cliente.

### 1.2 Por qué es difícil sin Plus

| Restricción de plataforma (verificada, ver Anexo A) | Consecuencia para el diseño |
|---|---|
| Las Checkout UI extensions de los pasos de información, envío y pago son **solo Plus** | El selector no puede estar dentro del checkout: va en el **carrito** |
| Los pickup points nativos y la *Pickup Point Delivery Option Generator API* solo existen para custom apps en Plus o en development stores; **las apps públicas no tienen acceso** | No se pueden generar opciones de pickup nativas |
| La **Delivery Customization Function API** es la única forma de ocultar, renombrar u ordenar opciones de entrega | Las reglas del checkout van en **Shopify Functions** |
| Las custom apps con Functions solo corren en Plus; **las apps públicas con Functions corren en todos los planes salvo Starter** | La app se distribuye como **pública con visibilidad limitada** |
| Las extensiones de las páginas de Gracias y de estado del pedido están disponibles en todos los planes salvo Starter | La página de pedido sí admite una extensión |
| La distribución de una app no se puede cambiar después de elegirla | La decisión "pública" se toma una vez y condiciona todo lo demás |

### 1.3 Objetivo

Construir una **app pública de Shopify con visibilidad limitada** que:

1. Declare el metaobjeto "Punto de recogida" para que el comerciante gestione los puntos desde el admin
   nativo de Shopify, sin pantallas propias.
2. Muestre en el carrito, **solo en carritos resolado**, un selector de puntos con buscador, obligatorio
   para poder ir al checkout, y guarde toda la información del punto elegido.
3. En el checkout deje como **única** forma de entrega la tarifa "Recogida en punto de entrega",
   renombrada con la dirección corta del punto y con un aviso de que no se usará la dirección del cliente;
   y que esa tarifa **no aparezca** en los carritos normales.
4. Conserve en el pedido una **copia inmutable** del punto elegido y la muestre en la página de estado del
   pedido de las cuentas de cliente nuevas.
5. Ofrezca una página de admin que explique qué hace la app y guíe su configuración.
6. Tenga un backend **portable entre proveedores de nube** (Google Cloud como implementación de
   referencia), pruebas automatizadas en las piezas críticas y un **README generoso**.

## 2. Alcance

### 2.1 Dentro del alcance (v1 = el enunciado)

- Metaobjeto app-owned `$app:punto_recogida` con los 6 campos del enunciado y sus validaciones.
- Backend con App Proxy que devuelve todos los puntos, paginando de a 250 y con caché por tienda.
- Theme app extension (app embed) con selector con buscador, bloqueo del checkout, guardado del punto en
  los atributos del carrito, revalidación y modo demo.
- Dos Delivery Customization Functions (ocultar y renombrar) escritas en TypeScript y compiladas a
  WebAssembly.
- Copia del punto en el pedido mediante atributos y customer account UI extension en la página de estado
  del pedido.
- Página de admin informativa con activación idempotente de las Functions y enlaces directos a cada paso.
- Webhooks obligatorios (desinstalación, cambio de scopes y privacidad) y política de privacidad pública.
- Backend en contenedor, configuración 12-factor, puertos intercambiables y **CLI de despliegue** con la
  interfaz `ProveedorDespliegue` y el adaptador de Google Cloud completo.
- Pruebas automatizadas en las piezas críticas, checklist E2E manual y README generoso.
- Paquete de distribución para el App Store (visibilidad limitada).

### 2.2 Fuera del alcance (hoja de ruta v2+, ver §27.2)

- Cart and Checkout Validation Function (mensaje explícito en el checkout cuando falta el punto).
- Bloque en la página de Gracias.
- Webhook `orders/create` que valide `punto_id` contra el metaobjeto y guarde una copia verificada.
- Título de la tarifa configurable desde el admin.
- Mapa para localizar y elegir puntos.
- Invalidación de caché por webhooks o eventos de metaobjetos, y caché compartida entre instancias.
- Adaptadores implementados para otros proveedores (Azure, AWS) y CI/CD.
- Otros idiomas de interfaz.
- Detección o creación automática de la tarifa en las zonas de envío.
- Activar o desactivar puntos sin borrarlos (capacidad `publishable` del metaobjeto).

## 3. Actores, superficies y glosario

### 3.1 Actores

| Actor | Qué hace |
|---|---|
| Comerciante | Instala la app, carga los puntos, crea la tarifa, activa el app embed, las Functions y el bloque de pedido |
| Comprador | Con carrito resolado, elige un punto en el carrito y compra; después ve el punto en la página de pedido |
| Sistema externo | Escribe `tipo_carrito=resolado` en el carrito (otra app, el tema o un flujo headless). La app solo lo lee |
| Operador o desarrollador | Compila, prueba y despliega el backend y las extensiones |
| Revisor del App Store o evaluador de Upango | Prueba la app de punta a punta con el modo demo |
| Shopify | Ejecuta extensiones y Functions, firma las peticiones del App Proxy y los webhooks |

### 3.2 Superficies

| Superficie | Pieza de la app | Quién la hospeda y ejecuta |
|---|---|---|
| Admin | Metaobjeto (CRUD nativo) y página de admin embebida | Shopify / backend de la app |
| Tienda online | App embed de la theme app extension | CDN de Shopify |
| Checkout | Functions `ocultar-envios` y `renombrar-recogida` (wasm) | Shopify |
| Cuentas de cliente | Extensión de la página de estado del pedido | Shopify |
| Backend | Contenedor React Router (Cloud Run en la referencia) | Proveedor de nube |

### 3.3 Glosario

- **Carrito resolado**: carrito cuyo atributo `tipo_carrito`, normalizado (sin espacios en los extremos y
  en minúsculas), vale `resolado`. Cualquier otro carrito es **normal**.
- **Punto de recogida**: entrada del metaobjeto `$app:punto_recogida`.
- **Selección (snapshot) del punto**: copia de los datos del punto en los atributos `punto_*` del carrito,
  que Shopify copia al pedido al pagar.
- **Tarifa de recogida**: tarifa de envío manual llamada exactamente "Recogida en punto de entrega" que el
  comerciante crea en sus zonas de envío.
- **Metaobjeto app-owned (`$app:`)**: tipo de dato cuya definición pertenece a la app; se declara en
  `shopify.app.toml` y se crea o actualiza con cada `shopify app deploy`.
- **App Proxy**: ruta del dominio de la tienda (`/apps/puntos-recogida/*`) que Shopify reenvía, firmada,
  al backend.
- **App embed**: bloque de una theme app extension que se inyecta antes de `</body>` en todas las páginas
  y que el comerciante activa en el editor de temas.
- **Function**: módulo WebAssembly que Shopify ejecuta dentro del cálculo del checkout; no tiene red,
  sistema de archivos ni reloj.
- **Delivery customization (personalización de entrega)**: registro de la tienda que activa una Function
  de personalización de entrega. Hay un máximo de 25 por tienda.
- **Fail-closed**: ante datos faltantes o inválidos, no ofrecer entrega en lugar de ofrecer cualquiera.
- **Puerto / adaptador**: interfaz que define una capacidad que necesita la aplicación / implementación
  concreta de esa interfaz para una tecnología.
- **Proveedor**: plataforma de nube donde corre el backend (Google Cloud en la referencia).

## 4. Escenarios de usuario y pruebas *(obligatorio)*

Las historias están ordenadas por importancia. Cada una se puede probar por separado; las dependencias
técnicas comunes (monorepo, configuración, sesiones, contratos) son la fase de fundaciones (§27.1).

### US-1 — El comerciante gestiona los puntos desde el admin nativo (Prioridad: P1)

El comerciante entra en Contenido → Metaobjetos → "Punto de recogida" y crea, edita o borra puntos con la
interfaz nativa de Shopify. La app no tiene pantallas propias para eso.

**Por qué esta prioridad**: sin puntos no hay nada que elegir. Es la fuente de datos de todo el flujo y
Shopify ya aporta el CRUD completo.

**Prueba independiente**: instalar la app en una development store y crear, editar y borrar entradas del
metaobjeto desde el admin, comprobando las validaciones de cada campo.

**Escenarios de aceptación**:

1. **Dado** que la app está instalada, **Cuando** el comerciante abre Contenido → Metaobjetos, **Entonces**
   ve la definición "Punto de recogida" con los campos Identificador, Nombre, Dirección, Dirección formato
   reducido, Latitud y Longitud, sin haberla creado a mano.
2. **Dado** el formulario de un punto nuevo, **Cuando** deja vacío un campo obligatorio, escribe una
   latitud fuera de [-90, 90], una longitud fuera de [-180, 180] o una dirección reducida de más de 60
   caracteres, **Entonces** Shopify rechaza el guardado con el error de validación correspondiente.
3. **Dado** un punto guardado, **Cuando** el comerciante lo edita o lo borra, **Entonces** el cambio se
   refleja en el selector del carrito como máximo cuando vence la caché del backend (FR-016).
4. **Dado** que una versión nueva de la app cambia la definición, **Cuando** se ejecuta
   `shopify app deploy`, **Entonces** la definición se actualiza en todas las tiendas donde la app está
   instalada, sin mutations manuales.

---

### US-2 — El comprador elige un punto de recogida en el carrito (Prioridad: P1)

Con un carrito resolado, en la página `/cart` o en el cart drawer, el comprador ve un selector con
buscador, elige un punto y recién entonces puede ir al checkout.

**Por qué esta prioridad**: sin Plus, el carrito es el único lugar donde se puede elegir el punto. Es el
requisito central del enunciado.

**Prueba independiente**: con puntos cargados y `tipo_carrito=resolado` en el carrito (modo demo o
`/cart/update.js`), abrir el carrito en Dawn y en Horizon, buscar, elegir y comprobar los atributos en
`/cart.js` y el desbloqueo del botón de checkout.

**Escenarios de aceptación**:

1. **Dado** un carrito resolado sin punto, **Cuando** el comprador abre el carrito, **Entonces** ve el
   selector "Punto de recogida", el aviso de que no se usará su dirección de envío, el botón de checkout
   deshabilitado con el motivo y los botones de pago acelerado ocultos.
2. **Dado** el selector con más de 500 puntos, **Cuando** el comprador escribe en el buscador (con o sin
   tildes, en mayúsculas o minúsculas), **Entonces** la lista se filtra por nombre, dirección, dirección
   corta o identificador, muestra como máximo 50 resultados y el total de coincidencias.
3. **Dado** un resultado, **Cuando** lo elige con el mouse, el tacto o el teclado (flechas y Enter),
   **Entonces** el carrito guarda los atributos `punto_*` del CT-02, se muestra el punto elegido con la
   opción "Cambiar" y el botón de checkout se habilita.
4. **Dado** un punto elegido, **Cuando** el comprador recarga la página o abre el drawer desde otra
   página, **Entonces** ve el punto elegido y el checkout habilitado.
5. **Dado** que el comerciante borró el punto elegido, **Cuando** el comprador vuelve al carrito,
   **Entonces** la app elimina la selección, avisa "El punto que elegiste ya no está disponible. Elige
   otro." y bloquea el checkout.
6. **Dado** que el comerciante editó el punto elegido, **Cuando** el comprador vuelve al carrito,
   **Entonces** los atributos se actualizan con los datos vigentes sin intervención del comprador.
7. **Dado** un carrito normal, **Cuando** el comprador navega la tienda, **Entonces** no aparece ningún
   elemento de la app y no se hace ninguna petición al backend.
8. **Dado** un carrito normal que conserva atributos `punto_*` de una selección anterior, **Cuando** se
   carga cualquier página, **Entonces** la app elimina esos atributos.
9. **Dado** que el backend no responde, **Cuando** se abre un carrito resolado, **Entonces** se muestra un
   error con la opción "Reintentar" y el checkout sigue bloqueado.

---

### US-3 — El checkout ofrece solo la recogida en el punto elegido (Prioridad: P1)

En el paso de entrega del checkout, un carrito resolado con punto ve una única opción: la recogida,
renombrada con la dirección corta del punto y el aviso de que no se usará su dirección. Los carritos
normales ven sus opciones de siempre, sin la tarifa de recogida.

**Por qué esta prioridad**: es la garantía real, del lado del servidor. El bloqueo del carrito es solo
experiencia de usuario y se puede saltar.

**Prueba independiente**: con las Functions activadas y la tarifa creada en la zona de prueba, llegar a la
elección de entrega con (a) un carrito resolado con punto, (b) uno resolado sin punto entrando por
`/checkout` y (c) un carrito normal. Se complementa con `shopify app function run` sobre los fixtures.

**Escenarios de aceptación**:

1. **Dado** un carrito resolado con punto, **Cuando** el comprador llega a la elección de entrega,
   **Entonces** ve una sola opción, "Recogida en {direccion_corta} · no se usará tu dirección", con el
   precio configurado en la tarifa.
2. **Dado** un carrito resolado sin punto (entrando por URL directa o con un botón de pago acelerado),
   **Cuando** llega a la elección de entrega, **Entonces** no hay ninguna opción disponible y no puede
   completar la compra.
3. **Dado** un carrito normal, **Cuando** llega a la elección de entrega, **Entonces** ve las mismas
   opciones que vería sin la app, excepto "Recogida en punto de entrega", que no aparece.
4. **Dado** un carrito resolado con punto cuyo checkout tiene varios grupos de entrega, **Cuando** se
   calculan las opciones, **Entonces** en cada grupo queda solo la tarifa de recogida renombrada.
5. **Dado** que el backend de la app está caído, **Cuando** un comprador con un punto ya elegido llega al
   checkout, **Entonces** los escenarios 1 a 3 se siguen cumpliendo.

---

### US-4 — El pedido conserva el punto y el comprador lo ve en la página de pedido (Prioridad: P2)

Al pagar, el pedido guarda los datos del punto tal como estaban ese día. El comprador los ve en la página
de estado del pedido y el comerciante, en los detalles del pedido.

**Por qué esta prioridad**: el enunciado exige que el pedido conserve el punto aunque después cambie o se
borre, y que el cliente pueda verlo.

**Prueba independiente**: completar un pedido resolado en la development store, editar y después borrar el
punto, y revisar el pedido en el admin ("Detalles adicionales") y en la página de estado del pedido.

**Escenarios de aceptación**:

1. **Dado** un pedido resolado completado, **Cuando** el comerciante abre el pedido en el admin,
   **Entonces** ve en "Detalles adicionales" `tipo_carrito` y los 7 atributos `punto_*`.
2. **Dado** ese pedido, **Cuando** el comerciante edita o borra el punto en el metaobjeto, **Entonces** los
   datos del pedido no cambian.
3. **Dado** un pedido resolado, **Cuando** el comprador abre la página de estado del pedido, **Entonces** ve
   el bloque "Punto de recogida" con el nombre, la dirección completa, el identificador y el enlace "Ver en
   el mapa".
4. **Dado** un pedido normal, **Cuando** el comprador abre la página de estado del pedido, **Entonces** el
   bloque no se muestra.

---

### US-5 — El comerciante entiende y configura la app desde la página de admin (Prioridad: P2)

Al abrir la app en el admin, el comerciante lee qué hace, ve una lista de pasos con su estado y completa la
configuración con enlaces directos y un botón de activación.

**Por qué esta prioridad**: el enunciado pide información en el admin, y sin activar las Functions y el app
embed la app no hace nada.

**Prueba independiente**: abrir la app en una tienda recién instalada y completar la configuración usando
solo esa página.

**Escenarios de aceptación**:

1. **Dado** que la app está instalada, **Cuando** el comerciante la abre, **Entonces** ve qué hace la app y
   una lista de 5 pasos (puntos, tarifa, app embed, personalizaciones de entrega y bloque de pedido) con su
   estado.
2. **Dado** el paso "Puntos", **Cuando** lo mira, **Entonces** ve cuántos puntos hay cargados y un botón que
   abre la lista de entradas del metaobjeto.
3. **Dado** el paso "Personalizaciones de entrega" pendiente, **Cuando** pulsa "Activar", **Entonces** se
   crean o reactivan las 2 personalizaciones, aparece un aviso de éxito y el estado pasa a "Activas";
   pulsarlo otra vez no crea duplicados.
4. **Dado** el paso "App embed", **Cuando** pulsa "Activar en el editor de temas", **Entonces** se abre el
   editor del tema publicado con el embed "Punto de recogida" ya marcado, a falta de pulsar Guardar.
5. **Dado** el paso "Tarifa", **Cuando** lo mira, **Entonces** lee el nombre exacto de la tarifa, que debe
   existir en todas las zonas y perfiles de envío, y tiene un enlace a Configuración → Envío y entrega.
6. **Dado** que la tienda ya tiene 25 personalizaciones de entrega, **Cuando** pulsa "Activar", **Entonces**
   ve el error de Shopify y cómo resolverlo.

---

### US-6 — El operador despliega el backend de forma portable (Prioridad: P3)

El operador despliega el backend en Google Cloud con un solo comando de la CLI de despliegue, siguiendo el
README. Cambiar de proveedor en el futuro significa agregar un adaptador, no reescribir la app.

**Por qué esta prioridad**: es un pedido explícito (Node listo para Google Cloud, con instrucciones, y la
nube abstraída), pero no afecta el comportamiento que ven el comerciante y el comprador.

**Prueba independiente**: en un proyecto de Google Cloud vacío, seguir el README, ejecutar
`npm run deploy -- --proveedor gcp`, después `shopify app deploy`, e instalar la app en la development store.

**Escenarios de aceptación**:

1. **Dado** un proyecto de Google Cloud con facturación y `gcloud` autenticado, **Cuando** el operador
   ejecuta el despliegue, **Entonces** la CLI habilita los servicios, crea lo que falte (repositorio de
   imágenes, base Firestore, cuenta de servicio, permisos y secreto), construye la imagen, despliega el
   servicio e imprime la URL y los pasos siguientes.
2. **Dado** que la infraestructura ya existe, **Cuando** se vuelve a ejecutar el despliegue, **Entonces**
   no falla ni duplica recursos; solo publica una revisión nueva.
3. **Dado** `--dry-run`, **Cuando** se ejecuta, **Entonces** imprime los comandos que ejecutaría sin cambiar
   nada y sin mostrar secretos.
4. **Dado** un proveedor sin implementar (`--proveedor azure`), **Cuando** se ejecuta, **Entonces** la CLI
   termina con un error claro que remite a la guía del README para agregar proveedores.
5. **Dado** el backend desplegado, **Cuando** se consulta `GET /healthz`, **Entonces** responde 200.

---

### US-7 — El evaluador prueba la app con el modo demo (Prioridad: P3)

Como `tipo_carrito` lo escribe un sistema externo que no existe en la tienda de prueba, el app embed tiene
un modo demo que permite simular un carrito resolado.

**Por qué esta prioridad**: sin él, ni el evaluador de Upango ni el revisor del App Store pueden reproducir
el flujo; no aporta valor en producción.

**Prueba independiente**: activar "Modo demo" en los ajustes del app embed y recorrer el flujo completo sin
herramientas de desarrollo.

**Escenarios de aceptación**:

1. **Dado** el modo demo activado, **Cuando** se abre el carrito, **Entonces** aparece el interruptor
   "Simular carrito resolado (modo demo)".
2. **Dado** el interruptor, **Cuando** se activa, **Entonces** el carrito pasa a tener
   `tipo_carrito=resolado` y aparece el selector; **cuando** se desactiva, se eliminan `tipo_carrito` y los
   atributos `punto_*`.
3. **Dado** el modo demo desactivado (valor por defecto), **Cuando** se abre el carrito, **Entonces** el
   interruptor no existe.

---

### Casos borde (EC)

| ID | Situación | Comportamiento esperado |
|---|---|---|
| EC-01 | Carrito resolado sin punto que entra directo por `/checkout` | Ninguna opción de entrega; no se puede comprar (US-3.2) |
| EC-02 | Botones de pago acelerado (Shop Pay, Apple Pay, Google Pay, PayPal) | Ocultos en el carrito mientras no haya punto; si igual se usan, la Function aplica las mismas reglas |
| EC-03 | El punto se borra después de elegirlo | Revalidación al volver al carrito (US-2.5). Si el comprador va directo al checkout sin pasar por el carrito, se usa la copia ya guardada (límite aceptado, §26) |
| EC-04 | El punto se edita después de elegirlo | Atributos actualizados al volver al carrito (US-2.6); el pedido guarda lo que había en el carrito al pagar |
| EC-05 | `tipo_carrito` con mayúsculas o espacios (`" Resolado "`, `RESOLADO`) | Se trata como resolado en todas las piezas (normalización única, CT-02) |
| EC-06 | Se quita `tipo_carrito` del carrito | Pasa a ser un carrito normal; el embed elimina los `punto_*` (US-2.8) |
| EC-07 | No hay puntos cargados | Mensaje "No hay puntos de recogida disponibles. Contacta con la tienda." y checkout bloqueado |
| EC-08 | El backend o el proxy fallan | Error con reintento y checkout bloqueado (fail-closed); los carritos normales no se ven afectados |
| EC-09 | La tarifa de recogida no existe en la zona del comprador | En el carrito resolado no hay opciones; el README lo documenta en la solución de problemas |
| EC-10 | El comerciante renombra la tarifa | Las Functions no la reconocen: en resolado no hay opciones (fail-closed) y en normales aparece con el nombre nuevo. La página de admin y el README lo advierten |
| EC-11 | El checkout tiene varios grupos de entrega | Cada grupo se procesa por separado (US-3.4); cada perfil y zona involucrados necesitan la tarifa |
| EC-12 | El comprador manipula los atributos (por ejemplo, una dirección inventada) | No se puede impedir en la Function, que no tiene red. Límite aceptado; mejora v2 con el webhook `orders/create` |
| EC-13 | El tema vuelve a renderizar el drawer o la sección del carrito | El selector se vuelve a insertar y conserva el estado |
| EC-14 | Varias pestañas abiertas | El estado se relee del carrito del servidor al volver a la pestaña |
| EC-15 | Tema sin botón de checkout reconocible | Selectores CSS configurables en el embed; si no hay coincidencias, el widget se muestra en la posición del embed y la Function sigue garantizando la regla |
| EC-16 | JavaScript desactivado | No se puede elegir punto; el checkout resolado no tiene opciones (fail-closed) |
| EC-17 | URLs con prefijo de idioma (`/en/cart`) | La Ajax Cart API se llama con `Shopify.routes.root`; el proxy siempre en la raíz `/apps/...` |
| EC-18 | Textos largos | Truncado visual en la interfaz; en el título del checkout la dirección corta se trunca a 60 caracteres |
| EC-19 | Puntos con datos inválidos o identificador duplicado | Los inválidos se excluyen y se registran; los duplicados se muestran (la selección usa el GID) y se registra una advertencia |
| EC-20 | Se desinstala la app | Shopify elimina embed, Functions y extensiones; la tarifa quedaría visible para todos. La página de admin y el README avisan que hay que desactivarla o borrarla |
| EC-21 | La tienda está en el plan Starter | Las Functions no están disponibles y la regla no se puede garantizar; es un requisito de plan documentado |
| EC-22 | La tienda ya tiene 25 personalizaciones de entrega | La activación falla con el error de Shopify (US-5.6) |
| EC-23 | Backend con 0 instancias (arranque en frío) | La primera carga de la lista es más lenta (≤ 5 s); las siguientes usan la caché |
| EC-24 | Carrito en contextos compactos del tema (por ejemplo, la notificación de "agregado al carrito") | El botón de checkout se bloquea y se muestra un enlace breve "Elige tu punto de recogida" que lleva a `/cart` |

## 5. Requisitos *(obligatorio)*

### 5.1 Requisitos funcionales

**Metaobjeto (US-1)**

- **FR-001**: La app DEBE declarar en `shopify.app.toml` la definición de metaobjeto app-owned
  `$app:punto_recogida` ("Punto de recogida") con los campos y validaciones del CT-01, de modo que
  `shopify app deploy` la cree o actualice en todas las tiendas donde está instalada.
- **FR-002**: La definición DEBE permitir al comerciante leer y escribir entradas desde el admin nativo
  (`access.admin = "merchant_read_write"`) y NO DEBE exponerse en la Storefront API
  (`access.storefront = "none"`).
- **FR-003**: La definición DEBE usar el campo `nombre` como nombre visible de cada entrada.
- **FR-004**: La app NO DEBE incluir pantallas propias para crear, editar o borrar puntos.
- **FR-005**: En la app de desarrollo (con `HABILITAR_SEMILLA=true`), la página de admin DEBERÍA ofrecer
  "Crear puntos de ejemplo" (600 por defecto) para probar con más de 500 puntos. En producción esa opción
  NO DEBE existir. Es una herramienta de prueba, no un CRUD.

**Backend y App Proxy (US-2)**

- **FR-010**: El backend DEBE exponer, a través del App Proxy `apps/puntos-recogida`, el endpoint
  `GET /apps/puntos-recogida/puntos` con el contrato CT-03.
- **FR-011**: El endpoint DEBE verificar la firma HMAC que agrega Shopify y rechazar las peticiones sin firma
  o con firma inválida.
- **FR-012**: El endpoint DEBE responder 404 con el cuerpo de error del CT-03 cuando la tienda no tenga
  sesión (la app no está instalada).
- **FR-013**: El backend DEBE leer todas las entradas de `$app:punto_recogida` paginando con cursor de a 250
  (CT-03), sin límite de cantidad total, y reintentar con espera exponencial cuando la Admin API responda
  por límite de consumo (*throttling*).
- **FR-014**: El backend DEBE excluir de la respuesta las entradas inválidas (campo obligatorio vacío,
  coordenadas fuera de rango, textos que superan los límites del CT-01) y registrar una advertencia por
  cada una.
- **FR-015**: El backend DEBE devolver los puntos ordenados por `nombre` (orden español, sin distinguir
  mayúsculas ni tildes) y registrar una advertencia si hay identificadores duplicados.
- **FR-016**: El backend DEBE cachear la lista por tienda con un TTL configurable (300 s por defecto),
  unificar las cargas simultáneas de una misma tienda (*single-flight*), servir la copia vencida mientras
  la refresca (*stale-while-revalidate*) y, si Shopify falla, servir la última copia válida durante hasta
  24 h marcada con `stale: true` (*stale-if-error*).
- **FR-017**: El endpoint NO DEBE depender de cookies ni de estado del navegador; el App Proxy elimina
  `Set-Cookie`.
- **FR-018**: La respuesta DEBE contener solo datos públicos de la tienda (ningún dato de compradores) y
  enviar `Cache-Control: public, max-age=60`.

**Carrito: app embed (US-2, US-7)**

- **FR-020**: La app DEBE incluir una theme app extension con un app embed llamado "Punto de recogida"
  (`target: body`) que el comerciante activa en el editor de temas.
- **FR-021**: El embed DEBE actuar solo en carritos resolado. En los demás NO DEBE mostrar nada ni llamar
  al backend.
- **FR-022**: El embed DEBE tomar el estado inicial del carrito desde Liquid, sin peticiones extra, y volver
  a evaluarlo cuando el carrito cambie por la Ajax Cart API (agregar, cambiar, actualizar, vaciar), por
  eventos del tema o al volver a la pestaña.
- **FR-023**: En carritos resolado, el embed DEBE mostrar el selector junto a cada grupo visible de botones
  de checkout de la página `/cart` y del cart drawer, con un estado compartido entre instancias. En
  contextos compactos (EC-24) DEBE bloquear el botón y mostrar un enlace breve a `/cart`.
- **FR-024**: El selector DEBE ser un combobox con buscador que filtra en el cliente por nombre, dirección,
  dirección corta e identificador, sin distinguir mayúsculas ni tildes. Muestra hasta 50 resultados y el
  total de coincidencias; sin texto de búsqueda muestra los primeros 50 por orden alfabético y la
  indicación "Escribe para buscar entre N puntos". Cada opción muestra el nombre y la dirección corta.
- **FR-025**: El selector DEBE seguir el patrón combobox de ARIA 1.2 (navegación con teclado, foco,
  `aria-activedescendant`, región viva con el conteo y los errores) y cumplir WCAG 2.1 AA.
- **FR-026**: Mientras un carrito resolado no tenga punto, el embed DEBE deshabilitar los botones de
  checkout (`disabled` y `aria-disabled`), impedir la navegación a `/checkout` desde enlaces y envíos de
  formulario, ocultar los botones de pago acelerado y mostrar el motivo: "Elige un punto de recogida para
  continuar".
- **FR-027**: Al elegir un punto, el embed DEBE guardar en el carrito los 7 atributos `punto_*` del CT-02 en
  una sola llamada a `/cart/update.js`. Solo si la llamada tiene éxito, habilita el checkout y muestra el
  punto elegido con la opción "Cambiar". Si falla, muestra el error y mantiene el bloqueo.
- **FR-028**: Al cargar un carrito resolado que ya tiene punto, el embed DEBE revalidarlo contra la lista: si
  el punto ya no existe, borra los `punto_*` y pide otro; si sus datos cambiaron, actualiza los atributos
  con los datos vigentes.
- **FR-029**: En un carrito que no es resolado y tiene atributos `punto_*`, el embed DEBE eliminarlos.
- **FR-030**: En carritos resolado, el embed DEBE mostrar el aviso: "Este pedido se entrega en un punto de
  recogida. En el checkout te pediremos una dirección, pero no se usará para el envío."
- **FR-031**: El embed DEBE mostrar los estados de carga, error con reintento, lista vacía y punto elegido;
  con error o lista vacía el checkout sigue bloqueado.
- **FR-032**: El embed DEBE ofrecer en el editor de temas los ajustes del CT-06: título, texto de ayuda,
  selectores CSS configurables y modo demo.
- **FR-033**: Con el modo demo activado, el embed DEBE mostrar en el carrito un interruptor que agrega o
  quita `tipo_carrito=resolado`; al desactivarlo también quita los `punto_*`. Con el modo demo desactivado
  (valor por defecto) el interruptor NO DEBE existir.
- **FR-034**: Todo texto que venga de datos (puntos o atributos) DEBE mostrarse como texto, nunca como HTML.
- **FR-035**: Todos los textos visibles DEBEN estar en archivos de locales en español.
- **FR-036**: El embed NO DEBE guardar nada en el almacenamiento del navegador (ni cookies, ni
  `localStorage`, ni `sessionStorage`): la fuente de verdad es el carrito de Shopify.

**Checkout: Functions (US-3)**

- **FR-040**: La app DEBE incluir la Function `ocultar-envios` (Delivery Customization API, target
  `cart.delivery-options.transform.run`), que aplica la tabla de decisión del CT-04.
- **FR-041**: La app DEBE incluir la Function `renombrar-recogida` (misma API y target), que aplica la tabla
  y el formato de título del CT-05.
- **FR-042**: Ambas Functions DEBEN reconocer la tarifa de recogida comparando su título normalizado (sin
  tildes, en minúsculas y con los espacios colapsados) con el de la constante compartida
  `TITULO_TARIFA_RECOGIDA = "Recogida en punto de entrega"`.
- **FR-043**: Cada Function DEBE funcionar sola, sin suponer un orden de ejecución ni que la otra ya corrió.
- **FR-044**: Las Functions DEBEN procesar todos los grupos de entrega del carrito.
- **FR-045**: Las Functions DEBEN escribirse en TypeScript y compilarse a WebAssembly con Shopify CLI,
  dentro de los límites de la plataforma y con el margen de instrucciones del NFR-06.
- **FR-046**: Las Functions NO DEBEN recibir la lista de puntos: solo leen atributos del carrito y opciones
  de entrega.
- **FR-047**: Para las Functions, un punto está "presente" solo si `punto_id`, sin espacios en los extremos,
  no está vacío.

**Pedido y página de pedido (US-4)**

- **FR-050**: La app NO DEBE guardar el punto en ninguna base propia: la copia son los atributos del carrito,
  que Shopify copia al pedido al pagar.
- **FR-051**: La app DEBE incluir una customer account UI extension en el target
  `customer-account.order-status.block.render`. Si el pedido tiene `punto_id`, muestra el nombre, la
  dirección, el identificador y el enlace "Ver en el mapa" (Google Maps con `punto_lat` y `punto_lng`);
  en otro caso no muestra nada.
- **FR-052**: La extensión de pedido NO DEBE hacer peticiones de red.
- **FR-053**: La extensión DEBE tener sus textos en locales en español y omitir el enlace al mapa si las
  coordenadas no son números válidos.

**Página de admin (US-5)**

- **FR-055**: La app DEBE tener una página de admin embebida (Polaris web components y App Bridge) con: qué
  hace la app, una lista de 5 pasos con su estado, cómo funciona, el modo demo y un aviso sobre la
  desinstalación (EC-20).
- **FR-056**: El paso "Puntos" DEBE mostrar la cantidad de entradas y abrir la lista de entradas del
  metaobjeto en el admin.
- **FR-057**: El paso "Personalizaciones de entrega" DEBE indicar si las 2 personalizaciones de esta app
  existen y están activas, y tener un botón "Activar" idempotente: crea las que faltan con `functionHandle`,
  activa las desactivadas, nunca duplica y muestra los `userErrors` de Shopify.
- **FR-058**: El paso "App embed" DEBE abrir el editor del tema publicado con el embed preseleccionado
  (`context=apps&activateAppId={api_key}/selector-punto`).
- **FR-059**: El paso "Tarifa" DEBE mostrar el nombre exacto de la tarifa, explicar que debe existir en todas
  las zonas de todos los perfiles de envío que puedan participar en un carrito resolado y enlazar a
  Configuración → Envío y entrega.
- **FR-060**: El paso "Bloque de pedido" DEBE explicar cómo agregar el bloque "Punto de recogida" a la página
  de estado del pedido desde el editor de checkout y cuentas, con un enlace a la configuración de checkout.
- **FR-061**: La página DEBE autenticarse con session tokens de App Bridge (mecanismo del template) y no
  usar cookies de terceros.

**Webhooks, privacidad y cumplimiento**

- **FR-065**: El backend DEBE atender `app/uninstalled` borrando las sesiones de la tienda y vaciando su
  caché.
- **FR-066**: El backend DEBE atender `app/scopes_update` actualizando el scope guardado en la sesión.
- **FR-067**: El backend DEBE atender los webhooks obligatorios `customers/data_request`,
  `customers/redact` y `shop/redact` respondiendo 200. Como la app no guarda datos de compradores,
  `customers/*` solo se registra y `shop/redact` borra cualquier dato que quede de la tienda.
- **FR-068**: El backend DEBE servir una política de privacidad pública en `/privacidad`, en español.
- **FR-069**: La app DEBE pedir solo los scopes `write_delivery_customizations` y `write_app_proxy`.

**Despliegue y portabilidad (US-6)**

- **FR-075**: El backend DEBE empaquetarse como imagen de contenedor OCI (Dockerfile multietapa) que escuche
  en `PORT`, corra con un usuario sin privilegios y exponga `GET /healthz`.
- **FR-076**: Toda la configuración del backend DEBE leerse de variables de entorno validadas al arrancar
  (CT-09). Si falta una obligatoria, el proceso DEBE terminar con un mensaje claro.
- **FR-077**: Las dependencias de infraestructura del backend (sesiones, caché, registro) DEBEN estar detrás
  de puertos, con la implementación elegida por configuración (por ejemplo,
  `SESSION_STORAGE_DRIVER=firestore|memoria`).
- **FR-078**: El repositorio DEBE incluir una CLI de despliegue en TypeScript con la interfaz
  `ProveedorDespliegue` (CT-10), un orquestador independiente del proveedor, un registro de proveedores, el
  adaptador `gcp` completo y un esqueleto documentado para nuevos proveedores.
- **FR-079**: La CLI DEBE ejecutarse con `npm run deploy -- --proveedor <nombre> [--dry-run] [--paso <paso>]`,
  leer la configuración neutral de `deploy/deploy.config.json` y los secretos del entorno o de
  `.env.deploy` (ignorado por git).
- **FR-080**: La CLI DEBE ser idempotente, NO DEBE mostrar secretos ni pasarlos como argumentos de comandos
  (los envía por stdin) y ante cualquier fallo DEBE terminar con código distinto de 0 y un mensaje que diga
  qué hacer.
- **FR-081**: Después de desplegar, la CLI DEBE imprimir la URL del servicio, ajustar `SHOPIFY_APP_URL` si no
  coincide y listar los pasos siguientes (actualizar `application_url` y `redirect_urls` en
  `shopify.app.toml` y ejecutar `shopify app deploy`).
- **FR-082**: Pedir un proveedor sin implementar DEBE fallar con un error que remita a la guía "Agregar un
  proveedor" del README.
- **FR-083**: Ningún SDK ni CLI de un proveedor de nube DEBE usarse fuera de `app/infrastructure/**` y
  `deploy/src/proveedores/**`. Una regla de lint de imports restringidos lo verifica.

**Documentación**

- **FR-085**: El repositorio DEBE incluir un `README.md` en español con el índice y el contenido mínimo del
  §25.
- **FR-086**: El README DEBE incluir instrucciones reproducibles para compilar las Functions de TypeScript a
  WebAssembly, ejecutarlas con fixtures y medir las instrucciones que consumen.
- **FR-087**: El README DEBE incluir la guía paso a paso de despliegue en Google Cloud con la CLI y la guía
  para agregar otro proveedor.
- **FR-088**: El README DEBE explicar la configuración de la tienda (tarifa en todas las zonas, puntos,
  embed, personalizaciones y bloque de pedido) y una tabla de solución de problemas.

**Pruebas**

- **FR-090**: El repositorio DEBE incluir las suites automatizadas del §24 y el checklist E2E del Anexo B.
- **FR-091**: `npm test`, desde la raíz, DEBE ejecutar todas las suites automatizadas.
- **FR-092**: La cobertura de líneas en las capas de dominio y aplicación DEBE ser del 90 % o más.

### 5.2 Requisitos no funcionales

| ID | Atributo | Requisito medible |
|---|---|---|
| NFR-01 | Rendimiento del proxy | Con caché caliente, p95 ≤ 300 ms en el backend. Con 1.000 puntos y caché fría, ≤ 5 s incluida la paginación |
| NFR-02 | Rendimiento del selector | Con 5.000 puntos, el filtrado responde en ≤ 100 ms por pulsación en un móvil de gama media |
| NFR-03 | Peso en la tienda | Bundle JS del embed ≤ 20 KB minificado; CSS ≤ 6 KB; Liquid de la extensión por debajo del límite de 100 KB de la plataforma |
| NFR-04 | Impacto en la tienda | Pérdida ≤ 10 puntos en Lighthouse (requisito del App Store); cero peticiones al backend en páginas con carrito normal |
| NFR-05 | Escala | Diseño válido hasta 5.000 puntos (respuesta de unos 1,5 MB sin comprimir y unos 300 KB comprimida). Más allá, la v2 agrega búsqueda en el servidor |
| NFR-06 | Functions | Margen ≥ 50 % bajo el límite de instrucciones en el fixture de peor caso (10 grupos × 20 opciones); binario, input y output dentro de los límites de la plataforma |
| NFR-07 | Disponibilidad | Las reglas del checkout no dependen del backend (US-3.5) |
| NFR-08 | Seguridad | Toda entrada autenticada (HMAC o session token), mínimo privilegio, secretos en el gestor de secretos, sin XSS |
| NFR-09 | Privacidad | La app no guarda datos personales de compradores; los logs no los incluyen |
| NFR-10 | Accesibilidad | WCAG 2.1 AA en el selector y en la página de admin |
| NFR-11 | Compatibilidad | Dawn y Horizon (últimas versiones), en la página `/cart` y el cart drawer, en escritorio y móvil. Otros temas OS 2.0 mediante los selectores configurables |
| NFR-12 | Mantenibilidad | Principios I y II de la constitución; cobertura ≥ 90 % en dominio y aplicación |
| NFR-13 | Portabilidad | Agregar un proveedor no modifica dominio ni aplicación (principio V) |
| NFR-14 | Observabilidad | Logs JSON estructurados con `severity`, evento, tienda y duración; métricas de caché y de carga derivables de los logs |
| NFR-15 | Costo | Sin costos fijos en la referencia de Google Cloud (Cloud Run con 0 instancias mínimas y Firestore dentro de la cuota gratuita para las sesiones) |
| NFR-16 | Idioma | Interfaz en español; ningún texto visible fuera de los archivos de locales |

### 5.3 Entidades clave

- **PuntoRecogida**: identificador (de negocio), gid (técnico), nombre, dirección, dirección corta, latitud y
  longitud. Origen: el metaobjeto. Invariantes: campos obligatorios, rangos de coordenadas y longitudes
  máximas del CT-01.
- **SeleccionPunto (snapshot)**: copia de un PuntoRecogida en los atributos `punto_*` del carrito; queda
  congelada en el pedido al pagar.
- **Carrito**: atributos (incluido `tipo_carrito`), líneas y grupos de entrega. Estados derivados:
  resolado/normal y con punto/sin punto.
- **Pedido**: copia inmutable de los atributos del carrito (`customAttributes`).
- **OpcionEntrega**: handle y título; puede ser la tarifa de recogida.
- **InstalacionTienda (sesión)**: tienda, token offline y scopes. Es la única persistencia propia.
- **PersonalizacionEntrega**: registro de Shopify que activa una Function (id, handle de la Function,
  título, activa).
- **ConfiguracionEmbed**: ajustes del app embed guardados en el tema.

## 6. Criterios de éxito *(obligatorio)*

- **SC-001**: 0 pedidos resolado completados sin punto en toda la matriz E2E, incluidos el acceso directo
  a `/checkout` y los pagos acelerados.
- **SC-002**: En el 100 % de los casos resolado con punto, el comprador ve exactamente 1 opción de entrega,
  con la dirección corta del punto.
- **SC-003**: En el 100 % de los carritos normales, las opciones de entrega son las mismas que sin la app,
  salvo la tarifa de recogida.
- **SC-004**: Con 500 puntos o más, un comprador encuentra y elige un punto conocido en 30 s o menos; con 3
  caracteres escritos, la lista baja a 50 resultados o menos en el caso típico.
- **SC-005**: Con caché caliente, la lista de puntos aparece en 2 s o menos desde que se abre el carrito
  (p95).
- **SC-006**: Editar o borrar un punto modifica 0 campos de los pedidos ya realizados.
- **SC-007**: El 100 % de los pedidos resolado muestran el punto en la página de estado del pedido.
- **SC-008**: Un comerciante nuevo completa la configuración en 15 minutos o menos usando solo la página de
  admin y el README.
- **SC-009**: Un operador despliega el backend en un proyecto de Google Cloud vacío en 30 minutos o menos,
  con 1 comando de despliegue y 5 pasos manuales como máximo.
- **SC-010**: Agregar un proveedor de nube requiere 0 cambios en las capas de dominio y aplicación.
- **SC-011**: Con el backend caído, las reglas del checkout se cumplen en el 100 % de los casos de la matriz.
- **SC-012**: La app supera la revisión del App Store sin observaciones sobre privacidad, rendimiento o
  permisos.

## 7. Supuestos y dependencias

- La tienda no está en el plan Shopify Starter (ahí no hay Functions).
- La tienda usa el checkout con extensiones (sin `checkout.liquid`) y las cuentas de cliente nuevas, en las
  que vive la página de estado del pedido.
- El tema es Online Store 2.0 (admite app embeds). Temas de referencia: Dawn y Horizon.
- El comerciante crea una tarifa manual llamada exactamente "Recogida en punto de entrega" (el precio lo
  decide él) en todas las zonas de todos los perfiles de envío que puedan participar en un carrito resolado.
- `tipo_carrito=resolado` lo escribe un sistema externo. El README da ejemplos: un input oculto
  `attributes[tipo_carrito]` en el formulario de producto, una llamada a `/cart/update.js` u otra app.
- La app es gratuita (no usa la Billing API).
- Existen una cuenta de Shopify Partners con Dev Dashboard, una development store, un proyecto de Google
  Cloud con facturación y las herramientas del §9.
- Volumen previsto: hasta 5.000 puntos a mediano plazo.
- La distribución pública no se puede cambiar después de elegirla, y la aprobación del App Store es un
  proceso externo con plazos de Shopify.
- Dependencias externas: Shopify (Admin API, App Proxy, Functions y extensiones) y, en la referencia,
  Google Cloud (Cloud Run, Firestore, Secret Manager, Artifact Registry y Cloud Build).

## 8. Matriz de trazabilidad (enunciado → especificación)

| Requisito del enunciado o del pedido | US | FR | Contratos y diseño |
|---|---|---|---|
| Nota: solo carritos con `tipo_carrito = resolado`; el resto funciona como siempre | US-2, US-3 | FR-021, FR-029, FR-040 | CT-02, CT-04 |
| Nota: en el futuro, más de 500 puntos | US-2 | FR-013, FR-016, FR-024 | CT-03, §15, NFR-02, NFR-05 |
| 1. Metaobjeto con Identificador, Nombre, Dirección, Dirección reducida, Latitud y Longitud, sin pantalla nueva | US-1 | FR-001 a FR-004 | CT-01 |
| 2. Theme app extension para elegir el punto en el carrito | US-2 | FR-020 a FR-036 | CT-06, §17 |
| 2. La extensión llama al backend, que devuelve la información | US-2 | FR-010 a FR-018 | CT-03, §15 |
| 2. Desplegable (el mapa es opcional) | US-2 | FR-024, FR-025 | DEC-11 |
| 2. Solo en carritos resolado | US-2 | FR-021, FR-029 | CT-02 |
| 2. No se puede pulsar ir al checkout sin punto | US-2, US-3 | FR-026, FR-040 | CT-04 |
| 2. Guardar toda la información del punto; el pedido no cambia si el punto cambia o se borra | US-2, US-4 | FR-027, FR-050 | CT-02, DEC-05 |
| 3. Function: la recogida solo en resolado y como única opción | US-3 | FR-040, FR-042 a FR-044, FR-047 | CT-04 |
| 3. Function: renombrar con la dirección en formato reducido | US-3 | FR-041 | CT-05 |
| 3. Avisar sin Plus que no se usará la dirección | US-2, US-3 | FR-030, FR-041 | CT-05 |
| 4. Extensión para la página de pedido de las cuentas nuevas | US-4 | FR-051 a FR-053 | CT-07, §19 |
| 5. Información en el admin sobre qué ofrece la app y cómo configurarla | US-5 | FR-055 a FR-061 | §16 |
| Pedido: Node listo para Google Cloud, con instrucciones | US-6 | FR-075 a FR-083, FR-087 | CT-09, CT-10, §20 |
| Pedido: código de cada extensión y código a compilar en wasm, con instrucciones | US-2 a US-4 | FR-045, FR-086 | §17, §18, §19 |
| Pedido: README generoso | todas | FR-085 a FR-088 | §25 |
| Pedido: SOLID, Clean Architecture, Clean Code y nube abstraída | todas | FR-077, FR-078, FR-083 | §10, §11, §20, constitución |

---

# PARTE II — PLAN TÉCNICO (cómo)

## 9. Resumen técnico y contexto técnico

**Resumen**: una app **pública de Shopify con visibilidad limitada**, formada por:

- un **backend** React Router (Node 24, TypeScript) empaquetado como contenedor y desplegado en Cloud Run
  mediante una CLI con proveedores intercambiables;
- un **metaobjeto app-owned** declarado en TOML;
- un **app embed** cuyo JavaScript (TypeScript empaquetado con esbuild) pide los puntos al backend por el
  App Proxy y guarda la selección en los atributos del carrito;
- **dos Delivery Customization Functions** en TypeScript compiladas a WebAssembly;
- una **customer account UI extension** en Preact.

Los datos de negocio viven en Shopify (metaobjetos y atributos); el backend solo guarda las sesiones.

| Campo | Valor |
|---|---|
| **Language/Version** | TypeScript 5.x en modo `strict`; Node.js 24 LTS (`engines.node >= 24`); Liquid para el bloque del embed |
| **Primary Dependencies** | Template React Router de Shopify (`@shopify/shopify-app-react-router`, React Router 7), App Bridge, Polaris web components, `@shopify/shopify-app-session-storage` (interfaz) y `@shopify/shopify-app-session-storage-memory`, `@google-cloud/firestore`, `zod` (validación de configuración), esbuild (bundle del embed), `@shopify/shopify_function` (Functions en JS/TS), `@shopify/ui-extensions` con Preact (extensión de pedido), `tsx` (CLI de despliegue) |
| **Storage** | Firestore (modo nativo, base `(default)`) solo para sesiones OAuth. Datos de negocio en Shopify (metaobjetos y atributos) |
| **Testing** | Vitest (backend, núcleo del carrito, núcleo de las Functions, contratos, CLI de despliegue); harness de fixtures de Shopify CLI para las Functions sobre el wasm compilado; emulador de Firestore opcional para los contract tests; checklist E2E manual |
| **Target Platform** | Shopify (Admin, Online Store, Checkout Functions, Customer Accounts); contenedor Linux x86-64 (Cloud Run en la referencia) |
| **Project Type** | Monorepo de app Shopify: web service, extensiones, paquetes compartidos y CLI |
| **Performance Goals** | NFR-01 a NFR-06 |
| **Constraints** | Sin Plus; Functions sin red; App Proxy sin cookies; límites de Functions según la documentación de Shopify (del orden de 256 kB de binario, 128 kB de input, 11 M de instrucciones y 20 kB de output: el README DEBE citarlos de la doc vigente); máximo 25 delivery customizations por tienda; 100 KB de Liquid por theme app extension |
| **Scale/Scope** | Hasta 5.000 puntos por tienda; multitienda (una app pública, sesiones por tienda) |
| **Shopify API** | 2026-07 en `shopify.app.toml`, webhooks, Functions y UI extensions. Se actualiza a 2026-10 cuando sea estable, si no hay cambios incompatibles |

Herramientas necesarias: Node.js 24 LTS y npm, Git, Shopify CLI (última versión), Google Cloud CLI
(`gcloud`) y, opcionalmente, Java 11+ para el emulador de Firestore.

## 10. Principios, Constitution Check y Complexity Tracking

### 10.1 Principios de diseño de la solución

1. **Cada responsabilidad en la pieza de Shopify hecha para eso**: datos en metaobjetos, UI de tienda en el
   tema, reglas en Functions, registro histórico en los atributos del pedido y visualización en la página
   de pedido.
2. **El servidor manda**: el JS del carrito es experiencia de usuario; la garantía está en las Functions,
   que fallan cerradas.
3. **Una copia, no una referencia**: el pedido guarda los datos del punto tal como estaban el día de la
   compra, sin base de datos propia.
4. **El checkout no depende del backend**: las Functions no tienen red ni flechas hacia el backend.
5. **Nube abstraída**: el backend y su despliegue no conocen al proveedor fuera de los adaptadores.

### 10.2 Constitution Check (compuertas)

| Principio de la constitución | Cómo lo cumple este diseño | Estado |
|---|---|---|
| I. Arquitectura limpia y SOLID | Capas por pieza (§11.3), puertos y composition roots (§11.4), contract tests (§24) | PASS |
| II. Código limpio | TS strict, contratos en `@puntos-recogida/contratos`, lint y formato como compuerta | PASS |
| III. El servidor manda | Tablas de decisión fail-closed en CT-04 y CT-05; el embed es solo UX | PASS |
| IV. La plataforma primero | Metaobjetos, atributos y extensiones; única persistencia propia: sesiones | PASS |
| V. Portabilidad y 12-factor | Configuración por entorno (CT-09), puertos (§20.1), CLI con `ProveedorDespliegue` (CT-10), FR-083 | PASS |
| VI. Seguridad y privacidad | HMAC y session tokens, 2 scopes, secretos por stdin, sin datos de compradores (§23) | PASS |
| VII. Pruebas en piezas críticas | Suites del §24, cobertura ≥ 90 % en dominio y aplicación | PASS |
| VIII. Documentación | README del §25; decisiones DEC-nn (§12) | PASS |

### 10.3 Complexity Tracking

| Complejidad agregada | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Monorepo con `packages/` (contratos y selector) | Las claves de atributos, el título de la tarifa y la normalización se usan en 4 entornos de ejecución (backend, navegador, wasm, extensión de pedido); duplicarlos rompe la regla de fuente única | Copiar constantes en cada pieza: riesgo real de desincronización silenciosa |
| Paso de build del embed (esbuild) | La carpeta de una theme app extension solo admite `assets`, `blocks`, `snippets` y `locales`; el código fuente en TypeScript con tests vive fuera y se empaqueta en `assets/` | JS escrito a mano en `assets/`: sin tipos ni tests de la lógica pura |
| CLI de despliegue con proveedores | Pedido explícito: nube abstraída detrás de una interfaz | Un script `gcloud` suelto: acopla el proyecto a Google Cloud |
| Dos configuraciones de app (dev y prod) | `shopify app dev` nunca debe tocar la app publicada | Una sola app: riesgo de romper instalaciones reales durante el desarrollo |

## 11. Arquitectura

### 11.1 Diagrama de componentes

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

Las Functions no tienen ninguna flecha hacia el backend: es una decisión de diseño (principio 4).

### 11.2 Flujo de punta a punta

1. **Instalación.** OAuth con *token exchange* (app embebida) y sesión offline guardada en el
   `SessionStorage` configurado. El `shopify app deploy` previo ya creó la definición del metaobjeto y
   registró extensiones, Functions, proxy y webhooks.
2. **Configuración.** El comerciante carga los puntos, crea la tarifa en todas las zonas, activa el embed
   con el deep link, pulsa "Activar" (el backend ejecuta `deliveryCustomizationCreate` para cada Function)
   y agrega el bloque de pedido.
3. **Carrito.** Un sistema externo escribe `tipo_carrito=resolado`. El embed lo detecta (Liquid o
   reevaluación) y pide `GET /apps/puntos-recogida/puntos`. Shopify firma la petición y la reenvía a
   `/proxy/puntos`. El backend verifica la firma, obtiene el cliente Admin con la sesión de esa tienda,
   responde desde la caché o pagina los metaobjetos, y devuelve el JSON del CT-03.
4. **Selección.** El comprador elige un punto; `POST /cart/update.js` guarda los atributos `punto_*` y el
   checkout se habilita.
5. **Checkout.** Shopify calcula las tarifas según la zona de la dirección y ejecuta las 2 Functions con su
   input query; aplica las operaciones devueltas y queda una sola opción renombrada.
6. **Pedido.** Shopify copia los atributos del carrito a `Order.customAttributes`. Esa copia no cambia.
7. **Página de pedido.** La extensión lee `shopify.attributes` y muestra el punto.

### 11.3 Capas por pieza (Clean Architecture proporcional)

| Pieza | Capas | Regla de dependencias |
|---|---|---|
| Backend (`app/`) | `domain` → `application` (`ports`, `use-cases`) → `infrastructure` (adaptadores `*.server.ts`) → `composition` (composition root) → `routes` (controladores delgados) | El dominio no importa nada externo; la aplicación importa solo dominio y puertos; la infraestructura implementa puertos; las rutas solo invocan casos de uso que les entrega el contenedor |
| Functions (`extensions/ocultar-envios`, `extensions/renombrar-recogida`) | `src/dominio/*` (decisión pura) + adaptador generado por la CLI (input → dominio → operaciones) | El dominio no conoce los tipos generados de Shopify; el adaptador traduce |
| JS del carrito (`packages/selector-carrito`) | `dominio` (puro) → `aplicacion` (controlador y puertos) → `infraestructura` (DOM, `fetch`) → `main.ts` (composition root del navegador) | El dominio no toca ni DOM ni red |
| Extensión de pedido (`extensions/punto-pedido`) | Lectura pura de la selección (desde contratos) + presentador Preact | Sin red |
| CLI de despliegue (`deploy/`) | `dominio` (configuración, plan de pasos) → `aplicacion` (orquestador) → `puertos` (`ProveedorDespliegue`, `EjecutorComandos`) → `proveedores/*` e `infraestructura` | El orquestador no sabe nada de `gcloud` |
| Contratos (`packages/contratos`) | Constantes y funciones puras, sin dependencias | Lo importan todas las piezas |

### 11.4 SOLID aplicado

| Principio | Aplicación concreta |
|---|---|
| SRP | Un caso de uso por módulo (`ListarPuntosRecogida`, `ActivarPersonalizacionesEntrega`…). Una Function oculta y otra renombra. `GuardiaCheckout` solo bloquea; `VistaCombobox` solo pinta |
| OCP | Proveedor nuevo = carpeta nueva en `deploy/src/proveedores/<nombre>` + registro. Almacenamiento de sesiones nuevo = adaptador nuevo de `SessionStorage` + valor de `SESSION_STORAGE_DRIVER`. Compatibilidad de temas por configuración (selectores CSS), sin tocar código |
| LSP | Suites de contract tests compartidas para `SessionStorage` (Firestore y memoria), `CachePuntos` y `ProveedorDespliegue` (con ejecutor falso) |
| ISP | Puertos pequeños: `FuentePuntos`, `CachePuntos`, `GatewayPersonalizaciones`, `ConsultaConfiguracionTienda`, `Registro`, `Reloj`, `ClienteCarrito`, `ClientePuntos`, `EjecutorComandos` |
| DIP | Los casos de uso y el controlador del carrito reciben los puertos por constructor. Los composition roots (`app/composition/contenedor.server.ts`, `packages/selector-carrito/src/main.ts`, `deploy/src/cli.ts`) eligen las implementaciones |

### 11.5 Paquete de contratos compartido (`@puntos-recogida/contratos`)

Fuente única de verdad para todo lo que dos o más piezas deben interpretar igual. TypeScript puro, sin
dependencias de runtime, compatible con navegador, Node y QuickJS (Javy).

| Exporta | Contenido |
|---|---|
| `CLAVES_ATRIBUTO` | `tipo_carrito`, `punto_id`, `punto_gid`, `punto_nombre`, `punto_direccion`, `punto_direccion_corta`, `punto_lat`, `punto_lng` |
| `VALOR_TIPO_RESOLADO` | `"resolado"` |
| `TITULO_TARIFA_RECOGIDA` | `"Recogida en punto de entrega"` |
| `LIMITES` | identificador 40, nombre 100, dirección 255, dirección corta 60 (coinciden con el CT-01) |
| `normalizarTexto(texto)` | Recorta, colapsa espacios, pasa a minúsculas y reemplaza vocales acentuadas, `ü` y `ñ` mediante una **tabla explícita** (no depende de `String.prototype.normalize`, para comportarse igual en QuickJS) |
| `tieneValor(valor)` | `true` si el valor, recortado, no está vacío |
| `esCarritoResolado(valor)` | `normalizarTexto(valor) === "resolado"` |
| `esTarifaRecogida(titulo)` | Compara títulos normalizados |
| `formatearTituloRecogida(direccionCorta)` | Formato del CT-05 |
| `atributosDeSeleccion(punto)` / `atributosVaciosSeleccion()` | Mapa de atributos del CT-02 para guardar o borrar la selección |
| `leerSeleccionDeAtributos(atributos)` | `SeleccionPunto` o `null`; lo usan el embed y la extensión de pedido |
| DTO | `PuntoRecogidaDto`, `RespuestaPuntosDto`, `ErrorProxyDto` (CT-03) |

Un **test de coherencia** lee las input queries (`.graphql`) de ambas Functions y falla si alguna clave de
atributo no coincide con `CLAVES_ATRIBUTO`.

## 12. Decisiones (DEC)

**DEC-01 — Distribución pública con visibilidad limitada**
- *Decisión*: la app se publica como pública en el App Store con visibilidad limitada (no aparece en
  búsquedas ni categorías; se instala desde la URL del listing).
- *Razón*: es la única distribución en la que las Functions corren en tiendas sin Plus. La visibilidad se
  puede cambiar en cualquier momento; la distribución, no.
- *Alternativas descartadas*: custom app (sus Functions solo corren en Plus o en development stores).

**DEC-02 — Metaobjeto app-owned declarado en TOML**
- *Decisión*: `$app:punto_recogida` se declara en `shopify.app.toml` con `merchant_read_write`.
- *Razón*: versionado con el código, creado y actualizado por `shopify app deploy`, CRUD nativo para el
  comerciante y esquema protegido. Desde la API 2026-04, la app que lo posee lo lee sin scopes de
  metaobjetos.
- *Alternativas*: metaobjeto del comerciante creado por mutation (requiere scopes y mutations manuales);
  base de datos propia (duplica lo que Shopify ya resuelve).

**DEC-03 — Página de admin embebida (iframe) con React Router y Polaris web components**
- *Decisión*: la página de admin la sirve el backend dentro del iframe del admin.
- *Razón*: las App Home UI extensions (`admin.app.home.render`) están pensadas para apps de distribución
  custom; esta app es pública.
- *Alternativas*: App Home UI extension (no aplica a esta distribución).

**DEC-04 — App Proxy como puente entre la tienda y el backend**
- *Decisión*: el JS del carrito llama a `/apps/puntos-recogida/puntos` en el dominio de la tienda.
- *Razón*: sin CORS, sin secretos en el navegador y con la tienda identificada de forma confiable por la
  firma HMAC.
- *Alternativas*: llamar directo al backend (CORS, tienda falsificable, secretos expuestos).

**DEC-05 — Copia (snapshot) en atributos, no referencia**
- *Decisión*: se guardan todos los datos del punto en atributos del carrito, que Shopify copia al pedido.
- *Razón*: el pedido conserva el punto tal como era el día de la compra aunque después se edite o se borre,
  sin base de datos propia (mismo principio que el precio de una línea de pedido).
- *Alternativas*: guardar solo el ID (el pedido apuntaría a un punto que puede no existir).

**DEC-06 — Dos Functions separadas**
- *Decisión*: `ocultar-envios` y `renombrar-recogida`, cada una autosuficiente.
- *Razón*: lo pide el enunciado y respeta la responsabilidad única. Ninguna depende del orden de ejecución.
- *Alternativas*: una sola Function que oculta y renombra (válida técnicamente, pero no cumple el enunciado).

**DEC-07 — Functions en TypeScript compiladas a wasm con Javy**
- *Decisión*: las Functions se escriben en TypeScript y Shopify CLI las compila a WebAssembly.
- *Razón*: un solo lenguaje en todo el repositorio y una lógica mínima (un recorrido por las opciones de
  entrega con un input de pocos bytes).
- *Riesgo conocido*: Shopify indica que los lenguajes que compilan directo a wasm, como Rust, rinden más, y
  los recomienda para apps públicas.
- *Mitigación*: presupuesto NFR-06 medido en los tests con un fixture de peor caso y núcleo puro aislado,
  para migrar a Rust sin tocar los contratos si hiciera falta.
- *Alternativas*: Rust (más rendimiento, segundo lenguaje y toolchain).

**DEC-08 — Reconocer la tarifa por su título normalizado**
- *Decisión*: las Functions comparan el título normalizado con `TITULO_TARIFA_RECOGIDA`.
- *Razón*: es simple y suficiente para v1; la normalización tolera tildes, mayúsculas y espacios.
- *Riesgo*: si el comerciante renombra la tarifa, deja de reconocerse (EC-10).
- *Mejora v2*: título configurable guardado en un metacampo `jsonValue` de la personalización.

**DEC-09 — Sesiones en Firestore detrás de `SessionStorage`**
- *Decisión*: adaptador propio `FirestoreSessionStorage`, basado en `snippets/firestore-session-storage.server.ts`
  (mismo patrón que el adaptador oficial de MongoDB), y `MemorySessionStorage` para desarrollo.
- *Razón*: la única tabla propia es la de sesiones, y Firestore tiene cuota gratuita sin costo fijo.
  Shopify no publica un adaptador de Firestore; la interfaz oficial permite cambiar de almacenamiento sin
  tocar el resto (Postgres, MySQL, Redis, DynamoDB y MongoDB/Cosmos tienen adaptadores oficiales).
- *Alternativas*: Cloud SQL con Postgres y Prisma (lo recomendado por Shopify, pero con costo fijo desde el
  primer día); SQLite (no sirve en contenedores efímeros).

**DEC-10 — Caché en memoria por instancia detrás del puerto `CachePuntos`**
- *Decisión*: caché en memoria con TTL, *single-flight*, *stale-while-revalidate* y *stale-if-error*.
- *Razón*: los puntos cambian poco y la Admin API limita por costo de consulta; sin caché, cada carrito
  dispararía varias consultas paginadas.
- *Riesgo*: cada instancia nueva arranca con la caché vacía.
- *Alternativas*: Redis o Memorystore (costo fijo); snapshot compartido en Firestore (mejora v2 para los
  arranques en frío).

**DEC-11 — Combobox con buscador y filtrado en el cliente**
- *Decisión*: el proxy devuelve la lista completa y el navegador filtra.
- *Razón*: con 500 a 5.000 puntos el filtrado local es instantáneo y la lista se descarga una vez por carga
  de página.
- *Alternativas*: `<select>` nativo (inusable con más de 500 opciones); búsqueda en el servidor
  (innecesaria hasta 5.000 puntos, queda para v2); mapa (v2).

**DEC-12 — App embed y no app block**
- *Decisión*: toda la lógica del carrito vive en un app embed (`target: body`).
- *Razón*: funciona en cualquier tema OS 2.0 sin depender de secciones que acepten bloques, y cubre tanto la
  página `/cart` como el cart drawer.
- *Límite*: la app no puede activar el embed; solo puede ofrecer el deep link.

**DEC-13 — Código del embed en TypeScript con build de esbuild**
- *Decisión*: el código fuente vive en `packages/selector-carrito/` y esbuild lo empaqueta en
  `extensions/selector-punto/assets/selector-punto.js`.
- *Razón*: tipos, tests de la lógica pura y un único bundle pequeño; la carpeta de la extensión no admite
  código fuente.

**DEC-14 — Extensión de pedido con Preact y Polaris web components (API 2026-07)**
- *Decisión*: la extensión usa Preact, el objeto global `shopify` y componentes `s-*`.
- *Razón*: la API 2025-07 es la última que admite componentes basados en React, y esas extensiones quedan
  bloqueadas para actualizaciones a partir del 1 de octubre de 2026.

**DEC-15 — Configuración 12-factor, puertos y composition root**
- *Decisión*: todo el runtime se configura por variables de entorno y las dependencias de infraestructura se
  eligen en un único composition root.
- *Razón*: portabilidad entre proveedores y tests sin infraestructura real.

**DEC-16 — CLI de despliegue propia con patrón Strategy**
- *Decisión*: interfaz `ProveedorDespliegue`, orquestador y registro de proveedores en TypeScript, con el
  adaptador GCP completo. Sin IaC externo ni CI/CD en v1.
- *Razón*: la nube queda detrás de una interfaz de código explícita, fácil de leer y de probar con un
  ejecutor de comandos falso, sin sumar herramientas ni un backend de estado.
- *Alternativas*: Pulumi (IaC multinube con estado; suma una herramienta), Terraform (otro lenguaje y
  gestión de estado).

**DEC-17 — Google Cloud como proveedor de referencia**
- *Decisión*: Cloud Run, Firestore, Secret Manager, Artifact Registry y Cloud Build.
- *Razón*: costo cero en reposo, contenedores estándar y credenciales por cuenta de servicio (ADC), sin
  claves en el código.

**DEC-18 — Dos configuraciones de app (desarrollo y producción)**
- *Decisión*: `shopify.app.toml` enlazado a la app pública de producción y `shopify.app.dev.toml`
  enlazado a una app de desarrollo.
- *Razón*: `shopify app dev` actualiza URLs y configuración; nunca debe ejecutarse contra la app publicada.

**DEC-19 — API 2026-07 en todas las piezas**
- *Decisión*: 2026-07 en TOML, webhooks, Functions, UI extensions y cliente Admin.
- *Razón*: es la última versión estable a la fecha y cubre `functionHandle`, metaobjetos app-owned sin
  scopes y Preact en las extensiones.

**DEC-20 — Modo demo como ajuste del app embed**
- *Decisión*: un checkbox del embed habilita un interruptor en el carrito para simular un carrito resolado.
- *Razón*: el evaluador y el revisor necesitan reproducir el flujo; en producción queda desactivado y sin
  rastro en el DOM.

**DEC-21 — `punto_id` es el identificador de negocio y `punto_gid` el técnico**
- *Decisión*: `punto_id` guarda el campo Identificador y `punto_gid` el GID del metaobjeto. Esto refina el
  diseño previo, en el que `punto_id` era el GID.
- *Razón*: quien prepara el pedido reconoce el identificador ("PR-MAD-001"), no un GID; el GID queda para
  la trazabilidad y la futura validación de `orders/create`.

**DEC-22 — Interfaz solo en español**
- *Decisión*: todos los textos van en locales `es`, sin inglés en v1.
- *Razón*: la tienda es española; los locales dejan la traducción lista para después. El listing del App
  Store se redacta en inglés (idioma principal del listing) con traducción al español.

**DEC-23 — Scopes mínimos**
- *Decisión*: `write_delivery_customizations` y `write_app_proxy`.
- *Razón*: son los únicos imprescindibles (activar las Functions y configurar el proxy). Los metaobjetos
  app-owned no requieren scopes desde la API 2026-04, y la app no lee pedidos ni clientes.

## 13. Modelo de datos y contratos (CT)

### CT-01 — Metaobjeto `$app:punto_recogida`

| Clave | Nombre visible | Tipo | Obligatorio | Validaciones |
|---|---|---|---|---|
| `identificador` | Identificador | `single_line_text_field` | sí | máx. 40; regex `^[A-Za-z0-9_-]+$` |
| `nombre` | Nombre | `single_line_text_field` | sí | máx. 100 |
| `direccion` | Dirección | `single_line_text_field` | sí | máx. 255 |
| `direccion_corta` | Dirección formato reducido | `single_line_text_field` | sí | máx. 60 |
| `lat` | Latitud | `number_decimal` | sí | mín. -90, máx. 90 |
| `lng` | Longitud | `number_decimal` | sí | mín. -180, máx. 180 |

Contrato de la declaración (en `shopify.app.toml` y `shopify.app.dev.toml`):

```toml
[metaobjects.app.punto_recogida]
name = "Punto de recogida"
description = "Puntos donde los clientes recogen los pedidos de tipo resolado"
display_name_field = "nombre"

[metaobjects.app.punto_recogida.access]
admin = "merchant_read_write"
storefront = "none"

[metaobjects.app.punto_recogida.fields.identificador]
name = "Identificador"
type = "single_line_text_field"
required = true
validations.max = 40
validations.regex = "^[A-Za-z0-9_-]+$"

[metaobjects.app.punto_recogida.fields.nombre]
name = "Nombre"
type = "single_line_text_field"
required = true
validations.max = 100

[metaobjects.app.punto_recogida.fields.direccion]
name = "Dirección"
type = "single_line_text_field"
required = true
validations.max = 255

[metaobjects.app.punto_recogida.fields.direccion_corta]
name = "Dirección formato reducido"
type = "single_line_text_field"
required = true
validations.max = 60

[metaobjects.app.punto_recogida.fields.lat]
name = "Latitud"
type = "number_decimal"
required = true
validations.min = -90.0
validations.max = 90.0

[metaobjects.app.punto_recogida.fields.lng]
name = "Longitud"
type = "number_decimal"
required = true
validations.min = -180.0
validations.max = 180.0
```

La sintaxis se confirma con el primer `shopify app dev` o `shopify app deploy` contra la app de desarrollo;
la CLI valida el TOML. Los límites DEBEN coincidir con `LIMITES` de `@puntos-recogida/contratos`.

### CT-02 — Atributos del carrito (y del pedido)

| Clave | Escribe | Lee | Formato | Ejemplo |
|---|---|---|---|---|
| `tipo_carrito` | Sistema externo (o el modo demo) | Embed, Functions | Texto; es resolado si `esCarritoResolado(valor)` | `resolado` |
| `punto_id` | Embed | Functions (presencia), extensión de pedido, comerciante | Identificador (≤ 40) | `PR-MAD-001` |
| `punto_gid` | Embed | Trazabilidad (validación v2) | GID del metaobjeto | `gid://shopify/Metaobject/1001` |
| `punto_nombre` | Embed | Extensión de pedido, comerciante | ≤ 100 | `Kiosko Sol` |
| `punto_direccion` | Embed | Extensión de pedido, comerciante | ≤ 255 | `Puerta del Sol 1, 28013 Madrid` |
| `punto_direccion_corta` | Embed | Function `renombrar-recogida`, comerciante | ≤ 60 | `Pta. del Sol 1, Madrid` |
| `punto_lat` | Embed | Extensión de pedido | Decimal con punto, hasta 6 decimales | `40.416775` |
| `punto_lng` | Embed | Extensión de pedido | Decimal con punto, hasta 6 decimales | `-3.703790` |

Reglas:

- Los 7 atributos `punto_*` se escriben siempre juntos, en una sola llamada.
- Para borrar la selección se envían los 7 con valor vacío (`""`). Todos los consumidores tratan un valor
  vacío o solo con espacios como ausente (`tieneValor`), así que el comportamiento es correcto tanto si
  Shopify elimina los atributos vacíos como si los conserva vacíos. El E2E lo verifica.
- El embed solo escribe `tipo_carrito` en modo demo.
- Los atributos de carrito siempre son texto.

Llamadas a la Ajax Cart API (desde el navegador):

- `GET {Shopify.routes.root}cart.js`: lee `attributes`.
- `POST {Shopify.routes.root}cart/update.js` con `Content-Type: application/json` y cuerpo
  `{"attributes": {"punto_id": "...", "...": "..."}}`.

### CT-03 — App Proxy y lectura de puntos

Configuración (`shopify.app.toml`):

```toml
[app_proxy]
url = "/proxy"            # relativa: Shopify antepone la URL de la app en dev y deploy
prefix = "apps"
subpath = "puntos-recogida"
```

Cambiar `prefix` o `subpath` solo afecta a las instalaciones nuevas; cambiar `url` afecta a todas. Una app
tiene un único proxy.

**Petición**: `GET https://{dominio-de-la-tienda}/apps/puntos-recogida/puntos`. Shopify la reenvía como
`GET {SHOPIFY_APP_URL}/proxy/puntos?shop={tienda}.myshopify.com&logged_in_customer_id=…&path_prefix=/apps/puntos-recogida&timestamp=…&signature=…`.
El backend ignora cualquier parámetro que no sea de la firma.

**Respuesta 200** (`Content-Type: application/json; charset=utf-8`, `Cache-Control: public, max-age=60`):

```json
{
  "version": 1,
  "generadoEn": "2026-09-25T10:00:00.000Z",
  "stale": false,
  "total": 2,
  "puntos": [
    {
      "id": "PR-MAD-001",
      "gid": "gid://shopify/Metaobject/1001",
      "nombre": "Kiosko Sol",
      "direccion": "Puerta del Sol 1, 28013 Madrid",
      "direccionCorta": "Pta. del Sol 1, Madrid",
      "lat": 40.416775,
      "lng": -3.70379
    },
    {
      "id": "PR-BCN-002",
      "gid": "gid://shopify/Metaobject/1002",
      "nombre": "Librería Gràcia",
      "direccion": "Carrer Gran de Gràcia 10, 08012 Barcelona",
      "direccionCorta": "Gran de Gràcia 10, BCN",
      "lat": 41.3989,
      "lng": 2.1566
    }
  ]
}
```

| Campo | Tipo | Origen |
|---|---|---|
| `version` | número | Versión del esquema de respuesta (1) |
| `generadoEn` | texto ISO 8601 | Momento de la carga desde Shopify |
| `stale` | booleano | `true` si se sirve una copia vencida porque Shopify falló (FR-016) |
| `total` | número | Cantidad de puntos devueltos |
| `puntos[].id` | texto | Campo `identificador` |
| `puntos[].gid` | texto | `id` del metaobjeto |
| `puntos[].nombre`, `direccion`, `direccionCorta` | texto | Campos `nombre`, `direccion` y `direccion_corta`, recortados |
| `puntos[].lat`, `lng` | número | Campos `lat` y `lng` convertidos a número |

**Errores**:

| Estado | Cuándo | Cuerpo |
|---|---|---|
| 400 o 401 | Firma ausente o inválida | Respuesta del paquete de autenticación de Shopify |
| 404 | La tienda no tiene sesión (app no instalada) | `{"error": "APP_NO_INSTALADA", "mensaje": "La app no está instalada en esta tienda."}` |
| 502 | Shopify falló y no hay copia válida en caché | `{"error": "PUNTOS_NO_DISPONIBLES", "mensaje": "No se pudieron obtener los puntos de recogida."}` |
| 500 | Error inesperado | `{"error": "ERROR_INTERNO", "mensaje": "Error interno."}` |

**Consulta a la Admin API** (adaptador `FuentePuntosShopify`, API 2026-07):

```graphql
query PuntosRecogida($after: String, $first: Int!) {
  metaobjects(type: "$app:punto_recogida", first: $first, after: $after) {
    nodes {
      id
      fields { key value }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Reglas del adaptador:

- `first` = `PUNTOS_TAMANO_PAGINA` (250, el máximo de la API); se sigue `endCursor` hasta que
  `hasNextPage` sea `false`.
- Se usa `fields { key value }` y no un alias por campo, para mantener bajo el costo de la consulta.
- Ante un error `THROTTLED`, reintenta con espera exponencial guiada por
  `extensions.cost.throttleStatus`, hasta 5 intentos. Registra `requestedQueryCost` y `actualQueryCost`.
- Si la API rechaza la consulta por costo máximo, reduce el tamaño de página a la mitad y reintenta.
- El mapeo a `PuntoRecogida` y la validación (FR-014) son responsabilidad del dominio, no del adaptador.

### CT-04 — Function `ocultar-envios`

| Clave de `shopify.extension.toml` | Valor |
|---|---|
| `api_version` | `2026-07` |
| `type` / `handle` | `function` / `ocultar-envios` |
| Nombre visible | "Puntos de recogida · ocultar envíos" |
| `target` | `cart.delivery-options.transform.run` |
| `input_query`, `export` y build | Los que genera `shopify app generate extension --template delivery_customization --flavor typescript`; no se renombran |

Input query (el nombre de la operación es el que genere la CLI):

```graphql
query CartDeliveryOptionsTransformRunInput {
  cart {
    tipoCarrito: attribute(key: "tipo_carrito") { value }
    puntoId: attribute(key: "punto_id") { value }
    deliveryGroups {
      deliveryOptions {
        handle
        title
      }
    }
  }
}
```

Tabla de decisión, aplicada a cada opción de cada grupo de entrega (un `title` nulo cuenta como "no es la
tarifa de recogida"):

| Carrito resolado | Punto presente (FR-047) | ¿La opción es la tarifa de recogida? | Operación |
|---|---|---|---|
| No | indiferente | Sí | `deliveryOptionHide` |
| No | indiferente | No | ninguna |
| Sí | Sí | Sí | ninguna (queda visible) |
| Sí | Sí | No | `deliveryOptionHide` |
| Sí | No | Sí | `deliveryOptionHide` |
| Sí | No | No | `deliveryOptionHide` |

Salida de ejemplo:

```json
{ "operations": [ { "deliveryOptionHide": { "deliveryOptionHandle": "dc4b9f18d300-8ba662342" } } ] }
```

### CT-05 — Function `renombrar-recogida`

Misma configuración que el CT-04, con `handle = "renombrar-recogida"` y nombre visible "Puntos de
recogida · renombrar recogida".

```graphql
query CartDeliveryOptionsTransformRunInput {
  cart {
    tipoCarrito: attribute(key: "tipo_carrito") { value }
    puntoId: attribute(key: "punto_id") { value }
    puntoDireccionCorta: attribute(key: "punto_direccion_corta") { value }
    deliveryGroups {
      deliveryOptions {
        handle
        title
      }
    }
  }
}
```

| Carrito resolado | Punto presente | Dirección corta presente | ¿La opción es la tarifa de recogida? | Operación |
|---|---|---|---|---|
| Sí | Sí | Sí | Sí | `deliveryOptionRename` con `Recogida en {direccion_corta} · no se usará tu dirección` |
| Sí | Sí | No | Sí | `deliveryOptionRename` con `Recogida en punto de entrega · no se usará tu dirección` |
| Cualquier otra combinación | | | | ninguna |

Reglas del título (`formatearTituloRecogida`): a la dirección corta se le recortan los extremos, se le
quitan los caracteres de control, se colapsan los espacios y se trunca a 60 caracteres con "…" si es más
larga. El renombrado aplica a tarifas manuales; en las de transportista Shopify antepone el nombre del
transportista (no es el caso de esta tarifa).

```json
{
  "operations": [
    {
      "deliveryOptionRename": {
        "deliveryOptionHandle": "dc4b9f18d300-8ba662342",
        "title": "Recogida en Pta. del Sol 1, Madrid · no se usará tu dirección"
      }
    }
  ]
}
```

**Efecto combinado de ambas Functions**

| Caso | Opciones configuradas en la zona | Lo que ve el comprador |
|---|---|---|
| Carrito normal | Estándar, Exprés, Recogida en punto de entrega | Estándar, Exprés |
| Resolado con punto | Estándar, Exprés, Recogida en punto de entrega | "Recogida en Pta. del Sol 1, Madrid · no se usará tu dirección" |
| Resolado sin punto | Estándar, Exprés, Recogida en punto de entrega | Ninguna opción (fail-closed) |
| Resolado con punto, sin la tarifa en su zona | Estándar, Exprés | Ninguna opción: configuración incompleta (EC-09) |

### CT-06 — Ajustes del app embed y configuración que Liquid entrega al JS

Bloque `blocks/selector-punto.liquid`, schema: `"name": "Punto de recogida"` (el límite de la plataforma es
de 25 caracteres), `"target": "body"`, `"javascript": "selector-punto.js"`,
`"stylesheet": "selector-punto.css"`. Los textos de los ajustes van en `locales/es.default.schema.json`.

| ID del ajuste | Tipo | Valor por defecto | Uso |
|---|---|---|---|
| `titulo` | `text` | `Punto de recogida` | Título del widget |
| `texto_ayuda` | `textarea` | Aviso del FR-030 | Texto bajo el título |
| `selector_botones_checkout` | `text` | `button[name="checkout"], input[name="checkout"], a[href$="/checkout"]` | Botones que se bloquean y junto a los que se inserta el widget |
| `selector_pagos_acelerados` | `text` | `.additional-checkout-buttons, shopify-accelerated-checkout-cart, .shopify-payment-button` | Contenedores de pago acelerado que se ocultan sin punto |
| `selector_insercion` | `text` | vacío | Si tiene valor, el widget se inserta dentro de ese elemento en lugar de antes de los botones |
| `selector_contextos_compactos` | `text` | `#cart-notification, cart-notification` | Contextos donde solo se bloquea y se enlaza a `/cart` (EC-24) |
| `modo_demo` | `checkbox` | `false` | Muestra el interruptor de simulación (FR-033) |

El bloque renderiza un `<script type="application/json" id="pr-config">` con la configuración inicial.
Todos los valores se serializan con el filtro `json` de Liquid:

```json
{
  "tipoCarrito": "resolado",
  "seleccion": { "punto_id": "PR-MAD-001", "punto_gid": "gid://shopify/Metaobject/1001", "punto_nombre": "Kiosko Sol", "punto_direccion": "Puerta del Sol 1, 28013 Madrid", "punto_direccion_corta": "Pta. del Sol 1, Madrid", "punto_lat": "40.416775", "punto_lng": "-3.703790" },
  "rutaRaiz": "/",
  "urlPuntos": "/apps/puntos-recogida/puntos",
  "ajustes": { "titulo": "Punto de recogida", "textoAyuda": "…", "selectorBotonesCheckout": "…", "selectorPagosAcelerados": "…", "selectorInsercion": "", "selectorContextosCompactos": "…", "modoDemo": false },
  "textos": { "buscar": "Busca por nombre, dirección o ciudad", "…": "…" }
}
```

### CT-07 — Extensión de página de pedido `punto-pedido`

| Clave | Valor |
|---|---|
| `api_version` | `2026-07` |
| `type` / `handle` | `ui_extension` / `punto-pedido` |
| `target` | `customer-account.order-status.block.render` |
| `module` | `./src/PuntoPedido.tsx` (Preact) |
| Acceso a red | No se declara (FR-052) |
| API usada | `shopify.attributes` (Attributes API de customer accounts, 2026-07) y `shopify.i18n` |

Contenido visible (solo si `leerSeleccionDeAtributos` devuelve una selección): una sección titulada "Punto
de recogida" con el nombre destacado, la dirección, "Identificador: {punto_id}", el enlace "Ver en el
mapa" (`https://www.google.com/maps/search/?api=1&query={lat},{lng}`, solo con coordenadas válidas) y el
texto "Recoge tu pedido en este punto cuando te avisemos de que está listo."

### CT-08 — Configuración de la app (`shopify.app.toml`, producción)

```toml
name = "Puntos de Recogida"
client_id = "<client_id de la app de producción>"
application_url = "https://<url-del-backend>"
embedded = true

[build]
automatically_update_urls_on_dev = false
include_config_on_deploy = true

[access_scopes]
scopes = "write_delivery_customizations,write_app_proxy"

[auth]
# Las URLs que genera `shopify app config link` para el template, con la URL del backend.
redirect_urls = [ "https://<url-del-backend>/auth/callback" ]

[webhooks]
api_version = "2026-07"

[[webhooks.subscriptions]]
topics = [ "app/uninstalled" ]
uri = "/webhooks/app/uninstalled"

[[webhooks.subscriptions]]
topics = [ "app/scopes_update" ]
uri = "/webhooks/app/scopes_update"

[[webhooks.subscriptions]]
compliance_topics = [ "customers/data_request", "customers/redact", "shop/redact" ]
uri = "/webhooks/compliance"

[app_proxy]
url = "/proxy"
prefix = "apps"
subpath = "puntos-recogida"

# Más la definición [metaobjects.app.punto_recogida] completa del CT-01.
```

`shopify.app.dev.toml` es igual, con el `client_id` de la app de desarrollo y
`automatically_update_urls_on_dev = true`.

### CT-09 — Variables de entorno del backend y esquema de Firestore

| Variable | ¿Obligatoria? | Por defecto | Descripción |
|---|---|---|---|
| `SHOPIFY_API_KEY` | sí | — | `client_id` de la app |
| `SHOPIFY_API_SECRET` | sí (secreto) | — | *Client secret*; en producción lo inyecta el gestor de secretos |
| `SHOPIFY_APP_URL` | sí | — | URL pública del backend; coincide con `application_url` |
| `SCOPES` | sí | — | `write_delivery_customizations,write_app_proxy` |
| `PORT` | no | `3000` | Puerto HTTP; la plataforma lo inyecta (Cloud Run usa 8080) |
| `NODE_ENV` | no | `development` | `production` en el contenedor |
| `SESSION_STORAGE_DRIVER` | no | `memoria` en desarrollo, `firestore` en producción | Adaptador de sesiones |
| `FIRESTORE_PROJECT_ID` | no | Inferido por ADC | Proyecto de Firestore |
| `FIRESTORE_DATABASE_ID` | no | `(default)` | Base de datos de Firestore |
| `FIRESTORE_COLECCION_SESIONES` | no | `shopify_sessions` | Colección de sesiones |
| `FIRESTORE_EMULATOR_HOST` | no | — | Solo desarrollo y tests |
| `PUNTOS_CACHE_TTL_SEGUNDOS` | no | `300` | TTL de la caché de puntos |
| `PUNTOS_CACHE_STALE_MAX_SEGUNDOS` | no | `86400` | Tiempo máximo para servir una copia vencida si Shopify falla |
| `PUNTOS_TAMANO_PAGINA` | no | `250` | Tamaño de página de la Admin API |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn` o `error` |
| `HABILITAR_SEMILLA` | no | `false` | Habilita el FR-005; con `NODE_ENV=production` el arranque DEBE fallar |
| `SHOP_CUSTOM_DOMAIN` | no | — | Heredada del template |

La configuración se valida con `zod` al arrancar (FR-076) y se expone como un objeto tipado e inmutable.

**Firestore** (solo con `SESSION_STORAGE_DRIVER=firestore`):

- Colección `shopify_sessions`. ID de documento = `session.id` (por ejemplo, `offline_{tienda}.myshopify.com`).
- Campos = `Session.toObject()`: `id`, `shop`, `state`, `isOnline`, `scope`, `accessToken` y, si
  existen, `expires`, `onlineAccessInfo`, `refreshToken` y `refreshTokenExpires`. Las fechas se guardan como
  `Timestamp` y se convierten a `Date` al leer.
- Consulta por `shop` con el índice simple automático. No hay datos de compradores.
- Retención: hasta `app/uninstalled` o `shop/redact`.

### CT-10 — CLI de despliegue

Firmas del contrato (TypeScript, sin implementación):

```ts
interface ContextoDespliegue {
  readonly config: ConfigDespliegue;       // deploy.config.json validado
  readonly proveedor: ConfigProveedor;     // bloque del proveedor elegido
  readonly etiquetaImagen: string;         // p. ej. "20260925-1530-a1b2c3d"
  readonly simulacion: boolean;            // --dry-run
  readonly consola: Consola;               // salida para el operador (nunca imprime secretos)
}

interface ProveedorDespliegue {
  readonly nombre: string;                                                         // "gcp"
  verificarPrerrequisitos(ctx: ContextoDespliegue): Promise<void>;                 // CLI instalada, sesión y proyecto
  prepararInfraestructura(ctx: ContextoDespliegue): Promise<void>;                 // idempotente
  publicarSecretos(ctx: ContextoDespliegue, secretos: Secretos): Promise<void>;    // valores por stdin
  construirImagen(ctx: ContextoDespliegue): Promise<ReferenciaImagen>;
  desplegarServicio(ctx: ContextoDespliegue, imagen: ReferenciaImagen): Promise<ResultadoDespliegue>;
  actualizarVariables(ctx: ContextoDespliegue, variables: Readonly<Record<string, string>>): Promise<void>;
}

interface ResultadoDespliegue { readonly url: string; readonly revision: string }

interface EjecutorComandos {
  ejecutar(
    programa: string,
    argumentos: readonly string[],
    opciones?: { readonly entrada?: string },
  ): Promise<{ readonly codigo: number; readonly salida: string; readonly error: string }>;
}
```

Configuración neutral `deploy/deploy.config.json`:

```json
{
  "servicio": "puntos-recogida",
  "puerto": 8080,
  "recursos": { "cpu": 1, "memoriaMiB": 512, "instanciasMin": 0, "instanciasMax": 3, "concurrencia": 80 },
  "variables": {
    "NODE_ENV": "production",
    "SESSION_STORAGE_DRIVER": "firestore",
    "SCOPES": "write_delivery_customizations,write_app_proxy",
    "PUNTOS_CACHE_TTL_SEGUNDOS": "300",
    "LOG_LEVEL": "info"
  },
  "variablesDesdeEntorno": [ "SHOPIFY_API_KEY", "SHOPIFY_APP_URL" ],
  "secretos": { "SHOPIFY_API_SECRET": "shopify-api-secret" },
  "proveedores": {
    "gcp": {
      "proyecto": "<id-del-proyecto>",
      "region": "europe-southwest1",
      "repositorioImagenes": "puntos-recogida",
      "cuentaServicio": "puntos-recogida-run",
      "baseFirestore": "(default)"
    }
  }
}
```

| Opción | Obligatoria | Descripción |
|---|---|---|
| `--proveedor <nombre>` | sí | Proveedor registrado (`gcp`) |
| `--dry-run` | no | Imprime los comandos sin ejecutarlos ni mostrar secretos |
| `--paso <paso>` | no | `verificar`, `infraestructura`, `secretos`, `imagen`, `servicio` o `todo` (por defecto) |
| `--etiqueta <tag>` | no | Etiqueta de la imagen; por defecto, fecha y hora más el hash corto de git si existe |

| Código de salida | Significado |
|---|---|
| 0 | Despliegue correcto |
| 1 | Configuración inválida (JSON o variables faltantes) |
| 2 | Prerrequisitos no cumplidos (CLI ausente, sin sesión, sin proyecto) |
| 3 | Falló un comando del proveedor (el mensaje incluye el paso y el error) |
| 4 | Proveedor no implementado (remite a la guía del README) |

## 14. Estructura del repositorio

`CODE/upango/` es la raíz del repositorio de la app y convive con Spec Kit. La app se crea a partir del
template React Router de Shopify; del template se eliminan Prisma, SQLite (`prisma/`, `app/db.server.ts`)
y sus scripts.

```text
CODE/upango/
├── .specify/  .claude/                      # Spec Kit (ya existen)
├── specs/001-puntos-recogida/               # spec.md (este archivo maestro) y plan.md (puntero)
├── shopify.app.toml                         # app pública de producción (CT-08)
├── shopify.app.dev.toml                     # app de desarrollo (DEC-18)
├── package.json                             # npm workspaces y scripts de la raíz (§21.4)
├── tsconfig.base.json · eslint.config.js · .prettierrc · vitest.workspace.ts
├── Dockerfile · .dockerignore               # imagen del backend (§20.2)
├── .env.example                             # variables del CT-09, sin secretos
├── README.md                                # README generoso (§25)
├── app/                                     # backend React Router (Clean Architecture, §15)
│   ├── domain/                              # PuntoRecogida, Coordenadas, validación, errores de dominio
│   ├── application/
│   │   ├── ports/                           # FuentePuntos, CachePuntos, GatewayPersonalizaciones, …
│   │   └── use-cases/                       # ListarPuntosRecogida, ObtenerEstadoConfiguracion, …
│   ├── infrastructure/
│   │   ├── shopify/                         # adaptadores de la Admin API (*.server.ts)
│   │   ├── sesiones/                        # firestoreSessionStorage.server.ts, fabricaSessionStorage.server.ts
│   │   ├── cache/                           # cachePuntosMemoria.server.ts
│   │   └── observabilidad/                  # registroJson.server.ts, relojSistema.server.ts
│   ├── config/config.server.ts              # validación zod del CT-09
│   ├── composition/contenedor.server.ts     # composition root del backend
│   ├── i18n/es.ts                           # textos de la página de admin
│   ├── shopify.server.ts                    # shopifyApp() con el sessionStorage del contenedor
│   └── routes/                              # controladores delgados (§15.1)
├── packages/
│   ├── contratos/                           # @puntos-recogida/contratos (§11.5)
│   └── selector-carrito/                    # fuente TypeScript del JS del carrito (§17.2)
├── extensions/
│   ├── selector-punto/                      # theme app extension: app embed (§17.1)
│   ├── ocultar-envios/                      # Function TS → wasm (§18)
│   ├── renombrar-recogida/                  # Function TS → wasm (§18)
│   └── punto-pedido/                        # customer account UI extension (§19)
└── deploy/                                  # CLI de despliegue (§20.3)
    ├── deploy.config.json
    └── src/  cli.ts · dominio/ · puertos/ · aplicacion/ · proveedores/{gcp,plantilla}/ · infraestructura/
```

Los tests unitarios viven junto al código (`*.test.ts`); los fixtures de las Functions, en
`extensions/<function>/tests/fixtures/`.

## 15. Backend (diseño)

### 15.1 Rutas (controladores delgados)

| Archivo | Ruta | Autenticación | Responsabilidad |
|---|---|---|---|
| `app/routes/app.tsx` | `/app` (layout) | `authenticate.admin` | Provider de App Bridge y Polaris; navegación |
| `app/routes/app._index.tsx` | `/app` | `authenticate.admin` | `loader` → `ObtenerEstadoConfiguracion`; `action` → `ActivarPersonalizacionesEntrega` (y `CrearPuntosDeEjemplo` si FR-005 está habilitado) |
| `app/routes/auth.$.tsx`, `app/routes/auth.login/*` | `/auth/*` | template | OAuth e inicio de sesión (sin cambios) |
| `app/routes/_index/*` | `/` | ninguna | Página de inicio del template, fuera del admin |
| `app/routes/proxy.puntos.tsx` | `/proxy/puntos` | `authenticate.public.appProxy` | `loader` → `ListarPuntosRecogida` → JSON del CT-03 |
| `app/routes/webhooks.app.uninstalled.tsx` | `/webhooks/app/uninstalled` | `authenticate.webhook` | `ProcesarDesinstalacion` |
| `app/routes/webhooks.app.scopes_update.tsx` | `/webhooks/app/scopes_update` | `authenticate.webhook` | `ActualizarScopesSesion` |
| `app/routes/webhooks.compliance.tsx` | `/webhooks/compliance` | `authenticate.webhook` | `ProcesarSolicitudPrivacidad` según el `topic` |
| `app/routes/healthz.tsx` | `/healthz` | ninguna | 200 con `{"estado": "ok", "version": "<versión>"}` |
| `app/routes/privacidad.tsx` | `/privacidad` | ninguna | Política de privacidad en español (HTML estático) |

Una ruta solo: autentica, obtiene los casos de uso del contenedor (pasándoles el cliente Admin de la
petición cuando hace falta), invoca y traduce el resultado o el error a HTTP. No contiene reglas de negocio.

### 15.2 Casos de uso

**`ListarPuntosRecogida`**. Entrada: tienda y una `FuentePuntos` ligada al cliente Admin de esa tienda.
Salida: `RespuestaPuntosDto`. Depende de `CachePuntos`, `Registro` y `Reloj`.

1. Si hay copia fresca en caché, la devuelve.
2. Si la copia está vencida pero dentro de `PUNTOS_CACHE_STALE_MAX_SEGUNDOS`, la devuelve y lanza un
   refresco en segundo plano (a lo sumo uno por tienda).
3. Si no hay copia, carga. Las peticiones simultáneas de la misma tienda esperan la misma carga
   (*single-flight*).
4. La carga pide `fuente.obtenerTodos()`, construye cada `PuntoRecogida` con la validación del dominio,
   descarta y registra los inválidos (FR-014), advierte de los identificadores duplicados, ordena (FR-015),
   arma el DTO y lo guarda con `generadoEn`.
5. Si la fuente falla y hay una copia dentro del máximo, la devuelve con `stale: true` y registra el error;
   si no la hay, lanza `PuntosNoDisponiblesError` (se traduce a 502).

**`ObtenerEstadoConfiguracion`**. Devuelve `EstadoConfiguracion`:
- `puntos`: total y tipo resuelto del metaobjeto (`app--{id}--punto_recogida`);
- `personalizaciones`: `activa`, `inactiva` o `inexistente` para cada handle;
- `enlaces`: entradas del metaobjeto, editor de temas con el embed, ajustes de envío y ajustes de checkout;
- `tarifa`: el título exacto;
- `semillaHabilitada`.

**`ActivarPersonalizacionesEntrega`**. Para cada handle (`ocultar-envios`, `renombrar-recogida`): si no
existe, la crea activa con `functionHandle` y su título; si está inactiva, la activa; si está activa, no hace
nada. Devuelve `{creadas, activadas, errores}` con los `userErrors`. Es idempotente.

**`ProcesarDesinstalacion`**. Busca las sesiones de la tienda, las borra y vacía su caché.

**`ActualizarScopesSesion`**. Actualiza el scope de la sesión con el del payload (comportamiento del
template).

**`ProcesarSolicitudPrivacidad`**. Según el topic:
- `customers/data_request` y `customers/redact`: registran que la app no guarda datos de compradores;
- `shop/redact`: borra las sesiones y la caché de la tienda.

**`CrearPuntosDeEjemplo`** (solo con FR-005 habilitado). Crea N entradas con handles `ejemplo-0001…`
mediante `metaobjectUpsert`, respetando el throttling. Es idempotente por handle.

### 15.3 Puertos

| Puerto | Métodos | Implementación |
|---|---|---|
| `FuentePuntos` | `obtenerTodos(): Promise<PuntoCrudo[]>` | `FuentePuntosShopify` (por petición, CT-03) |
| `CachePuntos` | `leer(tienda)`, `guardar(tienda, entrada)`, `borrar(tienda)` | `CachePuntosMemoria` (Map con tope LRU de 1.000 tiendas) |
| `GatewayPersonalizaciones` | `listarDeEstaApp()`, `crear(handle, titulo)`, `activar(id)` | `GatewayPersonalizacionesShopify` |
| `ConsultaConfiguracionTienda` | `contarPuntos()` (total y tipo resuelto) | `ConsultaConfiguracionTiendaShopify` |
| `EscritorPuntos` | `upsert(punto)` | `EscritorPuntosShopify` (solo semilla) |
| `Registro` | `debug`, `info`, `warn` y `error` (evento, datos) | `RegistroJson` |
| `Reloj` | `ahora()` | `RelojSistema` |
| `SessionStorage` (interfaz oficial de Shopify) | `storeSession`, `loadSession`, `deleteSession`, `deleteSessions`, `findSessionsByShop` | `FirestoreSessionStorage`, `MemorySessionStorage` |

### 15.4 Adaptadores: detalles que importan

- **`GatewayPersonalizacionesShopify`**:
  - Consulta `deliveryCustomizations(first: 25) { nodes { id title enabled shopifyFunction { handle appKey } } }`
    y filtra las de esta app (`appKey` = `SHOPIFY_API_KEY`) por `handle`.
  - Crea con `deliveryCustomizationCreate(deliveryCustomization: { functionHandle, title, enabled: true })`
    y activa con `deliveryCustomizationUpdate(id: …, deliveryCustomization: { enabled: true })`.
  - Los campos se validan contra el esquema 2026-07 con el validador de GraphQL de Shopify antes de
    implementar.
- **`ConsultaConfiguracionTiendaShopify`**: `metaobjectDefinitionByType(type: "$app:punto_recogida") { type metaobjectsCount }`.
- **`FirestoreSessionStorage`**:
  - Parte de `snippets/firestore-session-storage.server.ts` y le agrega la base y la colección
    configurables (CT-09).
  - Pasa la suite de contract tests compartida con `MemorySessionStorage`; contra el emulador de Firestore
    cuando `FIRESTORE_EMULATOR_HOST` está definida.
  - En Cloud Run se autentica con la cuenta de servicio (ADC), sin claves.
- **`RegistroJson`**: escribe una línea JSON por evento en stdout, con `severity` (DEBUG, INFO, WARNING o
  ERROR), `message`, `evento` y los datos del evento. Nunca escribe tokens, secretos ni datos personales.

### 15.5 Composition root y `shopify.server.ts`

- `app/composition/contenedor.server.ts` lee la configuración validada y crea los singletons
  (`sessionStorage` según `SESSION_STORAGE_DRIVER`, `cachePuntos`, `registro`, `reloj`).
- También expone fábricas por petición: `crearFuentePuntos(admin)`, `crearGateway(admin)`,
  `crearConsulta(admin)`, `crearEscritor(admin)`, y los casos de uso ya cableados.
- `app/shopify.server.ts` configura `shopifyApp` con: `apiKey`, `apiSecretKey`, `apiVersion` 2026-07,
  `scopes`, `appUrl`, `authPathPrefix: "/auth"`, el `sessionStorage` del contenedor,
  `distribution: AppDistribution.AppStore` (app pública) y las *future flags* por defecto del template.
- Nada fuera del contenedor instancia infraestructura (principio I).

### 15.6 Errores

- Errores de dominio tipados: `PuntoInvalidoError` (con motivo), `PuntosNoDisponiblesError` y
  `ConfiguracionInvalidaError`.
- Las rutas los traducen a HTTP según el CT-03.
- Un error inesperado responde 500 y se registra con su stack, sin secretos.
- Si la configuración es inválida, el proceso no arranca.

## 16. Página de admin (diseño)

**Datos**: el `loader` devuelve `EstadoConfiguracion` (§15.2). La `action` recibe `intencion=activar` o
`intencion=sembrar` (solo con FR-005).

**Estructura** (Polaris web components; textos en `app/i18n/es.ts`):

1. `s-page` con el título "Puntos de recogida".
2. **Qué hace esta app**: tres viñetas (el comprador elige el punto en el carrito; en el checkout solo
   aparece la recogida en ese punto; el pedido guarda el punto y el cliente lo ve en su página de pedido).
3. **Configuración**: 5 pasos en el orden recomendado.

   | Paso | Estado mostrado | Acción |
   |---|---|---|
   | 1. Puntos de recogida | "N puntos" (éxito si N > 0; advertencia si N = 0) | "Gestionar puntos" → `shopify:admin/content/metaobjects/entries/{tipoResuelto}` |
   | 2. Tarifa "Recogida en punto de entrega" | "Verificar manualmente" | Explica el nombre exacto, que debe existir en todas las zonas y perfiles y que el precio es libre. Botón "Abrir envíos" → `shopify:admin/settings/shipping` |
   | 3. App embed "Punto de recogida" | "Verificar manualmente" | "Activar en el editor de temas" → `https://{tienda}/admin/themes/current/editor?context=apps&activateAppId={apiKey}/selector-punto` (`target=_top`) |
   | 4. Personalizaciones de entrega | Real: "Activas", "Inactivas" o "Faltan" | "Activar" (FR-057), con un aviso (toast) de App Bridge |
   | 5. Bloque en la página de pedido | "Verificar manualmente" | Pasos: Configuración → Checkout → Personalizar → página de estado del pedido → Agregar bloque "Punto de recogida". Botón "Abrir ajustes de checkout" → `shopify:admin/settings/checkout` |

4. **Cómo funciona**: el recorrido carrito → checkout → pedido → página de pedido, por qué el checkout
   sigue pidiendo una dirección (las tarifas dependen de la zona) y qué pasa si falta el punto.
5. **Modo demo**: cómo activarlo en el editor de temas y el recordatorio de desactivarlo en producción.
6. **Antes de desinstalar** (banner de advertencia, EC-20): desactivar o borrar la tarifa de recogida.
7. **Datos de ejemplo** (solo con FR-005): botón "Crear 600 puntos de ejemplo".

**Comportamiento**: si el `loader` falla, se muestra un banner crítico con "Reintentar"; los errores de la
`action` se muestran en un banner con los `userErrors`. La página cumple WCAG 2.1 AA y no guarda estado
propio: todo el estado sale de Shopify.

## 17. Theme app extension: app embed (diseño)

### 17.1 Archivos de `extensions/selector-punto/`

| Archivo | Contenido | Origen |
|---|---|---|
| `shopify.extension.toml` | Extensión de tipo `theme` llamada `selector-punto` | CLI: `shopify app generate extension --template theme_app_extension --name selector-punto` |
| `blocks/selector-punto.liquid` | Contenedor raíz oculto, `<script type="application/json" id="pr-config">` (CT-06) y `{% schema %}` del embed | A mano |
| `assets/selector-punto.js` | Bundle IIFE minificado | **Generado** por esbuild desde `packages/selector-carrito`. No se edita y está en `.gitignore` |
| `assets/selector-punto.css` | Estilos con prefijo `pr-`, variables CSS que heredan tipografía y colores del tema, foco visible, objetivos táctiles de al menos 44 px y sin reset global | A mano |
| `locales/es.default.json` | Textos para el comprador (claves `selector.*` y `demo.*`) | A mano |
| `locales/es.default.schema.json` | Textos de los ajustes del editor de temas | A mano |

- **Reglas del Liquid**: no contiene lógica de negocio. Solo serializa el estado inicial del carrito (el
  objeto global `cart`), los ajustes y los textos traducidos con `| t`. Todos los valores pasan por el
  filtro `json`.
- **Claves de texto**: `selector.titulo`, `selector.buscar`, `selector.escribe_para_buscar`,
  `selector.resultados`, `selector.sin_resultados`, `selector.cargando`, `selector.error_carga`,
  `selector.reintentar`, `selector.vacio`, `selector.elegido`, `selector.cambiar`, `selector.no_disponible`,
  `selector.motivo_bloqueo`, `selector.enlace_compacto`, `selector.error_guardado`, `selector.guardando`,
  `selector.aviso_direccion`, `demo.interruptor` y `demo.aviso`.

### 17.2 Paquete fuente `packages/selector-carrito/`

| Carpeta o archivo | Responsabilidad |
|---|---|
| `src/dominio/estadoCarrito.ts` | Carrito resolado o normal, con o sin punto, y `EstadoCheckout` (bloqueado con motivo o habilitado) |
| `src/dominio/filtroPuntos.ts` | Índice de búsqueda precalculado (textos normalizados por punto) y `filtrar(indice, consulta, limite = 50)` → `{resultados, total}` con orden estable |
| `src/dominio/revalidacion.ts` | `evaluarSeleccion(seleccion, puntos)` → `vigente`, `desactualizada` (con los atributos nuevos) o `inexistente` |
| `src/aplicacion/puertos.ts` | `ClienteCarrito` (`leer`, `actualizarAtributos`), `ClientePuntos` (`listar`), `VistaSelector` (`mostrar(estado)`), `GuardiaCheckout` (`bloquear(motivo)`, `desbloquear`), `ObservadorCarrito` (`alCambiar`) |
| `src/aplicacion/ControladorSelector.ts` | Máquina de estados del §17.3; solo conoce puertos |
| `src/infraestructura/ClienteCarritoAjax.ts` | `/cart.js` y `/cart/update.js` con `Shopify.routes.root` |
| `src/infraestructura/ClientePuntosProxy.ts` | `GET /apps/puntos-recogida/puntos`, con timeout de 8 s y 1 reintento |
| `src/infraestructura/VistaComboboxDom.ts` | Render del widget y del combobox ARIA (siempre con `textContent`) |
| `src/infraestructura/GuardiaCheckoutDom.ts` | Bloqueo de botones y enlaces, ocultamiento de pagos acelerados |
| `src/infraestructura/ObservadorCarritoDom.ts` | Detección de cambios del carrito (§17.4) |
| `src/infraestructura/InsertadorWidgets.ts` | Localiza los puntos de inserción y reinserta el widget tras un re-render |
| `src/main.ts` | Composition root del navegador: lee `#pr-config`, construye los adaptadores y arranca el controlador. No crea variables globales |
| `build.mjs` | esbuild: `src/main.ts` → `../../extensions/selector-punto/assets/selector-punto.js`, con `bundle`, `minify`, `format: "iife"`, `target: "es2019"` y sin comentarios legales. Falla si el resultado supera 20 KB (NFR-03) |

### 17.3 Máquina de estados del selector

| Estado | Cuándo | Interfaz | Checkout |
|---|---|---|---|
| `inactivo` | Carrito normal | Nada (y borra los `punto_*` si existen, FR-029) | Sin cambios |
| `cargando` | Carrito resolado, pidiendo los puntos | Widget con "Cargando puntos de recogida…" | Bloqueado |
| `error` | Falló la carga | Mensaje y "Reintentar" | Bloqueado |
| `vacio` | 0 puntos | "No hay puntos de recogida disponibles. Contacta con la tienda." | Bloqueado |
| `sin_seleccion` | Puntos listos, sin punto elegido | Combobox y aviso (FR-030) | Bloqueado, con motivo |
| `guardando` | Justo después de elegir | Combobox deshabilitado y "Guardando…" | Bloqueado |
| `con_seleccion` | Punto guardado y vigente | Tarjeta del punto, "Cambiar" y aviso | Habilitado |
| `error_guardado` | Falló `/cart/update.js` | Mensaje y reintento | Bloqueado |

- **Transiciones**: un cambio del carrito provoca una reevaluación. Si se quita `tipo_carrito`, el estado
  pasa a `inactivo` y se hace la limpieza. Elegir lleva a `guardando` y de ahí a `con_seleccion` o a
  `error_guardado`.
- **"Cambiar"**: abre el combobox sin borrar la selección vigente, que sigue valiendo hasta que se elija
  otra.
- **Al cargar con una selección previa**: cuando llegan los puntos se aplica la revalidación del FR-028.
  Si la selección está vigente, pasa a `con_seleccion`. Si está desactualizada, se actualizan los atributos
  y pasa a `con_seleccion`. Si el punto ya no existe, se borra y pasa a `sin_seleccion`, con el mensaje
  "El punto que elegiste ya no está disponible. Elige otro."

### 17.4 Inserción, bloqueo, detección de cambios y compatibilidad

- **Inserción**: busca los botones con `selector_botones_checkout`, los agrupa por su contenedor (el
  formulario del carrito o el drawer) e inserta un widget por grupo visible, antes del contenedor de
  botones o dentro de `selector_insercion` si se configuró. Todas las instancias comparten un único
  controlador.
- **Contextos compactos (EC-24)**: dentro de `selector_contextos_compactos` solo se bloquea y se muestra el
  enlace "Elige tu punto de recogida" → `/cart`.
- **Re-render**: un `MutationObserver` sobre `document.body` (`childList` y `subtree`), con debounce de
  100 ms, reinserta el widget y vuelve a aplicar la guardia.
- **Bloqueo**: `disabled` y `aria-disabled="true"`, más listeners de `click` y `submit` en fase de captura
  que cancelan la navegación a `/checkout` (enlaces `a[href$="/checkout"]` y formularios que envían
  `checkout`). El motivo queda asociado con `aria-describedby`.
- **Pagos acelerados**: los contenedores de `selector_pagos_acelerados` se ocultan (`hidden`) mientras no
  haya punto.
- **Cambios del carrito**:
  - una envoltura transparente de `fetch` y de `XMLHttpRequest` detecta las respuestas exitosas a
    `/cart/add`, `/cart/change`, `/cart/update` y `/cart/clear` (con o sin `.js`) y relee `/cart.js` con
    un debounce de 250 ms;
  - también escucha los eventos de carrito de los temas de referencia (el pub/sub `cart-update` de Dawn y
    los eventos de carrito de Horizon) y `visibilitychange`;
  - las escrituras del propio embed llevan una marca interna para no provocar bucles.
- **Temas de referencia**: Dawn y Horizon (última versión), en `/cart` y en el drawer. Ambos usan
  `button[name="checkout"]`. El checklist E2E (Anexo B) verifica cada combinación.

### 17.5 Accesibilidad del combobox (ARIA 1.2)

- El input tiene `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` y
  `aria-activedescendant`.
- La lista es un `role="listbox"` con opciones `role="option"` y `aria-selected`.
- Teclado: ↓ y ↑ mueven, Enter elige, Esc cierra, Inicio y Fin van a los extremos.
- Una región `aria-live="polite"` anuncia "N resultados", los errores y la confirmación de guardado.
- La etiqueta es visible y está asociada; el foco es visible y el contraste se verifica en AA sobre los
  temas de referencia.

### 17.6 Modo demo

Con `modo_demo` activo, en la página `/cart` y en el drawer se muestra un interruptor (`role="switch"`),
aunque el carrito no sea resolado. Su etiqueta es "Simular carrito resolado (modo demo)".

- **Al activarlo**: `cart/update.js` con `{"tipo_carrito": "resolado"}`.
- **Al desactivarlo**: `{"tipo_carrito": ""}` más los 7 `punto_*` vacíos.

Lo ven todos los visitantes mientras esté habilitado. Por eso la etiqueta del ajuste dice "Solo para
pruebas: desactívalo en producción".

## 18. Functions: de TypeScript a WebAssembly (diseño e instrucciones)

### 18.1 Generación y archivos (por cada Function)

Se generan con Shopify CLI y **no se renombran** los archivos que genera:

```text
shopify app generate extension --template delivery_customization --flavor typescript --name ocultar-envios
shopify app generate extension --template delivery_customization --flavor typescript --name renombrar-recogida
```

| Archivo | Contenido |
|---|---|
| `shopify.extension.toml` | Valores clave del CT-04 y del CT-05 (`api_version`, `handle`, `target`; `input_query` y `export` según los genera la CLI) |
| `src/<target>.graphql` | Input query del CT-04 o del CT-05 |
| `src/<target>.ts` | Adaptador: traduce el input generado al formato del núcleo y el resultado del núcleo a `operations` |
| `src/index.ts` | Exports que genera la CLI |
| `src/dominio/decidirOcultamiento.ts` o `src/dominio/decidirRenombre.ts` | Núcleo puro (§18.2) |
| `generated/api.ts` | Tipos generados por `shopify app function typegen` (no se editan) |
| `schema.graphql` | Esquema de la API de la Function que descarga la CLI |
| `tests/fixtures/*.json` | Casos con `export`, `target`, `input` y `output` (§18.4) |
| `src/**/*.test.ts` | Tests unitarios del núcleo |
| `package.json` | Incluye `@puntos-recogida/contratos` como dependencia del workspace |

### 18.2 Núcleo puro

- `decidirOcultamiento({ tipoCarrito, puntoId, grupos: [{ opciones: [{ handle, titulo }] }] })` devuelve
  los handles que hay que ocultar, según la tabla del CT-04.
- `decidirRenombre({ tipoCarrito, puntoId, direccionCorta, grupos })` devuelve `[{ handle, titulo }]`
  según el CT-05.
- Ambos usan solo `@puntos-recogida/contratos` (`esCarritoResolado`, `tieneValor`, `esTarifaRecogida` y
  `formatearTituloRecogida`). No conocen los tipos generados de Shopify.
- El adaptador convierte los handles en `deliveryOptionHide` y los pares en `deliveryOptionRename`.

### 18.3 Compilación a WebAssembly: instrucciones que el README DEBE reproducir

1. **Instalar**: `npm install` en la raíz. Instala los workspaces, incluido `@puntos-recogida/contratos`.
2. **Regenerar los tipos** tras cambiar una input query: `shopify app function typegen`, dentro de la
   carpeta de la Function. Actualiza `generated/api.ts`.
3. **Compilar**: `shopify app function build` dentro de la carpeta (o `shopify app build` en la raíz, para
   todas las extensiones). La CLI empaqueta el TypeScript con esbuild, lo que incluye el paquete de
   contratos, y lo compila con **Javy** a un módulo WebAssembly en `dist/function.wasm`. Javy incrusta el
   motor JavaScript QuickJS; el runtime lo aporta Shopify, por eso el binario queda pequeño.
4. **Ejecutar en local**:
   `shopify app function run --input tests/fixtures/<caso>.json --export <export>`. El `export` está en
   `shopify.extension.toml`. El comando imprime la salida y las instrucciones consumidas.
5. **Probar**: `npm test`, que ejecuta los tests unitarios del núcleo y los fixtures sobre el wasm.
6. **Desarrollar contra la tienda**: con `shopify app dev`, la CLI recompila al guardar. Las ejecuciones
   reales en la development store quedan en `.shopify/logs/` y se ven con `shopify app logs`; se pueden
   copiar a `tests/fixtures/` como casos nuevos.
7. **Desplegar**: `shopify app deploy` sube el wasm dentro de la versión de la app; no hay un despliegue
   aparte.
8. **Respetar los límites** de la documentación vigente: tamaño del binario, tamaño del input,
   instrucciones (NFR-06) y tamaño del output.
9. **Plan B (DEC-07)**: si el peor caso supera el 50 % del límite de instrucciones, se genera la misma
   Function con `--flavor rust` y se porta el núcleo (compilación con
   `cargo build --target=wasm32-unknown-unknown --release`). Los contratos y los fixtures se conservan.

### 18.4 Pruebas de las Functions

- **Unitarias (Vitest) del núcleo**: cada fila de las tablas del CT-04 y del CT-05, y además: `title` nulo;
  `tipo_carrito` con mayúsculas o espacios; punto vacío o con solo espacios; varios grupos de entrega;
  título de tarifa con otras tildes o mayúsculas; dirección corta de más de 60 caracteres; caracteres de
  control.
- **Fixtures sobre el wasm**: cada `tests/fixtures/*.json` (con `export`, `target`, `input` y `output`) se
  ejecuta sobre el wasm compilado con el harness que genera la CLI. Hay al menos un fixture por fila de cada
  tabla y uno de **peor caso** (10 grupos × 20 opciones).
- **Presupuesto**: el test de peor caso registra las instrucciones medidas y falla si superan el 50 % del
  límite. El valor medido se anota en el README.

### 18.5 Activación

Una Function desplegada no hace nada hasta que existe su delivery customization (FR-057). Los títulos son
"Puntos de recogida · ocultar envíos" y "Puntos de recogida · renombrar recogida", y ambas aparecen en
Configuración → Envío y entrega → Personalizaciones de entrega.

## 19. Extensión de la página de pedido (diseño)

- **Generación**: con la plantilla de customer account UI extension de Shopify CLI, variante Preact y
  TypeScript, y el nombre `punto-pedido`. Configuración según el CT-07.
- **Archivos**: `shopify.extension.toml`, `src/PuntoPedido.tsx` (presentador), `locales/es.default.json` y
  sus tests.
- **Comportamiento**: lee `shopify.attributes.value`, que es reactivo, y lo pasa por
  `leerSeleccionDeAtributos`. Si devuelve `null`, no renderiza nada; si hay selección, renderiza la sección
  del CT-07 con componentes `s-*`. No hace peticiones de red y valida las coordenadas antes de armar el
  enlace al mapa.
- **Colocación**: es un *block target*, así que el comerciante elige dónde va: Configuración → Checkout →
  Personalizar → página de estado del pedido → Agregar bloque de app → "Punto de recogida".
- **Build**: la CLI empaqueta la extensión en `shopify app deploy`; `shopify app dev` ofrece la vista previa.

## 20. Despliegue abstraído y Google Cloud

### 20.1 Portabilidad del runtime

| Capacidad | Puerto | Referencia (GCP) | Otros proveedores (con un adaptador) |
|---|---|---|---|
| Cómputo | Contenedor OCI (`PORT`, `/healthz`) | Cloud Run | Azure Container Apps, AWS App Runner, Fly.io, Kubernetes |
| Sesiones | `SessionStorage` | `FirestoreSessionStorage` (propio) | Azure Cosmos DB con API de MongoDB (adaptador oficial de MongoDB), AWS DynamoDB (adaptador oficial), PostgreSQL, MySQL o Redis (adaptadores oficiales) |
| Caché de puntos | `CachePuntos` | Memoria de la instancia | Redis (Memorystore, Azure Cache) |
| Logs | `Registro` | JSON a stdout, que Cloud Logging interpreta | Igual: Azure Monitor y CloudWatch leen stdout |
| Secretos | Variables de entorno | Secret Manager inyectado como variable | Key Vault o Secrets Manager inyectados como variable |
| Imagen | Dockerfile estándar | Cloud Build + Artifact Registry | ACR con `az acr build`, ECR, o cualquier registro OCI |

### 20.2 Imagen de contenedor (requisitos del Dockerfile)

- Multietapa. La etapa de build usa `node:24-alpine`, instala solo los workspaces necesarios (`app` y
  `packages/contratos`) y ejecuta el build de React Router. La etapa final usa `node:24-alpine` con
  `NODE_ENV=production`, solo dependencias de producción y el directorio `build/`.
- Corre como el usuario `node` (sin root), hace `EXPOSE 8080` y arranca con `npm run start`, que escucha en
  `PORT`. No incluye Prisma ni migraciones.
- El `.dockerignore` excluye `extensions/`, `deploy/`, `specs/`, `.specify/`, `.claude/`, `node_modules/`,
  los tests y los archivos `.env*`.
- Objetivo de tamaño: 250 MB o menos. Termina ordenadamente al recibir `SIGTERM`.

### 20.3 CLI de despliegue (`deploy/`)

| Carpeta | Contenido |
|---|---|
| `src/dominio/` | `ConfigDespliegue` (esquema zod de `deploy.config.json`), el plan de pasos y los errores (`ConfiguracionInvalidaError`, `PrerrequisitoError`, `ComandoFallidoError`, `ProveedorNoImplementadoError`) |
| `src/puertos/` | `ProveedorDespliegue`, `EjecutorComandos` y `Consola` (CT-10) |
| `src/aplicacion/OrquestadorDespliegue.ts` | Ejecuta los pasos en orden, sin saber de ningún proveedor (§20.4) |
| `src/proveedores/registro.ts` | Mapa nombre → fábrica del proveedor (OCP). En v1 solo registra `gcp` |
| `src/proveedores/gcp/` | `ProveedorGcp`: usa solo `EjecutorComandos` para llamar a `gcloud` |
| `src/proveedores/plantilla/` | Esqueleto documentado que lanza `ProveedorNoImplementadoError`. Es el punto de partida para un proveedor nuevo y no está registrado |
| `src/infraestructura/EjecutorComandosNode.ts` | `child_process.spawn` **sin shell**, con stdin para los secretos; en `--dry-run` solo imprime (enmascarando los secretos) |
| `src/cli.ts` | Composition root: lee las opciones, carga la configuración y `.env.deploy`, elige el proveedor e invoca el orquestador |

**Pasos del orquestador**:
1. Valida la configuración.
2. `verificarPrerrequisitos`.
3. `prepararInfraestructura`.
4. `publicarSecretos`.
5. `construirImagen`.
6. `desplegarServicio`.
7. Si la URL real difiere de `SHOPIFY_APP_URL`, `actualizarVariables`.
8. Imprime un resumen con la URL, la revisión y los pasos siguientes (FR-081).

Con `--paso` se ejecuta solo ese paso, después de validar la configuración.

### 20.4 Adaptador de Google Cloud (`ProveedorGcp`)

| Paso | Comandos `gcloud` | Idempotencia |
|---|---|---|
| Verificar | `gcloud --version`; `gcloud auth list --filter=status:ACTIVE --format="value(account)"`; `gcloud projects describe <proyecto> --format="value(projectNumber)"` | Solo lectura |
| Infraestructura | `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com secretmanager.googleapis.com` | Habilitar un servicio ya habilitado no falla |
| | `gcloud artifacts repositories create <repo> --repository-format=docker --location=<region>` | Solo si `describe` no lo encuentra |
| | `gcloud firestore databases create --database="(default)" --location=<region> --type=firestore-native` | Solo si `describe` no la encuentra |
| | `gcloud iam service-accounts create <cuenta> --display-name="Puntos de Recogida (Cloud Run)"` | Solo si no existe |
| | `gcloud projects add-iam-policy-binding <proyecto> --member=serviceAccount:<email> --role=roles/datastore.user` | Agregar un binding existente no duplica |
| Secretos | `gcloud secrets create <secreto> --replication-policy=automatic` | Solo si no existe |
| | `gcloud secrets versions add <secreto> --data-file=-` (el valor por stdin) | Solo si el valor cambió respecto de la última versión (se compara sin imprimirlo) |
| | `gcloud secrets add-iam-policy-binding <secreto> --member=serviceAccount:<email> --role=roles/secretmanager.secretAccessor` | Igual que los bindings |
| Imagen | `gcloud builds submit --tag <region>-docker.pkg.dev/<proyecto>/<repo>/<servicio>:<etiqueta> .` (usa el Dockerfile; no necesita Docker local) | Cada etiqueta es nueva |
| Servicio | `gcloud run deploy <servicio> --image <imagen> --region <region> --service-account <email> --allow-unauthenticated --port 8080 --cpu 1 --memory 512Mi --min-instances 0 --max-instances 3 --concurrency 80 --env-vars-file <yaml-temporal> --set-secrets SHOPIFY_API_SECRET=shopify-api-secret:latest --format=json` | Crea una revisión nueva |
| Variables | `gcloud run services update <servicio> --region <region> --update-env-vars SHOPIFY_APP_URL=<url>` | Solo si difiere |

Detalles obligatorios:

- Las variables se pasan con `--env-vars-file` (un YAML temporal que se borra al terminar) porque algunos
  valores, como `SCOPES`, contienen comas.
- `--allow-unauthenticated` es necesario porque Shopify (proxy, webhooks, OAuth) y el iframe del admin
  llaman sin credenciales de Google. La autenticación la hace la app (HMAC y session tokens).
- **Primer despliegue**: el backend necesita `SHOPIFY_APP_URL` para arrancar. La CLI la calcula antes de
  desplegar con el formato determinista de Cloud Run, `https://<servicio>-<numero-de-proyecto>.<region>.run.app`,
  y después la compara con `status.url` (paso 7).

### 20.5 Primer despliegue completo (resumen del procedimiento del README)

1. `gcloud auth login`, `gcloud config set project <id>` y facturación habilitada en el proyecto.
2. Completar `deploy/deploy.config.json` (proyecto y región).
3. Crear `.env.deploy` con `SHOPIFY_API_KEY` y `SHOPIFY_API_SECRET` de la app de producción.
4. `npm run deploy -- --proveedor gcp --dry-run` y revisar los comandos.
5. `npm run deploy -- --proveedor gcp`, que devuelve la URL del servicio.
6. Poner esa URL en `application_url` y `redirect_urls` de `shopify.app.toml`. El proxy y los webhooks son
   rutas relativas y no cambian.
7. `npm run deploy:shopify`: build del embed y `shopify app deploy --config shopify.app.toml`. Crea la
   versión con extensiones, Functions, metaobjeto, proxy y webhooks.
8. Instalar la app en la development store y configurarla (§16).

### 20.6 Actualizaciones y reversión

- **Backend**: se repite `npm run deploy -- --proveedor gcp`; la revisión nueva recibe el 100 % del tráfico.
- **Reversión del backend**:
  `gcloud run services update-traffic <servicio> --region <region> --to-revisions <revision-anterior>=100`.
  Está documentada en el README; en v1 queda fuera de la CLI.
- **Extensiones y configuración**: `npm run deploy:shopify` crea una versión nueva de la app. Para volver a
  una anterior se usa el Dev Dashboard.

### 20.7 Agregar un proveedor (resumen de la guía del README)

1. Crear `deploy/src/proveedores/<nombre>/` a partir de `plantilla/` e implementar `ProveedorDespliegue`
   usando solo `EjecutorComandos`.
2. Registrarlo en `deploy/src/proveedores/registro.ts` y agregar su bloque en `deploy.config.json`.
3. Elegir el almacenamiento de sesiones: un adaptador oficial de Shopify (por ejemplo, el de MongoDB para
   Azure Cosmos DB con API de MongoDB) o uno propio que pase los contract tests. Registrar su valor de
   `SESSION_STORAGE_DRIVER` en el composition root del backend.
4. Escribir los tests del proveedor con un `EjecutorComandos` falso, verificando comandos, idempotencia y
   que los secretos van por stdin.
5. Documentarlo en el README. Mapeo orientativo para Azure: Container Apps (cómputo), `az acr build` sobre
   Azure Container Registry (imagen), Key Vault (secretos) y Cosmos DB con API de MongoDB (sesiones).

Nada de esto toca `app/domain` ni `app/application` (SC-010).

### 20.8 Costos de la referencia

Con 0 instancias mínimas, Cloud Run se paga solo por uso. Firestore guarda unos pocos documentos de
sesión, Secret Manager un secreto, Artifact Registry las imágenes (conviene una política de limpieza) y
Cloud Build consume minutos de build. El README enlaza a las páginas oficiales de precios y no inventa
cifras.

## 21. Entornos, configuración de Shopify y scripts

### 21.1 Entornos

| Entorno | App en el Dev Dashboard | Archivo de configuración | Tienda | Sesiones |
|---|---|---|---|---|
| Desarrollo | "Puntos de Recogida (dev)" | `shopify.app.dev.toml` | Development store propia | `memoria` (o Firestore con emulador) |
| Producción | "Puntos de Recogida", pública con visibilidad limitada | `shopify.app.toml` | Tiendas que la instalan | `firestore` |

La configuración se elige con `shopify app config use <nombre>` o con `--config`. `shopify app dev` se
ejecuta **siempre** con la configuración de desarrollo (DEC-18).

### 21.2 Flujo de desarrollo local

1. `npm install` en la raíz.
2. `shopify app config link`: crear o enlazar la app de desarrollo, lo que genera `shopify.app.dev.toml`.
3. Copiar `.env.example` a `.env` (en desarrollo, `SESSION_STORAGE_DRIVER=memoria`).
4. `npm run dev`: esbuild en modo watch para el embed y `shopify app dev --config dev` (túnel, instalación
   en la development store, vista previa de las extensiones y recompilación de las Functions).
5. Configurar la tienda (§21.3) y probar con el modo demo.

### 21.3 Tienda de prueba

- Development store con Dawn y Horizon instalados; se publica uno y se prueba el otro con la vista previa.
- Cuentas de cliente nuevas activadas.
- Una tarifa "Recogida en punto de entrega" en todas las zonas del perfil general, más las tarifas
  habituales (por ejemplo, Estándar y Exprés) para comprobar que se ocultan.
- Puntos: al menos 3 reales y 600 de ejemplo (FR-005) para la prueba de escala.
- App embed activo con el modo demo, personalizaciones activas y bloque de pedido colocado.
- Pasarela de pago de prueba (Bogus Gateway) para completar pedidos.

### 21.4 Scripts de la raíz (`package.json`)

| Script | Qué hace |
|---|---|
| `dev` | Watch del embed y `shopify app dev --config dev` |
| `build` | Build del backend y bundle del embed |
| `build:embed` | esbuild del selector, con el control de peso del NFR-03 |
| `test` | Todas las suites automatizadas (workspace de Vitest y fixtures de las Functions) |
| `test:coverage` | Cobertura, con un umbral del 90 % en dominio y aplicación |
| `lint` / `format` / `typecheck` | ESLint (incluida la regla de imports del FR-083), Prettier y `tsc --noEmit` en todos los workspaces |
| `deploy` | CLI de despliegue (`tsx deploy/src/cli.ts`) |
| `deploy:shopify` | `build:embed` seguido de `shopify app deploy --config shopify.app.toml` |
| `start` | Sirve el build de React Router (lo usa el contenedor) |

### 21.5 Dos despliegues independientes

| Despliegue | Qué publica | Comando | Dónde |
|---|---|---|---|
| Backend | Contenedor con la página de admin, el proxy y los webhooks | `npm run deploy -- --proveedor gcp` | Proveedor de nube |
| Shopify | Configuración de la app (scopes, proxy, webhooks, metaobjeto), theme app extension, Functions y extensión de pedido | `npm run deploy:shopify` | Shopify (versión de la app) |

Se despliega primero el backend (para conocer su URL) y después Shopify. Un cambio que solo toca
extensiones no requiere desplegar el backend, y al revés.

## 22. Observabilidad y operación

| Evento (`evento`) | Nivel (`severity`) | Datos |
|---|---|---|
| `proxy.puntos.respuesta` | INFO | tienda, estado de la caché (fresca, vencida, cargada o stale), total, duracionMs |
| `puntos.carga` | INFO | tienda, páginas, total, inválidos, duplicados, costo de la consulta, duracionMs |
| `puntos.invalido` | WARNING | tienda, gid, motivo |
| `puntos.duplicado` | WARNING | tienda, identificador, gids |
| `puntos.carga.error` | ERROR | tienda, error, reintentos |
| `personalizaciones.activacion` | INFO | tienda, creadas, activadas, errores |
| `webhook.recibido` | INFO | topic, tienda |
| `sesiones.borradas` | INFO | tienda, cantidad |
| `config.invalida` | ERROR | Nombres de las variables faltantes (nunca sus valores) |

- Correlación: se incluye `requestId` a partir de `traceparent` o `x-cloud-trace-context`, si vienen.
- Alertas sugeridas (README): tasa de respuestas 5xx en `/proxy/puntos`, `puntos.carga.error` repetido y
  reinicios del contenedor.
- En Cloud Run los logs se consultan en el Logs Explorer o con `gcloud run services logs read <servicio>`.

## 23. Seguridad y privacidad

- **Qué guarda la app**: solo las sesiones (el token offline de cada tienda), hasta `app/uninstalled` o
  `shop/redact`.
- **Qué no guarda**: datos de compradores, pedidos o direcciones. Los atributos del pedido viven en
  Shopify.
- **Autenticación de entradas**: firma HMAC del App Proxy, session tokens del admin embebido y HMAC de los
  webhooks, siempre mediante los paquetes oficiales de Shopify.
- **Mínimo privilegio**: solo los scopes `write_delivery_customizations` y `write_app_proxy` (FR-069).
- **Secretos**: Secret Manager inyectado como variable de entorno. `.env*` está en `.gitignore`, la CLI
  pasa los secretos por stdin y los logs nunca los incluyen.
- **XSS**: `textContent` en el embed, componentes de Shopify en la extensión de pedido y filtro `json` en
  Liquid.
- **Cabeceras**: las del template (CSP con `frame-ancestors` para el admin embebido).
- **Dependencias**: `npm audit` sin vulnerabilidades altas ni críticas antes de cada entrega.
- **Manipulación de atributos**: límite aceptado (EC-12), con mitigación prevista en v2.
- **Política de privacidad** (`/privacidad`): qué datos se tratan y para qué, retención, cómo se atienden
  los webhooks de privacidad y un contacto.

## 24. Estrategia de pruebas y validación

### 24.1 Suites automatizadas (FR-090 a FR-092)

| Suite | Qué cubre | Herramienta | Ubicación |
|---|---|---|---|
| Contratos | Normalización, `esCarritoResolado`, `esTarifaRecogida`, `formatearTituloRecogida`, mapeos de atributos y **test de coherencia** con las `.graphql` | Vitest | `packages/contratos` |
| Functions: núcleo | Todas las filas del CT-04 y del CT-05, más los bordes del §18.4 | Vitest | `extensions/*/src/dominio` |
| Functions: wasm | Fixtures por fila, peor caso y presupuesto de instrucciones | Harness de la CLI | `extensions/*/tests` |
| Backend: dominio | Construcción y validación de `PuntoRecogida`, orden, duplicados | Vitest | `app/domain` |
| Backend: casos de uso | `ListarPuntosRecogida` (caché fresca, vencida con refresco, *single-flight*, *stale-if-error*, error sin copia, inválidos, orden), `ObtenerEstadoConfiguracion`, `ActivarPersonalizacionesEntrega` (crear, activar, idempotencia, `userErrors`), desinstalación y privacidad | Vitest con dobles de los puertos | `app/application` |
| Backend: adaptadores | `FuentePuntosShopify` (varias páginas, throttling y reintentos, reducción de página) con un cliente GraphQL falso; `GatewayPersonalizacionesShopify` (filtro por `appKey` y `handle`); `CachePuntosMemoria` (TTL y LRU) | Vitest | `app/infrastructure` |
| Backend: contract tests | Suite compartida de `SessionStorage` sobre memoria y Firestore (emulador, si está disponible) | Vitest | `app/infrastructure/sesiones` |
| Backend: rutas | Proxy: firma inválida → rechazo; sin sesión → 404; correcto → JSON del CT-03; error → 502. `/healthz` | Vitest (loaders con `authenticate` simulado) | `app/routes` |
| Carrito: dominio y aplicación | Filtro (tildes, mayúsculas, límite, orden), revalidación, estados y transiciones, limpieza en carritos normales, modo demo | Vitest con dobles | `packages/selector-carrito` |
| Carrito: DOM | Inserción, bloqueo (`disabled`, captura de clic y submit), pagos acelerados ocultos, ARIA básico, reinserción tras un re-render | Vitest + jsdom | `packages/selector-carrito` |
| CLI de despliegue | Orquestador (orden, `--paso`, `--dry-run`, errores y códigos de salida) con un proveedor falso; `ProveedorGcp` con un `EjecutorComandos` falso (comandos exactos, idempotencia, secretos por stdin, `--env-vars-file`) | Vitest | `deploy/` |

Cobertura mínima del 90 % de líneas en `app/domain`, `app/application`, `packages/contratos`,
`packages/selector-carrito/src/{dominio,aplicacion}`, `extensions/*/src/dominio` y
`deploy/src/{dominio,aplicacion}`.

### 24.2 Validación rápida (quickstart)

Prerrequisitos: la tienda de prueba del §21.3 y la app de desarrollo instalada.

1. `npm test` y `npm run test:coverage` pasan, con cobertura ≥ 90 %.
2. `shopify app function run` sobre el fixture de peor caso: instrucciones ≤ 50 % del límite.
3. `npm run build:embed`: bundle ≤ 20 KB.
4. Carrito normal: no hay widget y la pestaña Red no muestra llamadas a `/apps/puntos-recogida`.
5. Modo demo activado: aparece el selector y el checkout queda bloqueado. Se busca "sol", se elige un
   punto, `/cart.js` muestra los `punto_*` y el checkout se habilita.
6. En el checkout hay 1 opción renombrada; se paga con la pasarela de prueba y se crea el pedido.
7. El pedido muestra los atributos en "Detalles adicionales" y el bloque en la página de estado del pedido.
8. Se edita y se borra el punto: el pedido no cambia.
9. Carrito resolado sin punto, entrando directo por `/checkout`: no hay opciones.
10. Backend desplegado en Google Cloud (US-6): `/healthz` responde 200 y el proxy funciona contra Cloud Run.

El recorrido completo está en el Anexo B.

## 25. Requisitos del README generoso (FR-085 a FR-088)

El `README.md` se escribe en español, con los comandos listos para copiar (PowerShell y bash cuando
difieren), y DEBE tener al menos estas secciones:

| # | Sección | Contenido mínimo obligatorio |
|---|---|---|
| 1 | Qué es y qué problema resuelve | El problema sin Plus, qué hace la app y capturas del flujo |
| 2 | Cómo funciona todo | Diagrama [T]/[S]/[D] (§11.1), recorrido de punta a punta (§11.2) y por qué existe cada pieza |
| 3 | Conceptos de Shopify necesarios | App pública frente a custom, metaobjetos app-owned, App Proxy y firma HMAC, theme app extensions y app embeds, Functions y WebAssembly, delivery customizations, customer account UI extensions, atributos del carrito y su copia al pedido |
| 4 | Arquitectura del código | Estructura del repositorio (§14), capas por pieza (§11.3), SOLID (§11.4), paquete de contratos y qué tocar para cada tipo de cambio |
| 5 | Requisitos previos | Cuentas y herramientas, con versiones |
| 6 | Puesta en marcha local | §21.2 paso a paso, `.env`, modo demo y datos de ejemplo |
| 7 | Configuración de la tienda | Tarifa en todas las zonas y perfiles (con capturas), puntos, embed, personalizaciones, bloque de pedido y cuentas nuevas |
| 8 | Functions: de TypeScript a WebAssembly | §18.3 completo, límites vigentes, cómo leer el conteo de instrucciones y el valor medido, cómo sumar fixtures desde los logs y el plan B con Rust |
| 9 | El app embed | Build con esbuild, ajustes, compatibilidad con temas, cómo adaptar los selectores y cómo depurar en el navegador |
| 10 | La extensión de pedido | Qué muestra y cómo colocarla |
| 11 | La página de admin | Qué hace cada paso |
| 12 | Pruebas | Cómo correr cada suite, qué cubre, la cobertura y el checklist E2E |
| 13 | Despliegue del backend: arquitectura abstraída | Interfaz `ProveedorDespliegue`, orquestador, configuración neutral, variables y secretos |
| 14 | Despliegue en Google Cloud paso a paso | §20.5 completo con los comandos, qué recursos crea, cómo ver los logs, costos (§20.8) y reversión (§20.6) |
| 15 | Despliegue de extensiones y configuración de Shopify | `shopify app deploy`, versiones de la app y su relación con el backend (§21.5) |
| 16 | Agregar otro proveedor | §20.7 con el ejemplo de Azure |
| 17 | Distribución en el App Store | Pública con visibilidad limitada, distribución irreversible, paquete para la revisión (FASE-10) e instalación desde la URL del listing |
| 18 | Operación y observabilidad | Eventos de log (§22), alertas sugeridas y comportamiento de la caché (TTL; para ver un cambio al instante, esperar el TTL o redesplegar) |
| 19 | Seguridad y privacidad | §23 |
| 20 | Solución de problemas | Tabla síntoma → causa → solución. Como mínimo: no hay opciones de entrega en el checkout; el selector no aparece; la tarifa aparece en carritos normales; el proxy responde 404 o 401; las Functions no corren; el bloque de pedido no aparece; error al activar (25 personalizaciones); fallos en cada paso del despliegue |
| 21 | Límites conocidos y decisiones | §26 y referencia a las DEC de este archivo |
| 22 | Hoja de ruta v2+ | §27.2 |
| 23 | Glosario y referencias | Glosario (§3.3) y enlaces a shopify.dev (Anexo A) |

## 26. Riesgos y límites conocidos

| Riesgo o límite | Impacto | Mitigación |
|---|---|---|
| Los atributos del carrito se pueden manipular desde el navegador | Un comprador podría inventar un punto o una dirección | La Function no puede verificarlo (no tiene red). v2: webhook `orders/create` que valide `punto_gid` y marque el pedido |
| La tarifa se reconoce por su título | Si el comerciante la renombra, los carritos resolado se quedan sin opciones | Normalización tolerante; avisos en la página de admin y en el README. v2: título configurable |
| Falta la tarifa en alguna zona o perfil | El checkout resolado se queda sin opciones | Paso 2 de la página de admin y tabla de solución de problemas |
| Functions en TypeScript y no en Rust | Consumen más instrucciones | Presupuesto del NFR-06 medido en los tests; plan B (§18.3) |
| El app embed no se activa solo | La app no hace nada en la tienda hasta que el comerciante lo activa | Deep link y paso 3 de la página de admin |
| Variedad de temas | Botones y drawers distintos | Selectores configurables; la Function sigue siendo la garantía |
| Revisión del App Store | Plazos externos; hasta la aprobación solo se instala en development stores propias | Paquete de revisión completo (FASE-10): video, guion con modo demo y tienda con acceso de staff |
| Caché por instancia y arranques en frío | Primera carga lenta; los cambios se ven al vencer el TTL | *Stale-while-revalidate* y *stale-if-error*. v2: snapshot compartido |
| Plan Shopify Starter | No hay Functions | Requisito de plan documentado |
| Desinstalación | La tarifa de recogida queda visible para todos | Aviso en la página de admin y en el README |
| Punto borrado y comprador que entra directo al checkout | El pedido se hace con un punto que ya no existe | Revalidación en el carrito y copia inmutable. v2: validación posterior a la compra |
| Evolución de las APIs de Shopify | Deprecaciones | API fechada 2026-07; revisión trimestral de versiones |

## 27. Hoja de ruta

### 27.1 Construcción por fases (sin tareas; las genera `/speckit-tasks`)

| Fase | Objetivo | Entregables | Criterio de salida | Depende de |
|---|---|---|---|---|
| FASE-0 Preparación | Cuentas y herramientas listas | Cuenta de Partners con Dev Dashboard, app de desarrollo, development store con Dawn y Horizon, proyecto de Google Cloud con facturación, Node 24, Shopify CLI y `gcloud` | `node -v`, `shopify version` y `gcloud --version` responden; hay acceso a la tienda | — |
| FASE-1 Fundaciones | Base común de todas las historias | Template React Router en `CODE/upango/` sin Prisma; workspaces; TS strict, ESLint (con el FR-083), Prettier y Vitest; `@puntos-recogida/contratos`; configuración (CT-09); composition root; `SessionStorage` Firestore y memoria con contract tests; `RegistroJson`; TOML de dev y prod (CT-08); `/healthz`, `/privacidad` y webhooks | `npm test`, `typecheck` y `lint` en verde; `shopify app dev` instala la app | FASE-0 |
| FASE-2 (US-1) | Metaobjeto utilizable | Definición del CT-01 desplegada, validaciones verificadas y semilla del FR-005 | Escenarios de US-1 | FASE-1 |
| FASE-3 (US-2) | Elegir el punto en el carrito | `ListarPuntosRecogida` con sus puertos y adaptadores, ruta del proxy, `packages/selector-carrito` y extensión `selector-punto` | Escenarios de US-2 en Dawn y Horizon; NFR-01 a NFR-04 medidos | FASE-2 |
| FASE-4 (US-3) | Garantía en el checkout | Functions `ocultar-envios` y `renombrar-recogida` con núcleo, fixtures y presupuesto | Escenarios de US-3; NFR-06 | FASE-1 (se prueba escribiendo atributos con `/cart/update.js`, sin depender del carrito) |
| FASE-5 (US-4) | Copia inmutable visible | Extensión `punto-pedido` | Escenarios de US-4 | FASE-4 (para generar pedidos reales) |
| FASE-6 (US-5) | Configuración guiada | Casos de uso de estado y activación, sus adaptadores y la página de admin | Escenarios de US-5 | FASE-1 |
| FASE-7 (US-6) | Backend desplegado y portable | Dockerfile, CLI `deploy/`, `ProveedorGcp` y esqueleto `plantilla/` | Escenarios de US-6; SC-009 | FASE-1 |
| FASE-8 (US-7) | Poder evaluar la app | Modo demo del embed y guion de prueba para el revisor | Escenarios de US-7 | FASE-3 |
| FASE-9 Documentación y pulido | Entregable completo | README (§25), checklist E2E completo, accesibilidad, Lighthouse y `npm audit` | Anexo B completo; SC-001 a SC-011 | FASE-2 a FASE-8 |
| FASE-10 Distribución | Instalable en la tienda del evaluador | App de producción con distribución pública; listing en inglés con traducción al español; visibilidad limitada; política de privacidad; capturas; video del flujo completo; instrucciones de prueba con modo demo; development store con acceso de staff; envío a revisión | App aprobada e instalada desde la URL del listing (SC-012) | FASE-9 |

### 27.2 Hoja de ruta v2+

1. Cart and Checkout Validation Function: un mensaje claro ("Elige un punto de recogida en el carrito") en
   lugar de "no hay envíos disponibles". También cubre los pagos acelerados.
2. Webhook `orders/create` con un metacampo verificado en el pedido (requiere `read_orders` y la aprobación
   de datos protegidos del cliente).
3. Título de la tarifa configurable (metacampo `jsonValue` de la personalización, leído en la input query).
4. Bloque en la página de Gracias.
5. Mapa con los puntos (latitud y longitud ya disponibles).
6. Búsqueda en el servidor para más de 5.000 puntos.
7. Caché compartida o snapshot en Firestore, e invalidación por eventos de metaobjetos.
8. Activar y desactivar puntos sin borrarlos (`capabilities.publishable`).
9. Adaptadores de Azure y AWS implementados, CI/CD e infraestructura como código.
10. Interfaz en inglés.
11. Detección automática de la tarifa en las zonas (`read_shipping`) y del embed activo (`read_themes`).
12. Migración de las Functions a Rust si el volumen lo exige.

### 27.3 Guía para `/speckit-tasks`

- **Setup**: FASE-0 y la inicialización del repositorio de la FASE-1.
- **Foundational**: el resto de la FASE-1 (contratos, configuración, composition root, sesiones, TOML,
  webhooks, `/healthz` y `/privacidad`).
- **Historias**: US-1 a US-7 en el orden de prioridad del §4, que corresponden a las FASE-2 a FASE-8.
- **Polish**: FASE-9.
- **Distribución**: la FASE-10 es operativa y PUEDE quedar como tareas manuales al final.
- **Tests**: están pedidos explícitamente (FR-090 a FR-092), así que cada historia incluye sus tareas de
  test (§24).
- **Rutas de archivos**: las del §14; el diseño de cada archivo está en los §15 a §20.

---

## Anexo A — Hechos de plataforma verificados (2026-09-25)

| Hecho | Fuente |
|---|---|
| Visibilidad limitada: la app no aparece en búsquedas ni categorías, se instala desde la URL del listing y la visibilidad se puede cambiar en cualquier momento | https://shopify.dev/docs/apps/launch/distribution/visibility |
| La distribución no se puede cambiar después de elegirla; las apps públicas embebidas usan token exchange | https://shopify.dev/docs/apps/launch/distribution |
| Las apps públicas con Functions funcionan en cualquier plan; las custom apps con Functions, solo en Plus | https://shopify.dev/docs/apps/build/functions/test-debug-functions |
| Las Checkout UI extensions de los pasos de información, envío y pago son solo Plus. Las extensiones de Gracias y de estado del pedido y las Functions están en todos los planes salvo Starter | https://shopify.dev/docs/apps/build/checkout/technologies |
| La Delivery Customization es la única API para personalizar opciones de entrega; máximo de 25 por tienda; operaciones `deliveryOptionHide`, `deliveryOptionRename` y `deliveryOptionMove`; en tarifas de transportista el renombrado antepone el nombre del transportista | https://shopify.dev/docs/api/functions/2026-07/delivery-customization |
| Los lenguajes que compilan directo a wasm, como Rust, rinden más que JavaScript y se recomiendan para apps públicas; JavaScript y TypeScript son válidos | https://shopify.dev/docs/apps/build/functions/programming-languages |
| La Pickup Point Delivery Option Generator API solo está disponible para custom apps en Plus o en development stores | https://shopify.dev/docs/apps/build/checkout/delivery-shipping/delivery-methods/generate-pickup-points |
| App Proxy: URL relativa o absoluta, un solo proxy por app, requiere `write_app_proxy`; `prefix` y `subpath` solo afectan a las instalaciones nuevas | https://shopify.dev/docs/apps/build/online-store/app-proxies |
| Metaobjetos declarados en TOML: `[metaobjects.app.<nombre>]`, `access.admin`, `access.storefront`, `display_name_field` y capacidades | https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions |
| Desde la API 2026-04, la app dueña de un metaobjeto `$app:` lo usa sin scopes | https://shopify.dev/changelog/metaobject-scopes-not-required-for-app-metaobjects |
| Validaciones en TOML: `validations.min`, `validations.max` y `validations.regex` | https://shopify.dev/docs/apps/build/metafields/list-of-validation-options |
| La app no puede activar un app embed; deep link `context=apps&activateAppId={api_key}/{handle}`; carpetas permitidas de la extensión; límite de 100 KB de Liquid | https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration |
| `DeliveryCustomizationInput.functionHandle` (`functionId` está deprecado) | https://shopify.dev/docs/api/admin-graphql/2026-04/input-objects/DeliveryCustomizationInput |
| `ShopifyFunction` expone `handle` y `appKey` | https://shopify.dev/docs/api/admin-graphql/2026-04/objects/ShopifyFunction |
| Attributes API (`shopify.attributes`) en customer account UI extensions 2026-07 con Preact | https://shopify.dev/docs/api/customer-account-ui-extensions/2026-07/target-apis/order-apis/attributes-api |
| 2025-07 es la última versión con componentes React; esas extensiones no se pueden actualizar desde el 1 de octubre de 2026 | https://shopify.dev/docs/api/checkout-ui-extensions/2025-07/targets/thank-you/block |
| Las App Home UI extensions están orientadas a apps de distribución custom | https://shopify.dev/changelog/build-app-home-as-a-ui-extension |
| Rust para Functions (plan B): target `wasm32-unknown-unknown` | https://shopify.dev/docs/apps/build/functions/programming-languages/rust-for-functions |
| Fixtures de test de Functions (`export`, `target`, `input`, `output`) y logs de ejecución en `.shopify/logs` | https://shopify.dev/docs/apps/build/functions/test-debug-functions |
| Ajax Cart API: `cart/update.js` con `attributes` | https://shopify.dev/docs/api/ajax/reference/cart |
| Validation Function (v2): también se aplica a los pagos acelerados; máximo de 25 por tienda | https://shopify.dev/docs/api/functions/2026-07/cart-and-checkout-validation |
| Los listings tienen el inglés como idioma principal y admiten traducciones | https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices |

## Anexo B — Checklist E2E manual

Se ejecuta en la tienda de prueba del §21.3. Los casos del carrito se repiten en Dawn y en Horizon, en la
página `/cart` y en el drawer, en escritorio y en móvil.

| ID | Caso | Resultado esperado | Cubre |
|---|---|---|---|
| E2E-01 | Instalar la app y abrir Contenido → Metaobjetos | Aparece "Punto de recogida" con sus 6 campos | US-1.1 |
| E2E-02 | Guardar un punto con datos inválidos | Shopify rechaza el guardado con el error | US-1.2 |
| E2E-03 | Navegar con un carrito normal | Sin widget y sin llamadas a `/apps/puntos-recogida` | US-2.7, NFR-04 |
| E2E-04 | Activar el modo demo en el carrito | Selector visible, checkout bloqueado con motivo, pagos acelerados ocultos | US-7, US-2.1 |
| E2E-05 | Con 600 puntos, buscar "sol", "SOL" y "sól" | Los mismos resultados, 50 como máximo, con el total | US-2.2 |
| E2E-06 | Elegir un punto solo con el teclado | Los atributos `punto_*` aparecen en `/cart.js` y el checkout se habilita | US-2.3 |
| E2E-07 | Recargar y abrir el drawer desde otra página | El punto sigue elegido | US-2.4 |
| E2E-08 | Borrar el punto elegido y volver al carrito | Aviso "ya no está disponible" y checkout bloqueado | US-2.5 |
| E2E-09 | Editar el punto elegido y volver al carrito | Atributos actualizados | US-2.6 |
| E2E-10 | Desactivar el modo demo con un punto elegido | `tipo_carrito` y los `punto_*` quedan vacíos o eliminados (anotar cuál de los dos hace Shopify) | US-7.2, US-2.8, CT-02 |
| E2E-11 | Bloquear el acceso al backend y abrir un carrito resolado | Error con "Reintentar" y checkout bloqueado | US-2.9, EC-08 |
| E2E-12 | Checkout de un carrito resolado con punto | Una sola opción: "Recogida en {dirección corta} · no se usará tu dirección" | US-3.1 |
| E2E-13 | Carrito resolado sin punto, entrando directo por `/checkout` | Ninguna opción de entrega | US-3.2, EC-01 |
| E2E-14 | Pago acelerado sin punto (si el tema lo permite) | Ninguna opción de entrega | EC-02 |
| E2E-15 | Checkout de un carrito normal | Las opciones habituales, sin la tarifa de recogida | US-3.3 |
| E2E-16 | Backend detenido, carrito con punto, checkout | Se cumplen E2E-12, E2E-13 y E2E-15 | US-3.5, SC-011 |
| E2E-17 | Completar el pedido y abrirlo en el admin | "Detalles adicionales" con `tipo_carrito` y los 7 `punto_*` | US-4.1 |
| E2E-18 | Editar y borrar el punto después del pedido | El pedido no cambia | US-4.2, SC-006 |
| E2E-19 | Página de estado del pedido (resolado y normal) | Bloque visible con enlace al mapa / sin bloque | US-4.3, US-4.4 |
| E2E-20 | Página de admin: pulsar "Activar" dos veces | 2 personalizaciones activas, sin duplicados | US-5.3 |
| E2E-21 | Página de admin: deep link del embed | Editor de temas con el embed marcado | US-5.4 |
| E2E-22 | Despliegue en Google Cloud desde cero, repetido, con `--dry-run` y con un proveedor inexistente | Se cumplen los escenarios US-6.1 a US-6.5 | US-6, SC-009 |
| E2E-23 | Recorrer el selector solo con teclado y con un lector de pantalla | Todo es operable y se anuncia | NFR-10 |
| E2E-24 | Lighthouse de la home y del carrito, con el embed y sin él | Pérdida ≤ 10 puntos | NFR-04 |
| E2E-25 | Desinstalar la app; `shopify app webhook trigger` para los 3 topics de privacidad | Sesiones borradas; los webhooks responden 200 | FR-065, FR-067 |

---

*Fin del archivo maestro. Cualquier cambio de alcance se registra aquí antes de tocar código
(constitución, flujo de desarrollo).*

