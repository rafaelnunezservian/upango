# Implementation Plan: Puntos de recogida sin Shopify Plus

**Branch**: `001-puntos-recogida` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: archivo maestro `specs/001-puntos-recogida/spec.md`

> **Este plan está integrado en el archivo maestro [`spec.md`](./spec.md) (SPEC + PLAN).** Este archivo
> existe para que `/speckit-tasks` encuentre un `plan.md`; no duplica contenido. Antes de generar tareas
> hay que leer `spec.md` completo: la Parte II es el plan técnico.

## Summary

App pública de Shopify con visibilidad limitada. La forman: un backend React Router en contenedor (Cloud Run
en la referencia, detrás de una CLI de despliegue con proveedores intercambiables), un metaobjeto app-owned,
un app embed con selector de puntos, dos Delivery Customization Functions en TypeScript compiladas a wasm y
una customer account UI extension en Preact. Detalle en `spec.md` §9.

## Technical Context (resumen; el detalle está en `spec.md` §9)

- **Language/Version**: TypeScript 5.x `strict` · Node.js 24 LTS · Liquid
- **Primary Dependencies**: template React Router de Shopify, App Bridge y Polaris web components,
  `@google-cloud/firestore`, `zod`, esbuild, `@shopify/shopify_function`, `@shopify/ui-extensions`
  (Preact), `tsx`
- **Storage**: Firestore, solo para sesiones OAuth
- **Testing**: Vitest, harness de fixtures de Shopify CLI (Functions sobre wasm) y checklist E2E
- **Target Platform**: Shopify y contenedor OCI (Cloud Run)
- **Project Type**: monorepo de app Shopify (web service, extensiones, paquetes y CLI)
- **Performance Goals / Constraints / Scale**: `spec.md` §5.2 (NFR) y §9

## Constitution Check

Ver `spec.md` §10.2: todas las compuertas en PASS contra la constitución v1.0.0.

## Project Structure

Documentación de la feature: `specs/001-puntos-recogida/` con `spec.md` (archivo maestro), `plan.md`
(este puntero) y `tasks.md` (lo genera `/speckit-tasks`). El código fuente sigue el árbol de `spec.md` §14.

## Mapa del archivo maestro

| Para… | Ver en `spec.md` |
|---|---|
| Historias de usuario y prioridades | §4 |
| Requisitos funcionales y no funcionales | §5 |
| Criterios de éxito | §6 |
| Decisiones (equivale a research.md) | §12 |
| Modelo de datos y contratos (equivale a data-model.md y contracts/) | §13 |
| Estructura del repositorio | §14 |
| Diseño por componente | §15 a §20 |
| Entornos y scripts | §21 |
| Estrategia de pruebas y validación (equivale a quickstart.md) | §24 y Anexo B |
| Requisitos del README | §25 |
| Hoja de ruta y guía para `/speckit-tasks` | §27 |

## Complexity Tracking

Ver `spec.md` §10.3.
