# Spec Implementation Plan

Secuencia de PRs para converger el repo a la arquitectura definida en `specs/`.

---

## Principios de ejecución
- Un PR a la vez
- Cada PR debe buildear sin errores antes de mergear
- Cada PR tiene scope cerrado (in / out explícito)
- Rollback siempre posible (no hay migraciones destructivas en PR-01/02)
- Preferir refactors pequeños antes que reescrituras

---

## PR-01 — Cleanup y seguridad
**Objetivo:** Bajar complejidad, riesgo y confusión. Cero features nuevas.

**In scope:**
- Borrar componentes huérfanos (7 archivos, ~2,100 líneas)
- Borrar `/api/reminders/send`
- Renombrar `lib/gemini.ts` → `lib/bill-extractor.ts` + actualizar imports
- `npm uninstall @google/generative-ai`
- Fix `serializeWorkspace`: usar select explícito, no spread
- Fix `gmail-api.ts`: `extracted.amount` → `extracted.totalAmount`
- Fix `updateClaimTool`: `workspace.userId` → `workspace.ownerId`
- Borrar código muerto en `app/dashboard/[workspaceId]/page.tsx`
- Agregar verificación básica en mercadopago webhook (check `x-signature` header)
- Archivar `docs/n8n-whatsapp-bot-mvp.workflow.json`

**Out of scope:**
- Cualquier feature nueva
- Migración de arquitectura
- ActivityLog
- Services

**Archivos tocados:**
- `components/dashboard-client.tsx` → DELETE
- `components/monthly-obligations-view.tsx` → DELETE
- `components/bill-upload-form.tsx` → DELETE
- `components/obligation-verifier.tsx` → DELETE
- `components/contract-manager.tsx` → DELETE
- `components/mercadopago-connect.tsx` → DELETE
- `lib/n8n-templates.ts` → DELETE
- `app/api/reminders/send/route.ts` → DELETE
- `lib/gemini.ts` → RENAME → `lib/bill-extractor.ts`
- `lib/dashboard-data.ts` → FIX (select explícito)
- `lib/gmail-api.ts` → FIX (amount bug)
- `lib/owner-agent.ts` → FIX (userId → ownerId en updateClaimTool)
- `app/api/webhooks/mercadopago/route.ts` → FIX (agregar header check)
- `app/dashboard/[workspaceId]/page.tsx` → CLEANUP (borrar exports muertos)
- `package.json` → REMOVE `@google/generative-ai`
- Todos los imports de `gemini` → actualizar a `bill-extractor`

**Criterio de done:**
- `npm run build` pasa sin errores
- Linter sin errores nuevos
- Los flows activos siguen funcionando (webhook, dashboard, bot)
- Ningún secret leakeado al frontend en las respuestas del server

**Riesgo:** Bajo. Solo borrado y renombres. Sin cambios de lógica.

**Rollback:** `git revert` del PR.

---

## PR-02 — ActivityLog
**Objetivo:** Crear la tabla y el service de ActivityLog. Empezar a registrar acciones clave.

**In scope:**
- Agregar tabla `ActivityLog` al schema Prisma
- `npx prisma db push` (no destructivo, solo agrega tabla)
- Crear `lib/services/activity-log.ts` con `logActivity()`
- Escribir log en: create obligation, reminder sent, proof uploaded, payment verified

**Out of scope:**
- Mostrar ActivityLog en dashboard (PR-07)
- Logs exhaustivos de todo (solo los 4 críticos)

**Archivos tocados:**
- `prisma/schema.prisma` → ADD ActivityLog model
- `lib/services/activity-log.ts` → CREATE
- `lib/services/` → CREATE directorio
- `app/api/cron/send-reminders/route.ts` → add logActivity call
- `app/api/tenant/[token]/proof/route.ts` → add logActivity call
- `lib/owner-agent.ts` → add logActivity en verifyPayment tool
- `app/api/obligations/generate-rent/route.ts` → add logActivity call

**Criterio de done:**
- Tabla existe en DB
- `logActivity()` funciona
- Las 4 acciones clave escriben al log
- `npm run build` pasa

**Riesgo:** Bajo. Additive only.

**Rollback:** Revert PR. Tabla queda en DB sin datos críticos.

---

## PR-03 — Services core
**Objetivo:** Crear `lib/services/` como fuente única de verdad. Extraer lógica de negocio de los agentes y rutas.

**In scope:**
- Crear `lib/services/obligations.ts` con:
  - `getObligationsForWorkspace()`
  - `createManualCharge()`
  - `verifyPayment()`
  - `markProofUploaded()`
  - `createMonthlyObligations()`
- Crear `lib/services/reminders.ts` con:
  - `sendReminder()`
  - `scheduleReminderIfNeeded()`
- Crear `lib/services/claims.ts` con:
  - `createClaim()`
  - `updateClaimStatus()`
  - `listClaimsForWorkspace()`
- Crear `lib/services/tenants.ts` con:
  - `lookupTenantByPhone()`
  - `lookupOwnerByPhone()`
- Refactorear cron routes para usar services
- Refactorear API routes de obligations para usar services

**Out of scope:**
- Refactor de los agentes (PR-05/06)
- Tests (PR-09)

**Archivos tocados:**
- `lib/services/obligations.ts` → CREATE
- `lib/services/reminders.ts` → CREATE
- `lib/services/claims.ts` → CREATE
- `lib/services/tenants.ts` → CREATE
- `app/api/cron/send-reminders/route.ts` → usa services
- `app/api/cron/owner-alerts/route.ts` → usa services
- `app/api/obligations/*/route.ts` → usa services
- `app/api/tenant/[token]/proof/route.ts` → usa services

**Criterio de done:**
- Las rutas cron y obligation no tienen Prisma directo (excepto casos triviales)
- Services tienen input tipado y retorno consistente
- `npm run build` pasa

**Riesgo:** Medio. Refactor de lógica activa. Validar que los flows sigan funcionando.

---

## PR-04 — State transitions centralizadas
**Objetivo:** Toda transición de estado de Obligation pasa por un módulo explícito y validado.

**In scope:**
- Crear `lib/workflows/obligation-state-machine.ts`
  - `transitionObligationStatus(obligationId, newStatus, actorType, context)`
  - Valida que la transición sea legal según spec 04
  - Escribe ActivityLog
  - Dispara side effects (notificaciones) cuando aplica
- Reemplazar todos los `prisma.obligation.update({ data: { status: ... } })` dispersos por llamadas al state machine
- Crear `lib/workflows/claim-state-machine.ts` (V1 simple)

**Out of scope:**
- Workflows futuros (rent adjustment)
- Tests (PR-09)

**Archivos tocados:**
- `lib/workflows/obligation-state-machine.ts` → CREATE
- `lib/workflows/claim-state-machine.ts` → CREATE
- `lib/services/obligations.ts` → usa state machine
- `lib/owner-agent.ts` → hereda via services (parcial, completo en PR-05)
- `app/api/obligations/[obligationId]/status/route.ts` → usa state machine

**Criterio de done:**
- Ningún `prisma.obligation.update({ status })` suelto fuera del state machine
- Transiciones inválidas son rechazadas con error claro
- `npm run build` pasa

**Riesgo:** Medio. Requiere mapear todos los lugares que cambian status.

---

## PR-05 — Refactor owner-agent
**Objetivo:** Reducir `lib/owner-agent.ts` de 1601 líneas a un dispatcher delgado. Toda lógica de negocio pasa por services.

**In scope:**
- Cada tool del agente llama al service correspondiente (no Prisma directo)
- Reducir tools de 25 a 10 (spec 01)
- Postergar tools out-of-spec: `ask_contract`, `create_casita`, `delete_casita`, `start_rental`, `end_rental`, `connect_email_oauth`
- Agregar confirmación explícita para acciones destructivas
- El agente no cambia estado directo

**Out of scope:**
- Separar `classifier.ts` / `response-composer.ts` (puede ser siguiente iteración)
- Skills individuales en archivos separados (puede hacerse gradualmente)

**Archivos tocados:**
- `lib/owner-agent.ts` → REFACTOR
- `lib/contract-reader.ts` → desconectar del agente (mantener archivo, no exponer tool)

**Criterio de done:**
- `owner-agent.ts` < 400 líneas
- Ningún `prisma.*` directo dentro de las tools (solo via services)
- Las 10 tools de spec 01 funcionan
- `npm run build` pasa

**Riesgo:** Alto. Es el archivo más complejo. Hacer con mucha atención.

---

## PR-06 — Refactor tenant-agent
**Objetivo:** Mismo criterio que PR-05 para `lib/whatsapp-agent.ts`.

**In scope:**
- Tools usan services
- Sin Prisma directo
- 4 tools V1: get_my_obligations, upload_proof, get_payment_info, create_claim

**Archivos tocados:**
- `lib/whatsapp-agent.ts` → REFACTOR

**Criterio de done:**
- `whatsapp-agent.ts` < 200 líneas
- Usa services
- 4 tools V1 funcionan

**Riesgo:** Medio. Más simple que owner-agent.

---

## PR-07 — Dashboard slim (control tower)
**Objetivo:** El dashboard pasa a ser read-only + timeline. Sin forms duplicados del bot.

**In scope:**
- Mostrar ActivityLog como timeline en el dashboard
- Simplificar UnitEditor: solo mostrar estado, no forms de write pesados
- Estado del mes actual: pending, overdue, verified por obligation
- Eliminar forms que duplican tools del bot

**Out of scope:**
- Rediseño completo de UI
- Métricas avanzadas

**Archivos tocados:**
- `app/dashboard/[workspaceId]/page.tsx` → SIMPLIFY
- `components/unit-editor.tsx` → SLIM DOWN
- Nueva sección de timeline usando ActivityLog

**Criterio de done:**
- Dashboard no tiene forms de write pesados duplicados con el bot
- Timeline visible con últimas acciones
- `npm run build` pasa

**Riesgo:** Medio. Cuidar no romper flujos de onboarding/settings que sí van en web.

---

## PR-08 — Follow-up automático de mora
**Objetivo:** Completar el ciclo de cobranzas. Si no paga, el sistema escala automáticamente.

**In scope:**
- Cron job (o agregar al existente): si obligation es `overdue` hace 3 días → re-recordatorio al tenant
- Si `overdue` hace 7 días → notificación al owner "Tu inquilino lleva 7 días de mora en [cobro]"
- Máximo 3 follow-ups automáticos por obligation
- Registrar en ActivityLog

**Archivos tocados:**
- `app/api/cron/send-reminders/route.ts` → agregar lógica follow-up
- `lib/services/reminders.ts` → `sendOverdueFollowup()`
- `prisma/schema.prisma` → campo `overdueFollowupCount` en Obligation (o usar NotificationLog)

**Criterio de done:**
- Follow-up se envía en los plazos correctos
- No se envía más de 3 veces
- ActivityLog lo registra

**Riesgo:** Bajo-medio. Lógica de cron, bien delimitada.

---

## PR-09 — Tests mínimos
**Objetivo:** Blindar la lógica core antes del beta.

**Tests:**
- `lib/router/phone-router.ts` → unit tests
- `lib/workflows/obligation-state-machine.ts` → test de transiciones válidas e inválidas
- `lib/services/obligations.ts` → verifyPayment, markProofUploaded
- `lib/services/reminders.ts` → sendReminder

**Framework:** Jest + ts-jest (agregar al package.json)

**Criterio de done:**
- Al menos 15 tests pasando
- Las transiciones de estado inválidas están cubiertas

---

## PR-10 — Polish y beta
**Objetivo:** Todo listo para mostrar a 3-5 owners reales.

**In scope:**
- Twilio production setup
- Demo video 2 minutos
- Mensajes del bot pulidos (tono, edge cases)
- Landing page simple actualizada
- Verificación end-to-end del ciclo completo

**Criterio de done:**
- El flujo completo (onboarding → recordatorio → pago → verificación) funciona sin intervención del developer
- 3-5 owners beta probaron y dieron feedback

---

## Dependencias entre PRs

```
PR-01 (cleanup)
  └── PR-02 (ActivityLog)
       └── PR-03 (Services core)
            ├── PR-04 (State machines)
            │    ├── PR-05 (owner-agent refactor)
            │    │    └── PR-06 (tenant-agent refactor)
            │    │         └── PR-07 (dashboard slim)
            │    └── PR-08 (follow-up mora)
            └── PR-09 (tests) ← puede ir en paralelo con PR-07/08
                 └── PR-10 (beta)
```

---

## Timeline estimado

| PR | Días estimados | Quién bloquea |
|----|---------------|---------------|
| PR-01 | 1 día | Nadie — es cleanup |
| PR-02 | 1 día | PR-01 |
| PR-03 | 2-3 días | PR-02 |
| PR-04 | 1-2 días | PR-03 |
| PR-05 | 2-3 días | PR-04 |
| PR-06 | 1 día | PR-04 |
| PR-07 | 2 días | PR-05, PR-06 |
| PR-08 | 1 día | PR-03 |
| PR-09 | 1-2 días | PR-04 |
| PR-10 | 2-3 días | PR-07, PR-08, PR-09 |
| **Total** | **~16-19 días** | |
