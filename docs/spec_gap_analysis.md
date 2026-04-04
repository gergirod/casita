# Spec Gap Analysis

Comparación entre `specs/*` y el estado actual del repo.
Generado post-audit completo del repo.

---

## A) Qué ya cumple spec

| Spec | Qué | Estado |
|------|-----|--------|
| 01 — Scope V1 | Onboarding web (casita + inquilino + template) | ✅ Funcional |
| 01 — Scope V1 | Generación de obligaciones mensuales | ✅ Funcional |
| 01 — Scope V1 | Recordatorios automáticos (email + WhatsApp) | ✅ Funcional |
| 01 — Scope V1 | Portal tenant con token (ver obligaciones, subir comprobante) | ✅ Funcional |
| 01 — Scope V1 | Owner puede verificar pago | ✅ Funcional (dashboard + WhatsApp) |
| 01 — Scope V1 | Inquilino puede crear reclamo por WhatsApp | ✅ Funcional |
| 03 — Domain | Workspace, Unit, ObligationTemplate, Obligation, Claim existen | ✅ En schema |
| 04 — State machines | Estados de Obligation existen (upcoming, reminded, pending, proof_uploaded, verified, overdue, cancelled) | ✅ En schema (enum) |
| 05 — Channel | Owner puede operar por WhatsApp (overview, cobros, verificar, recordatorio, boleta) | ✅ Funcional (owner-agent.ts) |
| 05 — Channel | Tenant puede operar por WhatsApp (deudas, comprobante, pago info, reclamo) | ✅ Funcional (whatsapp-agent.ts) |
| 06 — AI Contract | OpenAI function calling para clasificar + ejecutar | ✅ Implementado |
| 00 — North Star | Frase de producto / wedge cobranzas | ✅ Alineado |

---

## B) Qué falta

| Spec | Qué falta | Impacto |
|------|-----------|---------|
| 03 — Domain | **ActivityLog no existe** (tabla, service, writes) | 🔴 Crítico — spec lo define como obligatorio |
| 02 — Architecture | **`lib/services/*` no existe** — lógica de negocio vive inline en owner-agent (1601 líneas) y API routes | 🔴 Crítico — base de la arquitectura objetivo |
| 04 — State machines | **Las transiciones de estado no son centralizadas ni validadas** — están dispersas en owner-agent, cron routes, tenant route, y dashboard | 🔴 Crítico — spec prohíbe esto |
| 06 — AI Contract | **No existe `classifier.ts` separado** — clasificación + ejecución + composición todo mezclado en el agente | 🟡 Medio — crea acoplamiento y dificulta testeo |
| 06 — AI Contract | **No existe `response-composer.ts`** separado | 🟡 Medio |
| 09 — File structure | **`lib/skills/owner/*` y `lib/skills/tenant/*` no existen** — todo en archivos monolíticos | 🟡 Medio |
| 08 — PR Plan | **Follow-up automático de mora** (3 días → re-reminder, 7 días → notificar owner) | 🟡 Medio — en spec V1 |
| 05 — Channel | **Dashboard no es read-only** — tiene forms de write que duplican lo que hace el bot | 🟡 Medio |
| 01 — Scope V1 | **Timeline / ActivityLog en dashboard** no existe | 🟡 Medio |

---

## C) Qué sobra (out of spec V1)

| Qué | Spec dice | Acción |
|-----|-----------|--------|
| `lib/n8n-templates.ts` (257 líneas) | No entra en V1 | **Borrar** |
| `components/dashboard-client.tsx` (540 líneas) | No importado / legacy | **Borrar** |
| `components/monthly-obligations-view.tsx` (714 líneas) | No importado | **Borrar** |
| `components/bill-upload-form.tsx` (~400 líneas) | No importado | **Borrar** |
| `components/obligation-verifier.tsx` (~80 líneas) | No importado | **Borrar** |
| `components/contract-manager.tsx` (~60 líneas) | No importado | **Borrar** |
| `components/mercadopago-connect.tsx` | No importado | **Borrar o conectar** |
| `lib/contract-reader.ts` (166 líneas) + tool `ask_contract` | Spec 01 lo excluye explícitamente | **Postergar** |
| `lib/outlook-api.ts` + `lib/microsoft-oauth.ts` + routes Microsoft | Spec 01 lo excluye explícitamente | **Postergar** |
| `lib/mail-fetcher.ts` (687 líneas, IMAP) | Spec 01 excluye IMAP | **Postergar** |
| `app/api/reminders/send/route.ts` | Sin referencias, ruta abierta | **Borrar (seguridad)** |
| `docs/n8n-whatsapp-bot-mvp.workflow.json` | n8n ya no es el stack | **Archivar** |
| Código muerto en `dashboard/[workspaceId]/page.tsx` (~230 líneas) | Sin uso | **Borrar** |
| `@google/generative-ai` package | No se usa (todo es OpenAI) | **Desinstalar** |

**Total estimado de código a eliminar: ~2,400 líneas**

---

## D) Qué está ambiguo

| Item | Ambigüedad | Decisión tomada |
|------|-----------|----------------|
| `Property` como entidad separada | Spec 03 no la menciona (habla de Workspace → Unit) | Mantener en DB por ahora, no exponer en UI ni agregar lógica nueva. Documentar como deuda. |
| Email ingestion (Gmail OAuth) | Spec 01 la excluye como "completo", pero el wedge incluye upload de boletas | V1: el owner manda foto de boleta por WhatsApp. Gmail OAuth → PR futuro. |
| `lib/gmail-api.ts` bug `extracted.amount` vs `extracted.totalAmount` | Bug activo | Fix en PR-01 |
| `updateClaimTool` busca `workspace.userId` que no existe (debería ser `ownerId`) | Bug activo | Fix en PR-01 |
| MercadoPago | Spec 01 no lo incluye | Mantener infraestructura, no desarrollar más por ahora |

---

## E) Riesgos técnicos activos

| Riesgo | Severidad | PR que lo cierra |
|--------|-----------|-----------------|
| `serializeWorkspace` leakea encrypted fields al frontend | 🔴 Alto | PR-01 |
| `/api/reminders/send` abierta si CRON_SECRET no está configurado | 🔴 Alto | PR-01 |
| MercadoPago webhook sin verificación de firma | 🔴 Alto | PR-01 (agregar header check básico) |
| OAuth Google/Microsoft start sin verificar ownership | 🟡 Medio | Documentar / PR futuro |
| Phone router con `contains` sin orden determinístico | 🟡 Medio | PR-04 |
| LLM ejecuta acciones destructivas sin confirmación suficiente | 🟡 Medio | PR-05 |
| Costo OpenAI sin rate limiting | 🟡 Medio | PR-05 |
| 0 tests | 🟡 Medio | PR-09 |

---

## F) Quick wins (< 2 horas cada uno)

1. Borrar 7 componentes huérfanos → -2,100 líneas
2. Borrar `/api/reminders/send` → cierra riesgo de seguridad
3. Renombrar `gemini.ts` → `bill-extractor.ts` + `npm uninstall @google/generative-ai`
4. Fix `gmail-api.ts` `extracted.amount` → `extracted.totalAmount`
5. Fix `updateClaimTool` `workspace.userId` → `workspace.ownerId`
6. Fix `serializeWorkspace` — usar select explícito en vez de spread
7. Borrar código muerto en `dashboard/[workspaceId]/page.tsx`
8. Agregar verificación básica en mercadopago webhook

---

## Resumen ejecutivo

| Categoría | Estado |
|-----------|--------|
| Dominio / modelo | ✅ Sólido — pequeñas correcciones |
| Channel behavior | ✅ Correcto — falta simplificar dashboard |
| AI contract | ⚠️ Parcial — clasificación y ejecución mezcladas |
| Service layer | ❌ No existe — es el gap más grande |
| ActivityLog | ❌ No existe — obligatorio según spec |
| State machines | ⚠️ Existen como enum pero no como lógica centralizada |
| Seguridad | ⚠️ 3 issues activos de prioridad alta |
| Código muerto | ❌ ~2,400 líneas — limpiar en PR-01 |
| Tests | ❌ Cero — agregar en PR-09 |
