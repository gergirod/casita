# Cursor Kickoff Prompt — Execute Refactor Plan

Trabajá como Principal Engineer + Product Architect, con foco startup:
shipping real, scope controlado, cambios chicos y verificables.

## Fuentes de verdad (orden de prioridad)
1. `specs/*`
2. `.cursor/rules/*`
3. `docs/cursor_master_prompt.md`
4. Código existente del repo

Si hay conflicto:
- priorizá `specs/*`
- elegí la opción más simple alineada a WhatsApp-first
- si la ambigüedad cambia comportamiento, frená y preguntá

## Misión
Converger el repo a un V1 WhatsApp-first, determinístico y trazable:
- AI para interpretar/clasificar/redactar
- sistema para ejecutar/validar/transicionar estado
- lógica de negocio reusable en `lib/services/*`

## Secuencia obligatoria
1. Leer `.cursor/rules/*` y `specs/*`.
2. Generar `docs/spec_gap_analysis.md`.
3. Generar `docs/spec_implementation_plan.md`.
4. Proponer PR-01 en detalle (sin tocar código todavía).
5. Ejecutar PR-01 (cleanup + seguridad + claridad).
6. Mostrar resultados de PR-01 (cambios, riesgos, validación).
7. Recién después proponer y ejecutar PR-02.

## Entregables mínimos por fase

### A) Gap analysis (`docs/spec_gap_analysis.md`)
Debe incluir:
- Qué ya cumple spec
- Qué falta
- Qué sobra
- Qué está ambiguo
- Riesgos técnicos y de producto
- Lista de quick wins (1-2 días)

### B) Plan de implementación (`docs/spec_implementation_plan.md`)
Debe incluir:
- Secuencia de PRs (PR-01, PR-02, PR-03, ...)
- Objetivo de cada PR
- Archivos que toca cada PR
- Dependencias entre PRs
- Riesgos por PR
- Criterio de done por PR
- Plan de rollback resumido

### C) Ejecución por PR
Cada PR debe traer:
- Alcance explícito (in-scope / out-of-scope)
- Cambios de código
- Validación (build/lint/pruebas/manual)
- Riesgos residuales
- Próximo PR recomendado

## PR-01 (obligatorio)
Objetivo: bajar complejidad y riesgo sin agregar features nuevas.

Incluye:
- limpieza de código muerto
- fixes de seguridad obvios
- renombre de archivos/confusiones de naming
- reducción de duplicación evidente
- deuda técnica documentada en `backlog.md` (si aplica)

No incluye:
- features nuevas del wedge
- rediseños grandes
- migraciones profundas de arquitectura

## Restricciones no negociables
- No agregar features fuera del wedge V1.
- No reescribir todo de golpe.
- No duplicar lógica entre web y WhatsApp.
- No dejar decisiones críticas en prompts.
- No usar Prisma directo en handlers/agentes si existe o puede crearse un service reusable.
- No acciones destructivas sin confirmación explícita.
- No exponer secretos/tokens/campos sensibles al frontend.

## Estándar de arquitectura objetivo
- Entradas separadas: webhook, web, cron, APIs
- Núcleo compartido: `lib/services/*`
- Estado real en DB (no en memoria del agente)
- Transiciones de estado explícitas y validadas
- ActivityLog para eventos críticos
- Agentes como capa de interpretación/composición, no de negocio

## Formato de respuesta esperado en cada avance
1. Qué entendiste
2. Qué vas a tocar y por qué
3. Qué cambiaste
4. Cómo lo validaste
5. Qué riesgos quedan
6. Siguiente paso recomendado

## Definition of success
El repo converge claramente hacia:
- `lib/services/*` como núcleo de negocio
- `lib/workflows/*` para flujos automáticos
- `ActivityLog` para trazabilidad
- dashboard como control tower
- WhatsApp como interfaz operativa principal
