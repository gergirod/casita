# Casita — E2E Smoke Test

> **PR-14** · Uso interno · Ejecutar antes de activar beta cerrada.
> 2 founders. Duración estimada: 45–60 minutos para el happy path completo.

---

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Paso superado |
| ❌ | Falla — documentar en §Bugs/fricciones |
| ⏭ | Paso automático (no requiere acción humana) |
| 🔧 | Requiere acción manual del founder |
| 👤 | Acción del owner (Founder A) |
| 🧑‍💼 | Acción del tenant (Founder B) |

---

## Precondiciones (verificar antes de empezar)

- [ ] App deployada y respondiendo (`https://TU-DOMINIO.vercel.app`)
- [ ] Twilio: Founder A y Founder B tienen sus números pre-registrados en el sandbox (`join [código]`)
- [ ] Resend: email de prueba configurado y verificado
- [ ] Vercel Crons: activos (Settings → Crons → 3 crons listados)
- [ ] Supabase: DB conectada, sin errores de migración
- [ ] `CRON_SECRET`: disponible para disparar manualmente
- [ ] Founder A tiene cuenta en el sistema (Supabase Auth)
- [ ] Browser limpio (sin sesión de owner anterior que contamine)

---

## VARIANTE A — Happy Path con Email

> Founder B tiene email configurado. El reminder llega automáticamente.

---

### PASO 1 — Crear workspace (casita)

**Quién:** 👤 Founder A (como owner)
**Método:** WhatsApp bot O dashboard

**Via bot:**
```
"creá una casita llamada Palermo 123"
```
**Via dashboard:**
- Ir a `https://TU-DOMINIO.vercel.app/dashboard`
- Click "Nueva casita" → ingresar nombre → guardar

**Expected result:**
- Workspace creado con nombre
- Dashboard muestra la casita en la lista
- ActivityLog registra `workspace.created` *(si está implementado — verificar)*

**Verificación:**
- [ ] Workspace aparece en `/dashboard`
- [ ] URL `/dashboard/[workspaceId]` accesible

**¿Bloquea beta si falla?** Sí — es el paso 0.

---

### PASO 2 — Configurar tenant y cobro de alquiler

**Quién:** 👤 Founder A
**Método:** dashboard → "Iniciar nuevo alquiler" o bot

**Via dashboard:**
1. Desde el workspace → "Iniciar nuevo alquiler"
2. Nombre del inquilino: `Tenant Beta 1`
3. Email: `email-de-prueba@founder-b.com` *(email real de Founder B)*
4. WhatsApp: `+549XXXXXXXXXX` *(número de Founder B con código de país)*
5. Guardar

**Agregar cobro recurrente (template de alquiler):**
- Dashboard → "Agregar cobro recurrente"
- Tipo: Alquiler
- Monto: `100000`
- Moneda: ARS
- Día de vencimiento: `[hoy + 5 días]` *(para que el reminder dispare pronto)*
- Días de aviso: `3`
- CBU/alias: `alias.prueba.casita`
- Titular: `Founder A`
- Guardar

**Expected result:**
- `TenantContact` creado con email + WhatsApp
- `ObligationTemplate` activo con tipo `rent`
- Dashboard muestra el cobro en el strip del mes actual

**Verificación:**
- [ ] El cobro aparece en el strip mensual del dashboard
- [ ] El template tiene CBU configurado
- [ ] El inquilino tiene email y WhatsApp

**¿Bloquea beta si falla?** Sí.

---

### PASO 3 — Generar obligation de alquiler

**Quién:** ⏭ Sistema (cron diario) O 🔧 Founder ops (trigger manual)

El cron `send-reminders` corre diariamente a las 11:00 UTC y genera la obligation del mes si no existe.

**Para el smoke test (sin esperar):**
```bash
curl -X GET "https://TU-DOMINIO.vercel.app/api/cron/send-reminders" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Respuesta esperada:
```json
{
  "ok": true,
  "rentObligationsCreated": 1,
  "sent": 0,
  "errors": 0
}
```

**Expected result:**
- `Obligation` creada con status `pending`
- Visible en el dashboard con monto y fecha de vencimiento

**Verificación:**
- [ ] Dashboard muestra la obligation con badge "Pendiente"
- [ ] `rentObligationsCreated: 1` en la respuesta del cron
- [ ] En Supabase: `SELECT * FROM "Obligation" WHERE status = 'pending'`

**Notas:**
- Si `rentObligationsCreated: 0` → la obligation ya existía de una ejecución anterior. OK.
- Si el template se creó después del día 1 del mes, el cron crea la obligation igual.

**¿Bloquea beta si falla?** Sí — sin obligation no hay ciclo.

---

### PASO 4 — Reminder enviado

**Quién:** ⏭ Sistema (cron diario)
**Cuándo:** exactamente `[fecha de vencimiento] - [reminderDays]` días

**Para el smoke test:** ajustar `dueDay` del template al día de hoy + 3, luego disparar el cron manualmente.

```bash
# Re-disparar el cron (idempotente)
curl -X GET "https://TU-DOMINIO.vercel.app/api/cron/send-reminders" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Respuesta esperada:
```json
{
  "sent": 1,
  "details": [{ "action": "due_soon_3d", "email": "email-de-prueba@founder-b.com" }]
}
```

**Expected result:**
- Founder B recibe un email de recordatorio
- Obligation status pasa a `reminded`
- ActivityLog registra `reminder.sent`
- Dashboard muestra badge "Recordado" (si el refresh ocurre)

**Verificación:**
- [ ] Founder B confirma recepción del email
- [ ] Asunto del email es claro y tiene el link del portal
- [ ] Status en DB: `reminded`
- [ ] ActivityLog tiene `reminder.sent` con `entityId = obligationId`

**Gaps conocidos:**
- Si Founder B no tiene email → el cron lo saltea silenciosamente (ver Variante B)
- El email llega desde el dominio de Resend — verificar que no caiga en spam

**¿Bloquea beta si falla?** No — el tenant puede pagar sin reminder. Pero es un blocker de experiencia.

---

### PASO 5 — Tenant entiende cómo pagar

**Quién:** 🧑‍💼 Founder B (como tenant)
**Método:** abrir el portal `/t/[token]`

El link llega en el email del paso 4. También accesible desde el dashboard (copiar link del tenant).

**Acciones de Founder B:**
1. Abrir el link del portal *(sin estar logueado en el sistema — browser incógnito)*
2. Leer la información de pago

**Expected result:**
- Portal muestra nombre del inquilino y nombre de la propiedad
- Obligation visible con monto y fecha de vencimiento
- **Bloque "Transferí a:"** visible con CBU/alias y titular *(PR-11)*
- Botón "Subir comprobante" visible

**Verificación:**
- [ ] Founder B confirma que ve el monto correcto
- [ ] Founder B confirma que ve el CBU/alias sin necesidad de preguntar
- [ ] Founder B confirma que entiende qué tiene que hacer sin instrucciones adicionales

**Test de confusión:** preguntarle a Founder B (sin darle contexto previo): "¿Cómo pagarías este cobro?" — si no lo sabe solo, hay un problema de UX.

**¿Bloquea beta si falla?** Sí — si el inquilino no entiende cómo pagar, el ciclo no cierra.

---

### PASO 6 — Tenant sube comprobante

**Quién:** 🧑‍💼 Founder B
**Método:** portal `/t/[token]` → botón "Subir comprobante"

**Acciones:**
1. Hacer una captura de pantalla o usar una imagen de prueba (ej: captura de un "pago" de prueba)
2. Click "Subir comprobante"
3. Seleccionar el archivo
4. Esperar confirmación

**Expected result:**
- Upload exitoso (< 5 segundos en condiciones normales)
- Pantalla muestra "Comprobante enviado. El propietario lo va a revisar enseguida."
- Obligation desaparece de la lista de pendientes del portal
- Founder A recibe email "Comprobante recibido" *(notificación al owner)*
- Obligation status en DB: `proof_uploaded`
- ActivityLog: `proof.uploaded` con `actorType = "tenant"`

**Verificación:**
- [ ] Founder B confirma mensaje de éxito en el portal
- [ ] Founder A confirma recepción de email de notificación
- [ ] Dashboard (Founder A) muestra badge "Comprobante subido"
- [ ] Dashboard muestra link "Ver comprobante ↗"
- [ ] ActivityLog tiene `proof.uploaded` con `actorType = "tenant"`

**Edge cases a probar:**
- [ ] Subir un PDF (no solo imagen)
- [ ] Subir una imagen grande (> 5MB) — verificar que no falle con timeout
- [ ] Subir desde mobile (browser de teléfono)

**¿Bloquea beta si falla?** Sí — es el paso más crítico del ciclo.

---

### PASO 7 — Owner verifica el pago

**Quién:** 👤 Founder A
**Método A:** Dashboard → botón "✓ Verificar pago" *(PR-11)*
**Método B:** WhatsApp bot → "verificá el pago de [nombre cobro]"

**Via dashboard (método principal):**
1. Ir al dashboard del workspace
2. Ver el strip mensual de la obligation
3. Confirmar: badge "Comprobante subido" + link "Ver comprobante ↗"
4. Click en "Ver comprobante ↗" y verificar que es el archivo correcto
5. Click en "✓ Verificar pago"
6. Esperar feedback (botón cambia a "Verificando…")
7. Dashboard se refresca

**Expected result:**
- Obligation status: `verified`
- Badge cambia a "Pagado" con color verde
- Botón "✓ Verificar pago" desaparece
- ActivityLog: `payment.verified` con `actorType = "owner"`, `channel = "dashboard"`

**Verificación:**
- [ ] Badge muestra "Pagado" en el strip
- [ ] Botón "✓ Verificar pago" ya no aparece
- [ ] ActivityLog tiene `payment.verified`
- [ ] Probar también via bot como método B: bot responde confirmación

**Timing:** la UI se refresca vía `router.refresh()` — si tarda más de 3 segundos, documentar como fricción.

**¿Bloquea beta si falla?** Sí — es el cierre del ciclo.

---

### PASO 8 — Overdue y follow-up (variante paralela)

> **Ejecutar en una obligation separada**, no en la obligation principal del smoke test.

**Setup:**
- Crear una segunda obligation con `dueDate = hace 5 días` vía bot:
  ```
  "creá un cobro de expensas por 50000 pesos con vencimiento [fecha de hace 5 días]"
  ```
- Re-disparar el cron:
  ```bash
  curl -X GET "https://TU-DOMINIO.vercel.app/api/cron/send-reminders" \
    -H "Authorization: Bearer TU_CRON_SECRET"
  ```

**Expected result:**
- Obligation pasa a `overdue`
- Founder B recibe email de "vencida"
- Owner-alerts (cron de 12 UTC) le avisa a Founder A si tiene `ownerPhone` configurado

**Verificación:**
- [ ] Status en DB: `overdue`
- [ ] Dashboard badge: "Vencida" (rojo)
- [ ] Founder B recibe email overdue
- [ ] Founder A recibe alerta en WhatsApp (si `ownerPhone` está configurado)
- [ ] ActivityLog: `obligation.updated` con `newStatus: "overdue"`

**¿Bloquea beta si falla?** No — operacionalmente el owner puede seguir el caso manualmente.

---

### PASO 9 — Dashboard refleja el estado final

**Quién:** 👤 Founder A
**Cuándo:** después del paso 7

**Verificación:**
- [ ] Strip mensual muestra badge verde "Pagado" para la obligation verificada
- [ ] La obligation overdue (paso 8) muestra badge rojo "Vencida"
- [ ] Contadores de status son correctos (no desincronizados)
- [ ] No hay obligations fantasma o en estado inconsistente
- [ ] Navegando entre meses (flecha anterior/siguiente), el estado se mantiene

**¿Bloquea beta si falla?** Sí — si el dashboard miente, el owner no puede confiar en el sistema.

---

### PASO 10 — Activity feed muestra el historial correcto

**Quién:** 👤 Founder A
**Dónde:** Dashboard → feed de actividad (parte inferior de la página)

**Expected result:**
El feed debe mostrar estos eventos en orden cronológico descendente:
1. `payment.verified` — Pago verificado (por owner, vía dashboard)
2. `proof.uploaded` — Comprobante recibido (por inquilino, vía portal)
3. `reminder.sent` — Recordatorio enviado (por sistema, vía cron)
4. Eventos de creación si los hay

**Verificación:**
- [ ] Feed no está vacío
- [ ] Labels son legibles en español y tienen sentido
- [ ] Sub-línea muestra actor y canal correctamente
- [ ] Timestamps son razonables (no fechas en 1970 ni futuras)
- [ ] Ningún evento muestra `undefined` o `null` visible

**¿Bloquea beta si falla?** No — es visibilidad, no operación.

---

## VARIANTE B — Sin email (solo WhatsApp)

> Founder B no tiene email configurado. Solo WhatsApp.

### Setup diferente al Paso 2
- Al crear el tenant: dejar email vacío, solo WhatsApp de Founder B
- El cobro se crea igual

### Dónde cambia el comportamiento

**Paso 4 (reminder):**
- El cron `send-reminders` **NO enviará** reminder automático (filtra por `email: {not: null}`)
- **Alternativa A:** Owner le pide al bot que mande el reminder:
  ```
  "mandá un recordatorio a Tenant Beta 1 sobre Alquiler"
  ```
  Esto usa `process-reminders` / `sendReminderToTenant` → sí envía WA si `channel = "whatsapp"` o `"both"`
- **Alternativa B:** El cron `owner-alerts` le avisa a Founder A que vence pronto, y Founder A decide mandar el reminder via bot

**Verificación variante B:**
- [ ] Founder B NO recibe email (confirmar que no llegó nada)
- [ ] Bot manda reminder por WhatsApp a Founder B cuando el owner lo pide
- [ ] Founder B recibe el WA con el link del portal
- [ ] El resto del flujo (paso 5 en adelante) es idéntico

**Pasos 5-10:** idénticos a Variante A.

**Nota importante:** el link del portal `/t/[token]` funciona igual sin email. El tenant puede abrir el browser, pegar el link y subir el comprobante aunque nunca haya recibido un email.

---

## Cómo ejecutar el smoke test con 2 founders

### Setup inicial (30 min antes)
```
Founder A:
1. Crear cuenta en https://TU-DOMINIO.vercel.app (si no tiene)
2. Unirse al sandbox de Twilio (si no lo hizo): mandar "join [código]" al número de Twilio
3. Tener listo el CRON_SECRET

Founder B:
1. Preparar un email de prueba real (puede ser un alias de Gmail)
2. Unirse al sandbox de Twilio con su número
3. Tener listo un archivo de imagen o PDF para simular comprobante
4. NO tener contexto previo del sistema — simular ser un inquilino real
```

### Ejecución (45-60 min)
```
Paso 1-2: Founder A configura (10 min)
Paso 3:   Founder ops dispara cron (2 min)
Paso 4:   Founder ops ajusta fecha + dispara cron, Founder B verifica email (5 min)
Paso 5:   Founder B abre el portal en browser incógnito (5 min) — TEST DE CONFUSIÓN
Paso 6:   Founder B sube comprobante (3 min)
Paso 7:   Founder A verifica desde dashboard (3 min)
Paso 8:   Founder ops ejecuta variante overdue en paralelo (5 min)
Paso 9-10: Ambos verifican estado y feed (5 min)
Variante B: Repetir pasos 4-7 sin email (15 min extra)
```

### Documentación durante el test
Usar esta plantilla para cada fricción:
```
Paso: [número]
Lo que esperaba: [descripción]
Lo que pasó: [descripción]
¿Bloquea beta?: sí / no
Workaround hoy: [descripción o N/A]
```

---

## Lista de bugs/fricciones a registrar

| # | Paso | Descripción | Bloquea beta | Workaround |
|---|---|---|---|---|
| _(completar durante el smoke test)_ | | | | |

---

## Criterios de veredicto

### Beta-ready ✅ si:
- Todos los pasos 1-7 y 9 pasan sin workaround crítico
- El test de confusión del Paso 5 pasa (Founder B entiende cómo pagar solo)
- La Variante B funciona con el workaround del bot (Founder A manda el reminder manual)
- No hay crashes, 500s ni pérdida de datos en ningún paso
- El ActivityLog refleja correctamente los eventos clave

### No beta-ready ❌ si:
- El portal `/t/[token]` da error o no muestra los datos de pago
- El upload de comprobante falla o no actualiza el status
- El botón "✓ Verificar pago" no aparece o no funciona
- El dashboard muestra estados incorrectos después de la verificación
- Hay pérdida silenciosa de datos en cualquier punto

### Borderline (operar con runbook) ⚠️ si:
- El reminder automático no llega pero el workaround manual funciona
- El Activity feed muestra algún label raro pero los eventos están registrados
- La variante overdue tiene gaps pero el happy path está completo
- Alguna métrica no refleja el ciclo porque el workspace es nuevo (esperado)

---

## Checklist final post-smoke test

- [ ] Happy path Variante A: ✅ / ❌
- [ ] Happy path Variante B (sin email): ✅ / ❌ / ⚠️
- [ ] Test de confusión Paso 5: ✅ / ❌
- [ ] Overdue Paso 8: ✅ / ❌ / ⚠️
- [ ] Dashboard estados correctos: ✅ / ❌
- [ ] ActivityLog completo: ✅ / ❌ / ⚠️
- [ ] Bugs encontrados: [N bugs — listar]
- [ ] Blockers para beta: [N blockers — listar]
- [ ] Veredicto: **BETA-READY** / **NO BETA-READY** / **BETA-READY CON RUNBOOK**

---

## Clasificación de blockers encontrados

### Blocker antes de beta
> Impide el ciclo de pago o genera pérdida de datos. Requiere fix antes de activar.

### No-blocker / se puede operar manualmente en beta
> El happy path funciona con workaround documentado en `docs/beta-runbook.md`.
> El owner puede completar el ciclo con ayuda del founder en los primeros ciclos.

---

*Versión inicial: PR-14. Actualizar con resultados del primer smoke test real.*
