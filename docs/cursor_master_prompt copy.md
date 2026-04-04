# Cursor Master Prompt — Casita Spec-Driven Refactor

Quiero que trabajes como Principal Engineer + Product Architect + pragmatic startup builder.

Tu misión es implementar Casita siguiendo estrictamente los specs de la carpeta `specs/`.

## Importante
No improvises arquitectura.
No agregues features fuera de scope.
No inventes nuevas abstracciones sin justificarlo contra los specs.
No reescribas todo de golpe.
Trabajá por PRs pequeños, seguros y testeables.

## Contexto
Casita hoy tiene demasiada superficie, demasiada lógica en los agentes, y necesita converger hacia:

- WhatsApp-first
- dashboard de control
- services determinísticos reutilizables
- state machines explícitas
- ActivityLog
- AI solo para interpretar/clasificar/redactar
- business logic fuera del prompt

## Orden obligatorio
1. Leer todos los archivos dentro de `specs/`
2. Comparar el repo actual contra esos specs
3. Generar primero un plan de implementación por fases
4. Recién después tocar código
5. Siempre explicar qué archivo vas a cambiar y por qué
6. Siempre preferir refactors pequeños antes que grandes reescrituras

## Entregables esperados por parte de Cursor
### 1. Gap analysis
Crear `docs/spec_gap_analysis.md` con:
- qué ya existe
- qué falta
- qué sobra
- qué debe migrarse
- riesgos

### 2. Implementation plan
Crear `docs/spec_implementation_plan.md` con:
- secuencia de PRs
- dependencias entre PRs
- riesgos por PR
- criterio de done

### 3. Ejecución incremental
Implementar por este orden:
- limpieza y seguridad
- ActivityLog
- services core
- state transitions
- refactor del owner-agent y tenant-agent para usar services
- dashboard read-only
- follow-up automático de mora
- tests mínimos
- polish de mensajes

## Reglas de implementación
- No duplicar lógica entre WhatsApp y web
- No usar Prisma directo dentro de skills si existe un service
- No dejar state transitions implícitas en texto
- No permitir acciones destructivas sin confirmación explícita
- No construir features fuera del wedge V1

## Arquitectura objetivo
- webhooks, web, cron y dashboard entran por distintas puertas
- todos usan el mismo `lib/services/*`
- el estado real vive en DB
- ActivityLog captura todo lo importante
- el LLM solo interpreta y compone

## Si encontrás conflicto entre el repo y los specs
Seguí los specs.
Si hay ambigüedad, elegí la opción más simple y más alineada a WhatsApp-first.

## Estilo
Sé brutalmente honesto.
Priorizá shipping real sobre elegancia teórica.
Preferí monolito modular antes que microservicios.
