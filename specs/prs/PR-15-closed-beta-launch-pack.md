# PR-15 — Closed Beta Launch Pack

> **Objetivo:** dejar listo el paquete mínimo para invitar 3 a 5 owners reales a probar Casita esta semana.
> Principalmente documental. Sin código, sin features, sin refactors.
> Fecha: 4 de abril de 2026.

---

## Entregables

- `docs/beta-launch-pack.md` — documento operativo completo para los founders

---

## Veredicto del smoke test (PR-14A)

El sistema entra a beta cerrada en estado: **BETA-READY WITH MANUAL SUPPORT**

- TypeScript: 0 errores
- Crons: funcionando (send-reminders, owner-alerts, process-reminders)
- Portal `/t/[token]`: HTTP 200, obligation y datos visibles
- ActivityLog: vacío en workspace de prueba (pre-PR-02) — no afecta operación
- Único hallazgo: `paymentMethod = "mp_link"` con `paymentMpLink = null` en workspace de prueba (issue de configuración, no de código)
- Blockers de código antes de beta: 0

---

## Reglas de este PR

- No agregar features nuevas
- No tocar arquitectura ni schema
- No hacer refactors
- Foco absoluto en salir a validar ya
