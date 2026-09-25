# Progreso: 001-puntos-recogida

Bitácora de handoff entre sesiones de Claude Code en la nube. Cada sesión la lee al empezar y la actualiza
al cerrar. Las tareas viven en [`tasks.md`](./tasks.md); el diseño, en [`spec.md`](./spec.md).

## Estado actual

- **Última fase completada**: Paso 0 (entorno cloud) sobre Setup + Foundational (T005–T037).
- **Siguiente sesión**: Phase 3 — US-1 (T038–T045).

## Plan de sesiones

| # | Fase de `tasks.md` | Tareas | Estado |
|---|---|---|---|
| 1 | Paso 0: hook de sesión + verificación de Foundational | — | ✅ |
| 2 | Phase 3 — US-1 | T038–T045 | ⏳ |
| 3 | Phase 4 — US-2 backend | T046–T057 | ⏳ |
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

## Decisiones y notas por sesión

### Sesión 1 — Paso 0

- Node 24 se instala desde nodejs.org en `~/.node24` porque el contenedor trae Node 22 y `.npmrc` tiene
  `engine-strict=true`.
- Verificado: 49 tests OK (6 omitidos: contract tests de Firestore sin emulador), `typecheck` y `lint`
  sin errores.
