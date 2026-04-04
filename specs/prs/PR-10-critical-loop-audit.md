# PR-10 — Critical Loop Audit

> **Objetivo:** determinar si el MVP está listo para una beta cerrada sin construir nada más.
>
> Fecha de auditoría: abril 2026  
> Base de código analizada: PR-01 → PR-09 completos

---

## A. Loop Status Matrix

El loop crítico completo:

```
Onboarding → Obligation → Reminder → Pago/Comprobante → Verificación → Overdue → Dashboard
```

---

### Paso 1 — Onboarding / Create Workspace

| Campo | Valor |
|---|---|
| **Estado** | ✅ Exists |
| **Evidencia** | `app/onboarding/page.tsx` + `components/onboarding-wizard.tsx` (web). `lib/services/rentals.ts` → `createWorkspace`, `registerTenant` (WhatsApp bot). API: `POST /api/workspaces`, `POST /api/workspaces/[id]/new-rental`. |
| **Qué hace** | Crea workspace + property + unit + tenantContact. Genera `tenantToken` único. Permite nombre, dirección, moneda, inquilino, fechas del contrato. |
| **Riesgo** | El wizard web (`onboarding-wizard.tsx`) y el bot no están sincronizados en features: el wizard web no configura `reminderDays`, `reminderChannel` ni templates de cobro — el owner tiene que ir al dashboard después. Brecha UX pero no blocker. |
| **Blocker para beta** | ❌ No |

---

### Paso 2 — Generación de Obligation

| Campo | Valor |
|---|---|
| **Estado** | ✅ Exists |
| **Evidencia** | `app/api/cron/send-reminders/route.ts` → Step 1: genera obligation de alquiler mensual por template (`type: "rent"`) de forma idempotente. `lib/services/obligations.ts` → `createManualObligation`, `createRecurringObligation`. `app/api/obligation-templates/[id]/monthly-bill/route.ts` → genera obligation para servicios variables cuando se sube la boleta. |
| **Qué hace** | **Alquiler:** el cron diario (11:00 UTC) crea la obligation del mes si no existe. **Servicios/expensas:** se generan al subir la boleta (manual o por email). **Cobros puntuales:** `POST /api/obligations/manual`. |
| **Riesgo** | El cron solo genera obligations de `type: "rent"`. Servicios variables (expensas, luz, gas) no se auto-generan — requieren que el owner suba la boleta manualmente cada mes. Esto es por diseño (no hay monto hasta tener la boleta), pero puede ser friction en beta. |
| **Blocker para beta** | ❌ No — el comportamiento es correcto por diseño |

---

### Paso 3 — Reminder al Inquilino

| Campo | Valor |
|---|---|
| **Estado** | ✅ Exists (con gap importante en canal) |
| **Evidencia** | Dos crons activos en `vercel.json`: `send-reminders` (11:00 UTC diario) y `process-reminders` (cada 15 min). El primero envía email usando Resend (`lib/email.ts`) a la dirección del `tenantContact`. El segundo procesa `ScheduledReminder` y puede enviar email + WhatsApp. `owner-alerts` (12:00 UTC diario) notifica al owner por WhatsApp si hay vencimientos próximos. |
| **Qué hace** | `send-reminders`: **X días antes** del vencimiento (configurable por template, default 3), **el día de vencimiento**, y **5 días después** si sigue sin verificar. Solo corre si el tenant tiene email. `process-reminders`: procesa recordatorios manuales programados (vía bot o dashboard). |
| **Gap crítico detectado** | `send-reminders` solo funciona si el `tenantContact.email` no es null (línea 71: `tenantContact: { email: { not: null } }`). Si el inquilino solo tiene WhatsApp, **no recibe ningún reminder automático del cron diario**. El canal WhatsApp en `send-reminders` no está implementado — solo envía email. |
| **Riesgo** | En LATAM, muchos inquilinos no tienen email registrado o prefieren WhatsApp. Si el owner configuró solo WhatsApp para el inquilino, los reminders automáticos del cron no llegan. |
| **Blocker para beta** | ⚠️ **Parcial** — blocker si los beta users tienen inquilinos sin email. No blocker si se limita la beta a casos con email del inquilino. |

---

### Paso 4 — Pago o Subida de Comprobante

| Campo | Valor |
|---|---|
| **Estado** | ✅ Exists |
| **Evidencia** | Portal del inquilino: `app/t/[token]/page.tsx` + `components/tenant-portal.tsx`. Upload endpoint: `POST /api/tenant/[token]/proof`. Service: `markProofReceived` en `lib/services/obligations.ts`. WhatsApp: `app/api/webhooks/twilio-whatsapp/route.ts` → el tenant puede mandar comprobante por WhatsApp (media download + `markProofReceived`). |
| **Qué hace** | El inquilino accede al portal con link único (`/t/[token]`). Ve sus obligaciones pendientes, puede ver la boleta si existe (`billUrl`), y puede subir foto/PDF del comprobante. Si tiene `paymentLinkUrl` (MercadoPago), ve el botón "1) Pagar ahora" antes del "2) Subir comprobante". |
| **Riesgo** | El link del portal (`tenantToken`) es estático por unidad — no cambia aunque termine el alquiler. Una vez que el inquilino tiene el link, sigue viendo el portal aunque el alquiler haya terminado. Se mitiga con `endRental` que marca `isActive: false` y el portal mostraría sin obligaciones activas. No es un blocker de seguridad grave para beta. |
| **Blocker para beta** | ❌ No |

---

### Paso 5 — Verificación por Owner

| Campo | Valor |
|---|---|
| **Estado** | ✅ Exists |
| **Evidencia** | `lib/services/obligations.ts` → `verifyPayment` (owner manual), `verifyPaymentByExternalRef` (webhook MercadoPago). API: `PATCH /api/obligations/[id]/status` (usa `transitionObligationStatus` con state machine). WhatsApp bot: tool `verify_payment` llama `verifyPayment`. Dashboard: `UnitEditor` muestra badge "Comprobante subido" con link al archivo — el owner hace click en "Verificar" que llama el PATCH de status. |
| **Qué hace** | Owner ve la obligación en `proof_uploaded` en el dashboard, abre el comprobante, llama `PATCH` con `status: "verified"`. O confirma por WhatsApp al bot. MercadoPago webhook auto-verifica si el pago llega. |
| **Gap detectado** | **El dashboard no tiene un botón explícito de "Verificar pago" visible** en el UnitEditor para obligaciones en estado `proof_uploaded`. El owner ve el badge "Comprobante subido" y el link "Ver boleta ↗" pero no hay un CTA claro de "✓ Verificar" inline. La verificación manual desde el dashboard requiere que el owner sepa hacer el PATCH por otro medio (bot o API). |
| **Riesgo** | El flujo de verificación desde la web no tiene CTA claro. Un beta user que no use WhatsApp va a quedar bloqueado para cerrar el ciclo de pago visualmente. |
| **Blocker para beta** | ⚠️ **Sí** — si el owner no usa el bot, no puede verificar pagos desde el dashboard. Este es el gap operativo más crítico. |

---

### Paso 6 — Overdue / Follow-up

| Campo | Valor |
|---|---|
| **Estado** | ⚠️ Partial |
| **Evidencia** | `send-reminders/route.ts` línea 134: `daysUntilDue === -5` → envía email overdue + marca `overdue`. Línea 142: `daysUntilDue < 0 && status === "pending"` → marca `overdue` sin email. `owner-alerts/route.ts`: alerta al owner a los -2 días. `obligation-state-machine.ts`: `CRON_OVERDUE_FROM` define estados válidos para marcar overdue. |
| **Comportamiento real** | **Tenant:** 1 email overdue a los -5 días (si tiene email). No más follow-ups después de eso. **Owner:** WhatsApp a los -2 días preguntando qué hacer (si tiene `ownerPhone` configurado). |
| **Gap vs. spec del usuario** | El usuario mencionó "reminder si pasan 3 días, aviso al owner si pasan 7 días, máximo 3 follow-ups". Lo que existe es: -5 días → 1 email al tenant, -2 días → 1 WhatsApp al owner. No hay: lógica de "máximo N follow-ups", conteo de intentos, ni escalada progresiva. |
| **Riesgo** | El overdue es funcional para beta: el tenant recibe un aviso y el owner recibe una alerta. El sistema no hace follow-up silencioso indefinido. Lo que falta es la escalada estructurada (3 intentos, etc.) — esto es una feature de refinamiento post-beta, no un blocker. |
| **Blocker para beta** | ❌ No — el comportamiento actual es suficiente para beta cerrada |

---

### Paso 7 — Visibilidad en Dashboard / Mission Control

| Campo | Valor |
|---|---|
| **Estado** | ✅ Exists (mejorado en PR-09) |
| **Evidencia** | `/dashboard`: cards por workspace con counters (vencidas, a verificar, pendientes, verificadas) + badge de estado (En orden / Requiere atención / X vencidas). `/dashboard/[workspaceId]`: header con inquilino, moneda, fecha de vencimiento de contrato, focus text contextual, status badges. `ClaimsPanel`: reclamos activos con estados. `ActivityFeed` (PR-09): historial de los últimos 15 eventos. |
| **Gap detectado** | No hay una vista "pending proofs queue" consolidada cross-workspace (ver todos los comprobantes pendientes de verificación en todas las casitas a la vez). El owner tiene que entrar casita por casita. |
| **Riesgo** | Para beta cerrada con pocos owners (2-5 casitas cada uno), entrar casita por casita es viable. No es blocker. |
| **Blocker para beta** | ❌ No |

---

## B. Payment Path Audit

### ¿Cómo paga el inquilino hoy?

**Opción 1: MercadoPago (link/QR)**
- El owner configura sus credenciales MP en el workspace (`mpEnabled`, `mpAccessTokenEncrypted`)
- El owner genera el link para una obligation específica: `POST /api/obligations/[id]/payment-link`
- El link se guarda en `obligation.paymentLinkUrl`
- El portal del inquilino muestra el botón "1) Pagar ahora" si `paymentLinkUrl` existe
- El webhook MP (`/api/webhooks/mercadopago`) auto-verifica la obligation al recibir el pago
- **Estado:** ✅ funcional end-to-end

**Opción 2: CBU / Alias (manual)**
- El owner configura `paymentMethod: "cbu"`, `paymentCbu`, `paymentName` en el template via `UnitEditor` (edit mode)
- Esta info queda en el template pero **no se muestra al inquilino en el portal** (`tenant-portal.tsx` no lee ni muestra `paymentCbu`)
- El inquilino tiene que haber acordado el CBU por WhatsApp/email fuera del sistema
- Tras pagar, sube comprobante al portal
- **Estado:** ⚠️ El CBU está en la DB pero es invisible para el inquilino en el portal — **gap de UX**

**Opción 3: WhatsApp directo**
- El inquilino le manda el comprobante al owner por WhatsApp
- El bot de tenant procesa la imagen y llama `markProofReceived`
- **Estado:** ✅ funcional

**Resumen del gap de CBU:** El campo `paymentCbu` existe en el schema y en el template, pero `tenant-portal.tsx` no lo lee ni lo muestra. El inquilino no sabe a qué CBU transferir a menos que el owner se lo diga por fuera del sistema.

---

## C. Overdue Follow-up Audit

### Comportamiento real hoy (evidencia del código):

| Evento | Cuándo | Qué pasa | Canal |
|---|---|---|---|
| `send-reminders` aviso previo | `daysUntilDue === reminderDays` (default: 3 días antes) | Email al tenant: "te vence en X días" | Email (requiere email del tenant) |
| `send-reminders` día de vencimiento | `daysUntilDue === 0` | Email al tenant: "vence hoy" | Email |
| `owner-alerts` alerta temprana | `diffDays === 3` | WhatsApp al owner: "vence en 3 días, ¿mando recordatorio?" | WhatsApp (requiere `ownerPhone`) |
| `owner-alerts` día del vencimiento | `diffDays === 0` | WhatsApp al owner: "vence hoy, sin comprobante" | WhatsApp |
| `owner-alerts` follow-up owner | `diffDays === -2` | WhatsApp al owner: "venció hace 2 días, ¿qué hacemos?" | WhatsApp |
| `send-reminders` overdue email | `daysUntilDue === -5` | Email al tenant: "vencida" + marca `overdue` | Email |
| `send-reminders` mark overdue | `daysUntilDue < 0 && status === "pending"` | Solo marca `overdue`, sin email | — |

**Lo que NO existe:**
- Conteo de intentos de follow-up (no hay límite de 3)
- Escalada progresiva (el overdue email se manda exactamente 1 vez, el día -5)
- Pausa automática si el tenant ya pagó y está en `proof_uploaded`
- Follow-up al owner después de -7 días

**Veredicto:** El overdue básico funciona. No hay riesgo de spam porque los eventos están hardcodeados a días exactos (-2, -5). Para beta cerrada es suficiente.

---

## D. Recomendación Final

### Respuesta binaria:

**❌ No se puede salir a beta ya — faltan 2 blockers concretos.**

---

### Blockers exactos

#### Blocker 1 (crítico): No hay CTA de "Verificar pago" en el dashboard

**Ruta afectada:** `UnitEditor` en `/dashboard/[workspaceId]`

**Síntoma:** Cuando el inquilino sube un comprobante, la obligation pasa a `proof_uploaded`. En el dashboard, el owner ve el badge "Comprobante subido" con link "Ver boleta ↗". No hay un botón visible de "✓ Confirmar pago" ni "Verificar" en esa fila.

**Impacto real:** El owner no puede cerrar el ciclo desde la web. La única forma de verificar es:
- Por WhatsApp al bot ("verificá el pago de X")
- O directamente haciendo PATCH a la API

Para un beta user que no sea técnico y no tenga el bot configurado: **loop roto**.

**Fix mínimo:** Un botón "Verificar pago" visible en la fila de la obligation cuando `status === "proof_uploaded"`, que llame `PATCH /api/obligations/[id]/status` con `{ status: "verified" }`.

---

#### Blocker 2 (moderado): El CBU/Alias no llega al inquilino

**Ruta afectada:** `tenant-portal.tsx` + `app/t/[token]/page.tsx`

**Síntoma:** El owner configura el CBU de cobro en el template. El inquilino abre el portal y no ve a dónde transferir. Tiene que preguntar por fuera del sistema.

**Impacto real:** El flujo de pago por transferencia (que es el 80% de los pagos en Argentina) requiere que el tenant tenga el CBU memorizado o lo busque en un chat de WhatsApp anterior. El portal no le da esa información.

**Fix mínimo:** Mostrar el CBU/Alias del template en la tarjeta de la obligation en el portal del inquilino, cuando `paymentMethod === "cbu"` y `paymentCbu` está configurado. No requiere cambio de schema — el dato ya existe. Solo hay que pasarlo como prop al `TenantPortal` y mostrarlo.

---

### Items que NO son blockers (para backlog)

| Item | Por qué no bloquea beta |
|---|---|
| Reminders sin WhatsApp del tenant | Aceptable si la beta se limita a inquilinos con email. Se puede pedir email en el onboarding. |
| Follow-up estructurado (3 intentos) | El sistema ya previene spam con días exactos. Es refinamiento post-beta. |
| Cross-workspace pending proofs queue | Con 2-5 casitas por owner es manejable entrando casita por casita. |
| Onboarding no configura templates | El owner completa eso en el dashboard. Friction aceptable para beta. |

---

### Estimación del esfuerzo de los blockers

| Blocker | Archivos a tocar | Esfuerzo estimado |
|---|---|---|
| Botón "Verificar pago" en UnitEditor | `components/unit-editor.tsx` (solo el strip de status de la obligation) | ~30 líneas — bajo riesgo, no toca el wizard ni los templates |
| CBU visible en portal del inquilino | `app/t/[token]/page.tsx` (query), `components/tenant-portal.tsx` (render) | ~20 líneas — solo lectura, cero escritura |

Ambos deberían resolverse en un solo PR pequeño y de bajo riesgo.
