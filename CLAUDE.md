@AGENTS.md

## Flujo de trabajo en sesiones cloud

- Antes de empezar, leer `specs/001-puntos-recogida/progreso.md` (estado y siguiente sesión).
- Commits a nombre del dueño del repo (lo configura `.claude/hooks/session-start.sh`); los mensajes de
  commit NO llevan líneas `Co-Authored-By` ni `Claude-Session`.
- No crear pull requests: solo push de la rama de la sesión; el dueño abre el PR.
- Cierre de sesión: `npm test`, `npm run typecheck` y `npm run lint` en verde, tareas marcadas en
  `tasks.md` y `progreso.md` actualizado.
