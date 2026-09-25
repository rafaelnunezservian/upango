<!--
Sync Impact Report
- Version change: plantilla sin ratificar → 1.0.0 (ratificación inicial)
- Principios (plantilla genérica [PRINCIPLE_1..5] → 8 principios concretos):
  I. Arquitectura limpia y SOLID · II. Código limpio · III. El servidor manda (fail-closed) ·
  IV. La plataforma primero · V. Portabilidad y 12-factor · VI. Seguridad y privacidad por defecto ·
  VII. Pruebas en las piezas críticas · VIII. La documentación es un entregable
- Secciones agregadas: "Restricciones de plataforma y stack", "Flujo de desarrollo y compuertas de calidad"
- Secciones eliminadas: ninguna
- Plantillas que requieren actualización: ninguna ✅ (plan-template, spec-template y tasks-template
  leen la constitución en tiempo de ejecución; no se modifican)
- TODOs diferidos: ninguno
-->

# Constitución del proyecto Puntos de Recogida

## Principios fundamentales

### I. Arquitectura limpia y SOLID (NO NEGOCIABLE)

- Las dependencias apuntan hacia adentro: presentación → aplicación → dominio. El dominio NO DEBE
  importar frameworks, SDKs de Shopify ni SDKs de proveedores de nube.
- Los casos de uso DEBEN depender de puertos (interfaces) y nunca de implementaciones concretas. Los
  adaptadores implementan puertos. Cada proceso tiene un único *composition root* que cablea las
  implementaciones.
- SRP: un caso de uso por módulo; las rutas y los controladores son delgados y no contienen reglas de
  negocio.
- OCP: agregar un proveedor de nube, un almacenamiento de sesiones o un tema compatible NO DEBE modificar
  el dominio ni la aplicación; se agrega un adaptador y se registra.
- LSP: toda implementación de un mismo puerto DEBE pasar la misma suite de *contract tests*.
- ISP: los puertos son pequeños y específicos del consumidor.
- DIP: ningún caso de uso instancia infraestructura.
- Proporcionalidad: las piezas pequeñas (Functions, JS del carrito, extensión de pedido) aplican
  "núcleo funcional puro + capa imperativa delgada" en lugar de capas completas.

*Razón*: la app combina piezas ejecutadas por Shopify y piezas hospedadas en una nube intercambiable;
aislar el dominio permite probarlo sin plataforma y cambiar de proveedor sin reescribir reglas.

### II. Código limpio

- TypeScript en modo `strict` en todo el código propio; `any` explícito prohibido salvo en bordes de
  integración justificados con un comentario.
- Lenguaje ubicuo en español para el dominio (`PuntoRecogida`, `SeleccionPunto`, `TipoCarrito`);
  términos técnicos del framework en inglés (`loader`, `action`, `adapter`).
- Sin strings ni números mágicos: las constantes de contrato (claves de atributos, título de la tarifa,
  normalización) viven en una única fuente compartida (`@puntos-recogida/contratos`).
- Funciones cortas con nombres que revelan intención; errores explícitos y tipados; ninguna excepción
  silenciada.
- Los comentarios explican el porqué, no el qué.
- ESLint y Prettier se ejecutan sin advertencias antes de cada entrega.

### III. El servidor manda (fail-closed)

- Toda regla que protege la compra (solo recogida en carritos resolado; punto obligatorio) DEBE
  aplicarse en Shopify Functions. El JavaScript del storefront es exclusivamente experiencia de usuario.
- Ante datos faltantes o inválidos en un carrito resolado, el sistema DEBE fallar cerrado (no ofrecer
  entrega) en lugar de abrirse.

*Razón*: cualquier visitante puede saltarse la UI (URL directa a `/checkout`, pagos acelerados, JS
desactivado); solo el backend de Shopify es inevitable.

### IV. La plataforma primero

- Cada responsabilidad va en la pieza de Shopify diseñada para ella: datos en metaobjetos, UI de tienda
  en la theme app extension, reglas en Functions, registro histórico en los atributos del pedido y
  visualización en la customer account UI extension.
- No existe base de datos propia para datos de negocio; la única persistencia propia son las sesiones
  OAuth de cada tienda.
- El checkout NO DEBE depender de la disponibilidad del backend de la app.

### V. Portabilidad y 12-factor

- La configuración se recibe exclusivamente por variables de entorno, validadas al arrancar.
- Ningún SDK ni CLI de un proveedor de nube se usa fuera de la capa de infraestructura del backend o de
  `deploy/src/proveedores/*`.
- El backend se empaqueta como contenedor OCI estándar, ejecutable en cualquier plataforma de
  contenedores.
- Todo despliegue pasa por la interfaz `ProveedorDespliegue`; Google Cloud es la implementación de
  referencia.

### VI. Seguridad y privacidad por defecto

- Mínimo privilegio: solo los *access scopes* imprescindibles; todo scope nuevo se justifica en el
  archivo maestro antes de agregarse.
- Los secretos viven solo en el gestor de secretos del proveedor y en variables de entorno; nunca en el
  repositorio, en logs ni en argumentos de línea de comandos.
- Toda entrada desde Shopify se autentica: firma HMAC del App Proxy, session token del admin embebido y
  HMAC de webhooks.
- La app no almacena datos personales de compradores y atiende los webhooks de privacidad obligatorios.
- Todo texto de origen externo se renderiza como texto, nunca como HTML.

### VII. Pruebas en las piezas críticas

- Son obligatorias las pruebas automatizadas de: las Functions (cada fila de sus tablas de decisión,
  ejecutadas sobre el wasm compilado), los casos de uso y adaptadores del backend, la lógica pura del
  carrito y la CLI de despliegue.
- Cobertura mínima del 90 % de líneas en las capas de dominio y aplicación.
- Todo puerto con más de una implementación tiene una suite de *contract tests* compartida.
- Antes de cada entrega se ejecuta el recorrido E2E manual documentado.

### VIII. La documentación es un entregable

- El README explica cómo funciona todo y cómo compilar, probar, desplegar y operar la app; se actualiza
  en el mismo cambio que modifica el comportamiento.
- Cada decisión de diseño se registra (ID `DEC-nn`) con decisión, razón y alternativas.
- El archivo maestro de la feature (`specs/001-puntos-recogida/spec.md`) es la fuente de verdad del
  qué, el por qué y el cómo.

## Restricciones de plataforma y stack

- App **pública** de Shopify con **visibilidad limitada**: es la única distribución en la que las
  Functions corren en tiendas sin Shopify Plus.
- Shopify API **2026-07** en la configuración de la app, webhooks, Functions y UI extensions.
- Backend: template React Router de Shopify sobre **Node.js 24 LTS** y TypeScript; página de admin
  embebida (iframe) con Polaris web components y App Bridge.
- Functions: **TypeScript compilado a WebAssembly** con Shopify CLI (Javy).
- Extensión de página de pedido: Preact con Polaris web components.
- Storefront: theme app extension (app embed) con JavaScript sin dependencias de runtime, empaquetado
  con esbuild.
- Sesiones detrás de la interfaz `SessionStorage` de Shopify (Firestore en la referencia GCP).
- Interfaz en español, con todos los textos en archivos de locales.
- Presupuestos: bundle JS del embed ≤ 20 KB minificado; impacto en Lighthouse ≤ 10 puntos; cada Function
  con un margen ≥ 50 % bajo el límite de instrucciones de la plataforma.

## Flujo de desarrollo y compuertas de calidad

- Desarrollo guiado por especificación con Spec Kit: archivo maestro (spec + plan) → `/speckit-tasks`
  → `/speckit-implement`. Todo cambio de alcance se registra primero en el archivo maestro.
- Compuertas antes de desplegar: lint, typecheck, tests (incluidos los fixtures de las Functions sobre el
  wasm), build de las Functions y del bundle del tema dentro de su presupuesto de peso, y validación de
  la configuración de la app con Shopify CLI.
- Cada revisión verifica el cumplimiento de esta constitución (*Constitution Check*).

## Gobierno

- Esta constitución prevalece sobre cualquier otra práctica del proyecto.
- Enmiendas: se proponen por escrito con motivación, impacto y plan de migración, y las aprueba el
  responsable del proyecto.
- Versionado semántico: MAJOR para eliminar o redefinir principios de forma incompatible; MINOR para
  agregar un principio o sección o ampliarlos materialmente; PATCH para aclaraciones de redacción.
- Cumplimiento: `/speckit-tasks`, `/speckit-analyze` y cada revisión verifican las compuertas; toda
  excepción se justifica en la sección *Complexity Tracking* del archivo maestro.
- Guía de desarrollo en tiempo de ejecución: `specs/001-puntos-recogida/spec.md` y el `README.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
