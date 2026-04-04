# PR-14 — End-to-End Smoke Test

> **Objetivo:** validar el loop crítico completo antes de activar 3 owners reales.
> Sin nuevas features. Sin refactors. Solo ejecución honesta del happy path.

---

## Entregables

- `docs/smoke-test.md` — checklist ejecutable completa con variante email y sin-email

---

## Precondiciones para ejecutar el smoke test

- App deployada en Vercel (o dev server local estable)
- Variables de entorno completas (ver `docs/deploy.md`)
- Twilio sandbox activo con número de prueba registrado para ambos founders
- Resend configurado y verificado (`RESEND_API_KEY` + `EMAIL_FROM`)
- Supabase DB conectada y migraciones al día
- `CRON_SECRET` configurado en Vercel env
- 2 founders disponibles: **Founder A = owner**, **Founder B = tenant**

---

## Roles del smoke test

| Rol | Quién | Qué hace |
|---|---|---|
| Owner | Founder A | Crea la casita, configura el cobro, verifica el pago |
| Tenant | Founder B | Abre el portal, simula que no sabe nada, sube el comprobante |
| System/Founder ops | Cualquiera | Dispara crons manualmente, verifica logs, documenta fricciones |

---

## Gap pre-conocidos que afectan el smoke test

1. **Reminder automático solo para tenants con email** — sin email, no hay reminder del cron diario
2. **Cron se ejecuta a las 11 UTC** — para un smoke test que no quiere esperar, hay que dispararlo manualmente
3. **`verified` es estado terminal** — si el smoke test va a ser repetible, cancelar/crear obligations de prueba con cuidado
4. **Notificación al owner cuando llega prueba de pago es solo por email** — no WhatsApp
5. **`owner-alerts` solo procesa `units[0]`** — no afecta el smoke test single-unit pero hay que saberlo

---

## Blockers detectados pre-smoke test

- Ninguno nuevo respecto de PR-10/11/13. Los 2 blockers de PR-10 fueron resueltos en PR-11.
- El sistema está en estado operable para beta con los workarounds del runbook (PR-13).
