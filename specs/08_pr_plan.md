# 08 — PR Plan

## PR-01 — Cleanup y seguridad
Objetivo:
- borrar código muerto
- cerrar leaks y rutas peligrosas
- renombrar archivos confusos

Checklist:
- borrar componentes huérfanos
- borrar `/api/reminders/send`
- renombrar `gemini.ts` -> `bill-extractor.ts`
- desinstalar `@google/generative-ai`
- arreglar cualquier leak de secrets al frontend

## PR-02 — ActivityLog
Objetivo:
- crear tabla y service de ActivityLog
- empezar a registrar acciones clave

Checklist:
- migration
- service `logActivity`
- logs en create obligation, reminder sent, proof uploaded, payment verified

## PR-03 — Services core
Objetivo:
- extraer lógica de negocio de agentes y rutas

Checklist:
- crear `obligations.ts`
- crear `reminders.ts`
- crear `claims.ts`
- mover lógica reusable

## PR-04 — State transitions
Objetivo:
- centralizar cambios de estado

Checklist:
- helper o módulo de state transitions
- validaciones de transición
- tests mínimos

## PR-05 — Refactor owner-agent
Objetivo:
- reducir tool logic inline
- usar services

Checklist:
- tools finitas
- sin Prisma directo si existe service
- sin side effects ocultos

## PR-06 — Refactor tenant-agent
Objetivo:
- mismo criterio que owner-agent

## PR-07 — Dashboard slim
Objetivo:
- convertir dashboard en control tower read-only

Checklist:
- status overview
- timeline
- menos forms
- reusar services

## PR-08 — Follow-up automático de mora
Objetivo:
- 3 días -> re-reminder
- 7 días -> notificar owner

## PR-09 — Tests mínimos
Objetivo:
- blindar lo core

Tests:
- phone-router
- obligation transitions
- verifyPayment
- markProofUploaded
- sendReminder

## PR-10 — Polish y beta
Objetivo:
- demo real
- 3 a 5 owners beta
- medición básica
