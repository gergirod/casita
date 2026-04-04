# Ideal V1 Scope — Shippeable en 3-4 semanas

## Producto
**Casita V1: El cobrador automático por WhatsApp**

Un propietario configura su casita en 5 minutos. El sistema cobra, recuerda, rastrea y avisa — todo por WhatsApp. El owner solo verifica pagos.

## One-liner
> "Dejá de perseguir inquilinos. Casita hace el seguimiento por vos."

---

## Qué incluye V1

### 1. Onboarding web (ya existe, pulir)
- Landing page con login magic link ✅
- Wizard: nombre de casita → datos del inquilino → alquiler + cobros → bienvenida ✅
- Upload de contrato (opcional) ✅
- Onboarding completo en < 5 minutos

### 2. Recordatorios automáticos (ya existe)
- Cron diario genera obligations y envía recordatorios ✅
- Email + WhatsApp según configuración del template ✅
- Dedup de envíos ✅

### 3. Bot owner por WhatsApp (refactorear)
**Tools V1 (reducir de 25 a 10):**
- `get_overview` — Ver casitas y estado general
- `get_obligations` — Listar cobros del mes
- `verify_payment` — Confirmar pago
- `upload_bill` — Subir boleta (owner manda foto → Vision → obligation)
- `send_reminder` — Enviar recordatorio manual
- `create_charge` — Crear cobro puntual
- `get_tenant_info` — Ver datos del inquilino
- `update_rent` — Actualizar monto de alquiler
- `get_claims` — Ver reclamos
- `update_claim` — Responder reclamo

**Sacar de V1:** create_casita, delete_casita, start_rental, end_rental, ask_contract, connect_email, fetch_bills_email, schedule_reminder, send_welcome (estas se hacen por web).

### 4. Bot tenant por WhatsApp (ya existe, limpiar)
**Tools V1:**
- `get_my_obligations` — Ver qué debo
- `upload_proof` — Subir comprobante
- `get_payment_info` — Ver CBU/alias
- `create_claim` — Registrar reclamo

### 5. Portal del inquilino (ya existe)
- `/t/[token]` — Ver obligaciones, subir comprobante ✅
- Sin login, capability URL ✅

### 6. Dashboard owner (simplificar a read-only)
- Estado de cobros del mes actual
- Lista de casitas con status badges
- Historial básico
- Configuración (cambiar datos, terminar alquiler)
- **Sin forms de creación de obligations** (eso va por WhatsApp)

### 7. Follow-up automático de mora (nuevo)
- Si obligation está overdue > 3 días → re-enviar recordatorio al inquilino
- Si overdue > 7 días → notificar al owner "Tu inquilino de [casita] lleva 7 días de mora en [cobro]"
- Máximo 3 follow-ups automáticos

### 8. ActivityLog básico (nuevo)
- Cada state transition queda registrada
- Quién, qué, cuándo, por qué canal
- Visible en dashboard como timeline simple

---

## Qué NO incluye V1

| Feature | Estado | Razón |
|---------|--------|-------|
| Email ingestion (Gmail/IMAP/Outlook) | Postergar | El owner manda la boleta por WhatsApp en V1 |
| Contract RAG | Postergar | Edge use case |
| MercadoPago | Postergar | CBU/alias es suficiente para Argentina |
| n8n | Borrar | Superseded por agentes in-app |
| Claims workflow complejo | Postergar | Registrar + notificar es suficiente |
| Multi-role | Postergar | Solo owners en V1 |
| Analytics/métricas | Postergar | Conteo básico en dashboard es suficiente |
| CSV export | Postergar | Nadie lo pidió |
| Pricing/billing | Postergar | Gratuito en V1, cobrar después |

---

## Métricas de éxito V1

| Métrica | Target |
|---------|--------|
| Onboarding completion rate | > 70% |
| Owner activo (usa WhatsApp al menos 1x/semana) | > 50% de registrados |
| Ciclo completo cobro→pago→verificación | > 1 ciclo por owner |
| Inquilino sube comprobante sin ayuda | > 30% |
| Tiempo owner para gestionar mes completo | < 10 minutos |
| NPS pregunta: "¿Casita te ahorra tiempo persiguiendo pagos?" | > 8 |

---

## Stack V1

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16, React 19 |
| Backend | Next.js API routes |
| DB | PostgreSQL (Prisma) |
| Auth | Supabase Auth (magic link) |
| Storage | Supabase Storage |
| AI | OpenAI GPT-5.4-mini (clasificación + composición) |
| WhatsApp | Twilio (production, no sandbox) |
| Email | Resend |
| Cron | Vercel Cron |
| Deploy | Vercel |

---

## Estructura de archivos V1 (target)

```
lib/
  services/            ← NUEVO: lógica de negocio extraída
    obligations.ts     ← state transitions, CRUD
    reminders.ts       ← envío de recordatorios
    tenants.ts         ← lookup, info
    claims.ts          ← crear, actualizar
    bills.ts           ← upload, extract
  owner-agent.ts       ← clasificador + dispatcher (slim)
  whatsapp-agent.ts    ← clasificador + dispatcher (slim)
  phone-router.ts      ← routing por teléfono
  bill-extractor.ts    ← OpenAI Vision extraction (renombrado de gemini.ts)
  whatsapp.ts          ← Twilio adapter
  email.ts             ← Resend adapter
  auth.ts              ← Supabase auth helpers
  storage.ts           ← Supabase storage adapter
  encrypt.ts           ← AES encryption
  prisma.ts            ← Prisma client
```

---

## Plan de ejecución (3-4 semanas)

### Semana 1: Limpieza + seguridad
- [ ] Borrar código muerto (2,400 líneas)
- [ ] Fix serializeWorkspace secrets leak
- [ ] Borrar /api/reminders/send
- [ ] Renombrar gemini.ts → bill-extractor.ts
- [ ] Fix gmail-api.ts amount bug
- [ ] Desinstalar @google/generative-ai
- [ ] Crear tabla ActivityLog + writes básicos
- [ ] Twilio production setup

### Semana 2: Refactor agentes
- [ ] Crear lib/services/ con lógica extraída
- [ ] Reducir owner-agent tools de 25 a 10
- [ ] Simplificar whatsapp-agent
- [ ] Tests para services y phone-router

### Semana 3: Follow-up automático + dashboard slim
- [ ] Cron de follow-up de mora (3 días, 7 días)
- [ ] Dashboard → read-only (sacar forms, mostrar ActivityLog como timeline)
- [ ] Pulir mensajes del bot (tono, formato, edge cases)

### Semana 4: Polish + ship
- [ ] E2E test manual: onboarding → cobro → pago → verificación completo
- [ ] Landing page pulida
- [ ] Demo video 2 minutos
- [ ] Deploy a producción
- [ ] 3-5 owners beta reales

---

## Definición de "done" para V1

Un propietario puede:
1. ✅ Crear su casita en 5 minutos por web
2. ✅ Recibir un "Hola" del bot por WhatsApp
3. ✅ Preguntarle al bot "¿cómo están mis cobros?"
4. ✅ Mandarle una foto de la boleta de gas y que el bot la procese
5. ✅ Su inquilino recibe recordatorio automático
6. ✅ Su inquilino sube comprobante por WhatsApp o portal
7. ✅ El owner recibe notificación de comprobante
8. ✅ El owner verifica el pago por WhatsApp ("verificar pago de alquiler")
9. ✅ Si el inquilino no paga en 3 días, recibe follow-up automático
10. ✅ El owner puede ver todo el estado en un dashboard simple

Si estos 10 puntos funcionan sin intervención del desarrollador, V1 está lista.
