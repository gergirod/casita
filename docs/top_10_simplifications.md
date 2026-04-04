# Top 10 Simplificaciones — Para hacer ya

Ordenadas por impacto / esfuerzo. Arriba = hacer primero.

---

## 1. Borrar código muerto (~2,400 líneas)

**Qué:** Eliminar componentes huérfanos que no se importan en ningún lado.

**Archivos a borrar:**
- `components/dashboard-client.tsx` (540 líneas)
- `components/monthly-obligations-view.tsx` (714 líneas)
- `components/bill-upload-form.tsx` (~400 líneas)
- `components/obligation-verifier.tsx` (~80 líneas)
- `components/contract-manager.tsx` (~60 líneas)
- `lib/n8n-templates.ts` (257 líneas)
- `docs/n8n-whatsapp-bot-mvp.workflow.json`
- Código muerto en `app/dashboard/[workspaceId]/page.tsx` (~230 líneas de Section, SectionEmpty, ObligationRow, WhatsAppButton, formatAmount no usados)

**Impacto:** El codebase baja de ~8,500 a ~6,100 líneas. Menos confusión, menos mantenimiento.

**Esfuerzo:** 1 hora. Un PR.

---

## 2. Fix: serializeWorkspace leakea secrets al frontend

**Qué:** `lib/dashboard-data.ts` hace `{ ...workspace, properties: ... }` que incluye `emailEncryptedPassword`, `emailRefreshToken`, `mpAccessTokenEncrypted`, `n8nSecret`.

**Fix:** Usar `select` explícito en Prisma en vez de spread. Nunca enviar campos sensibles al cliente.

**Impacto:** Cierra un riesgo de seguridad alto.

**Esfuerzo:** 30 minutos.

---

## 3. Borrar `/api/reminders/send` (ruta abierta)

**Qué:** Esta ruta no tiene referencias en el código y está abierta si `CRON_SECRET` no está configurado. Fue superseded por las rutas cron.

**Fix:** Borrar el archivo.

**Impacto:** Elimina riesgo de seguridad.

**Esfuerzo:** 5 minutos.

---

## 4. Renombrar gemini.ts → bill-extractor.ts

**Qué:** El archivo usa OpenAI, no Gemini. `isGeminiConfigured()` es un alias deprecated. `@google/generative-ai` está instalado sin usarse.

**Fix:** Renombrar archivo. Actualizar imports. `npm uninstall @google/generative-ai`.

**Impacto:** Claridad del codebase. Reduce confusión.

**Esfuerzo:** 30 minutos.

---

## 5. Sacar IMAP y Outlook de scope activo

**Qué:** Tres implementaciones paralelas de email ingestion: IMAP (687 líneas), Gmail API (255 líneas), Outlook API. El ICP usa Gmail.

**Fix:** No borrar aún, pero sacar del flujo activo. El owner-agent solo ofrece Gmail OAuth. La UI de IMAP se oculta o simplifica. Outlook se documenta como "futuro".

**Impacto:** ~900 líneas menos de superficie activa. Menos bugs. Menos soporte.

**Esfuerzo:** 2-3 horas.

---

## 6. Extraer tools del owner-agent a service functions

**Qué:** `owner-agent.ts` tiene 1,601 líneas. Cada tool implementa lógica de negocio inline (queries Prisma, validaciones, envío de notificaciones).

**Fix:** Crear `lib/services/obligations.ts`, `lib/services/reminders.ts`, etc. Cada tool del agente llama al servicio correspondiente. El agente solo orquesta.

**Impacto:** Código testeable, reutilizable (dashboard + bot usan mismos servicios), agente más simple.

**Esfuerzo:** 1-2 días.

---

## 7. Fix: Gmail API usa extracted.amount en vez de extracted.totalAmount

**Qué:** `lib/gmail-api.ts` línea ~150 asigna `amount = extracted.amount`, pero `BillExtraction` define `totalAmount`.

**Fix:** Cambiar a `extracted.totalAmount`.

**Impacto:** Los montos de facturas ingeridas por Gmail estarían incorrectos (probablemente `undefined`).

**Esfuerzo:** 5 minutos.

---

## 8. Agregar ActivityLog básico

**Qué:** No hay registro de quién hizo qué, cuándo, por qué canal. Si algo sale mal, no hay audit trail.

**Fix:** Crear tabla `ActivityLog` con: workspaceId, unitId, actorType, action, metadata, channel, createdAt. Agregar writes en las state transitions clave (obligation status changes, proof upload, reminder sent).

**Impacto:** Trazabilidad. Debugging. Confianza.

**Esfuerzo:** 1 día.

---

## 9. Postergar contract RAG

**Qué:** 166 líneas en `contract-reader.ts`, tools en ambos agentes, llamadas a GPT-5.4 para leer PDFs. Es un feature de baja frecuencia y alto costo.

**Fix:** Remover la tool `ask_contract` de ambos agentes. Si preguntan por el contrato, responder con link al PDF. Mantener el código pero no exponerlo.

**Impacto:** Reduce costo de OpenAI. Reduce complejidad de los agentes. Foco en el wedge.

**Esfuerzo:** 30 minutos.

---

## 10. Dashboard = read-only (dejar de construir forms)

**Qué:** Se están construyendo dos interfaces de write completas en paralelo (dashboard forms + bot tools). Eso duplica esfuerzo y crea inconsistencias.

**Fix:** El dashboard muestra estado (obligations, cobros, historial, métricas). Todo write pasa por WhatsApp o por el onboarding inicial. El `unit-editor.tsx` (1,800+ líneas) se simplifica radicalmente a una vista de estado.

**Impacto:** Reduce ~1,000+ líneas de componentes. Foco en WhatsApp-native. Una sola fuente de escritura.

**Esfuerzo:** Gradual, 1-2 semanas para transicionar.
