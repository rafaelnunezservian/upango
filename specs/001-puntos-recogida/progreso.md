# Progreso: 001-puntos-recogida

Bitácora de handoff entre sesiones de Claude Code en la nube. Cada sesión la lee al empezar y la actualiza
al cerrar. Las tareas viven en [`tasks.md`](./tasks.md); el diseño, en [`spec.md`](./spec.md).

## Estado actual

- **Última fase completada**: Phase 3 — US-1 (T038–T045).
- **Siguiente sesión**: Phase 4 — US-2 backend (T046–T057).

## Plan de sesiones

| # | Fase de `tasks.md` | Tareas | Estado |
|---|---|---|---|
| 1 | Paso 0: hook de sesión + verificación de Foundational | — | ✅ |
| 2 | Phase 3 — US-1 | T038–T045 | ✅ |
| 3 | Phase 4 — US-2 backend | T046–T057 | ⏳ (siguiente) |
| 4 | Phase 4 — US-2 cliente de carrito | T058–T072 | ⏳ |
| 5 | Phase 4 — US-2 embed + Phase 9 — US-7 | T073–T077, T124–T126 | ⏳ |
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
