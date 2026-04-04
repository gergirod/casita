# PR-13 — Beta Ops Runbook

> **Objetivo:** documentar el runbook mínimo para operar la beta cerrada de Casita sin caos.
> Principalmente documental. Código solo si hay un blocker muy pequeño y explícito.

---

## Entregables

- `docs/beta-runbook.md` — runbook operativo completo

---

## Vacíos detectados (pre-implementación)

### Gap 1 — Reminder solo funciona con email
`send-reminders` filtra `tenantContact.email: {not: null}`.
Inquilinos sin email (solo WhatsApp) no reciben recordatorios automáticos.
→ Documentar en runbook, caso 1.

### Gap 2 — Obligations manuales sin template no reciben reminders
`send-reminders` filtra `templateId: {not: null}`.
Cobros puntuales creados sin template (ej: penalidad, ajuste) no entran en el cron.
→ Documentar en runbook, caso 1.

### Gap 3 — Bug en owner-alerts: solo procesa units[0]
```ts
const unit = ws.properties[0]?.units[0];
```
Si hay múltiples unidades en un workspace, solo la primera recibe alertas.
Menor para beta single-unit, pero bug real.
→ Documentar como limitación conocida. Fix en backlog.

### Gap 4 — Timing rígido en cron, sin retry
Si Vercel tiene downtime el día exacto del reminder, se pierde para siempre.
→ Documentar procedimiento manual de re-envío en runbook.

### Gap 5 — Sin UI para forzar reminder
El owner no puede disparar un reminder desde el dashboard.
Requiere curl o mensaje al bot.
→ Documentar comando curl en runbook.

### Gap 6 — Extracción AI de boletas falla silenciosamente
Si `extractBillData` falla, la obligation queda con datos parciales sin notificación.
→ Documentar en runbook, caso 5.

### Gap 7 — Workspaces pre-PR-02 sin ActivityLog
Métricas M2, M3, M4 muestran cero para workspaces viejos.
→ Documentar como limitación conocida de métricas.

---

## Qué bloquea beta vs qué no

### Blocker real
- Inquilino sin email que depende de WA para reminders → workaround: owner manda via bot

### No bloquea
- Bug units[0] en owner-alerts → beta single-unit no afectada
- Sin retry en cron → workaround manual documentado
- Sin UI para forzar reminder → workaround via bot/curl
- ActivityLog vacío en workspaces viejos → limitación de métricas, no de operación

---

## Reglas de implementación

- Solo `docs/beta-runbook.md` — no tocar schema, UI, rutas, agentes
- Comandos deben ser copiables y exactos
- Mensajes de soporte en español, tono claro y directo
- Clasificar siempre: "¿esto bloquea el ciclo de pago?" sí/no
