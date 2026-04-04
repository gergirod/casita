# Casita — Runbook de Beta Cerrada

> Versión: PR-13 · Uso interno · Solo para founders y soporte en beta.

---

## 0. Qué está automatizado y qué no

### Automático (sin intervención humana)
| Proceso | Cuándo | Cómo verificar |
|---|---|---|
| Generación de obligación de alquiler del mes | Diario 11:00 UTC (`send-reminders`) | Vercel Cron logs o ActivityLog en dashboard |
| Reminder previo al vencimiento | Día exacto de `reminderDays` antes del vencimiento | Email al inquilino + ActivityLog `reminder.sent` |
| Reminder día del vencimiento | Vencimiento = hoy | Email al inquilino |
| Marcar como overdue | 5 días después del vencimiento, sin comprobante | Status `overdue` + email |
| Alerta al owner por WA | -3 días, día 0, +2 días | WhatsApp al `ownerPhone` si está configurado |
| Verificación via MercadoPago | Webhook al pagar con MP | `payment.verified` en ActivityLog |

### Manual (requiere acción humana)
| Proceso | Quién | Cómo |
|---|---|---|
| Reminder para inquilinos sin email | Owner o founder | Bot ("mandá recordatorio a Juan") o curl |
| Reminder para obligations sin template | Owner o founder | Bot o curl manual |
| Corrección de monto/fecha de obligation | Founder | Prisma Studio o Supabase Table Editor |
| Re-procesamiento de boleta con AI falla | Owner | Mensaje al bot con URL de la boleta |
| Verificar pago recibido fuera de band | Owner | Dashboard (botón "Verificar pago") o bot |
| Cancelar obligation duplicada | Owner | Bot ("cancelá el cobro X") |

### Limitaciones conocidas de beta
- **Reminder automático solo funciona si el inquilino tiene email configurado.** Inquilinos solo-WhatsApp no reciben reminder automático del cron. Workaround: el owner usa el bot.
- **Obligations manuales (sin template) no entran en el cron diario.** Solo las obligations ligadas a un `ObligationTemplate` reciben reminder automático.
- **`owner-alerts` solo procesa la primera unidad activa por workspace.** Bug menor, no afecta la mayoría de casos beta (workspaces single-unit).
- **Si Vercel tuvo downtime el día exacto del reminder, el reminder se pierde.** No hay retry. Workaround: envío manual documentado abajo.
- **Workspaces creados antes de PR-02 no tienen ActivityLog.** Las métricas M2, M3, M4 aparecerán en cero para esos workspaces aunque haya actividad histórica.

---

## 1. No salió el reminder

### Diagnóstico: qué revisar primero
1. **¿Tiene el inquilino email configurado?**
   - Dashboard → casita → ver perfil del inquilino → campo email
   - Si no tiene email → el cron lo ignora silenciosamente (ver Limitaciones §0)
2. **¿La obligation tiene `templateId`?**
   - Si es un cobro manual (expensas puntuales, ajuste) → el cron no la cubre
3. **¿El cron corrió ese día?**
   - Vercel → proyecto → Functions → Logs → buscar `/api/cron/send-reminders`
   - Si no hay log → downtime de Vercel ese día
4. **¿El reminder ya se envió antes?**
   - ActivityLog en el dashboard → buscar `reminder.sent` para esa obligation
   - El cron es idempotente en cuanto al timing: si ya pasó el día, no reenvía

### Qué se puede corregir hoy
**Forzar un reminder manual** (solo si el inquilino tiene email o WhatsApp):

```bash
# Via bot del owner — decirle al owner que mande este mensaje al bot:
"mandá un recordatorio a [nombre inquilino] sobre [nombre cobro]"

# Via curl (founder) — reemplazar TOKEN con el CRON_SECRET del env:
curl -X GET "https://TU-DOMINIO.vercel.app/api/cron/send-reminders" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

> **Nota:** el curl re-corre el cron completo. Es idempotente y seguro ejecutarlo manualmente.

### Mensaje para el owner
> "El sistema manda recordatorios automáticos X días antes del vencimiento y el día que vence. Si querés mandarle un recordatorio ahora mismo a [nombre inquilino], escribime 'mandá recordatorio a [nombre]' y lo hago en el momento."

### ¿Bloquea el ciclo de pago?
No. El inquilino puede pagar y subir comprobante aunque no haya recibido reminder.

---

## 2. No llegó WhatsApp

### Diagnóstico: qué revisar primero
1. **¿Está configurado `ownerPhone` en el workspace?**
   - Dashboard → Configuración → Teléfono del dueño (con código de país, ej: +549XXXXXXXX)
2. **¿`whatsappEnabled = true` en el workspace?**
   - Revisar en Supabase Table Editor → `Workspace` → campo `whatsappEnabled`
3. **¿El número del inquilino tiene `+` y código de país?**
   - Formato requerido: `+549XXXXXXXXXX` (Argentina) — sin el 0 ni el 15
4. **¿Twilio está en Sandbox o en producción?**
   - Sandbox solo acepta números pre-registrados. Para producción se necesita WhatsApp Business aprobado.
5. **¿Hay errores en Vercel logs?**
   - Functions → `/api/webhooks/twilio-whatsapp` o el cron → buscar `sendWhatsApp error`
6. **¿El inquilino tiene el número de Twilio guardado en su WhatsApp?**
   - En sandbox: el inquilino debe haber enviado primero "join [código]" al número de Twilio

### Qué se puede corregir hoy
- Verificar y corregir formato del número en el dashboard (Settings del workspace)
- Si está en sandbox: pedirle al inquilino que mande "join [código]" al número de Twilio

### Mensaje para el owner
> "Vi que el WhatsApp no llegó. ¿Podés confirmarme el número de [nombre inquilino] con código de país? Tiene que ser formato +549XXXXXXXXXX. Lo actualizo y reenvío."

### ¿Bloquea el ciclo de pago?
No. El inquilino puede entrar al portal de pago directamente con el link `/t/[token]`.

---

## 3. El inquilino no entiende cómo pagar

### Diagnóstico: qué revisar primero
1. **¿El template tiene `paymentMethod` configurado?**
   - Dashboard → editar cobro → sección de pago → CBU/alias o link de MP
   - Si no está configurado → el portal no muestra instrucciones de pago
2. **¿Tiene `paymentCbu` con el CBU o alias correcto?**
   - Verificar en la edición del template
3. **¿El link del portal funciona?**
   - Probar `/t/[tenantToken]` directamente en el browser

### Qué se puede corregir hoy
- Editar el template desde el dashboard y agregar CBU/alias (se refleja de inmediato en el portal)
- Compartir el link del portal directamente: `https://TU-DOMINIO.vercel.app/t/[token]`

### Mensaje para el inquilino
> "Hola [nombre], te mando el link con toda la info para pagar: [URL del portal]. Ahí vas a ver el monto, la fecha de vencimiento y los datos para la transferencia. Cualquier duda avisame."

### Mensaje para el owner
> "Para que [nombre inquilino] vea los datos de transferencia necesitamos tener el CBU o alias cargado en el sistema. ¿Me confirmás el CBU/alias y el nombre del titular? Lo cargo en 2 minutos."

### ¿Bloquea el ciclo de pago?
**Sí, si no hay datos de pago configurados.** Fix: editar el template y agregar CBU. Se resuelve en 2 minutos.

---

## 4. El comprobante se subió mal (foto borrosa, archivo incorrecto, equivocado)

### Diagnóstico: qué revisar primero
1. **¿Dónde está el comprobante?**
   - `Obligation.proofUrl` → link en Supabase Storage
   - Dashboard → obligation → "Ver comprobante ↗" (si está visible)
2. **¿El inquilino subió el archivo correcto?**
   - Abrir el link para verificar
3. **¿La obligation sigue en `proof_uploaded` o ya pasó a `verified`?**
   - Si ya está `verified` → el owner lo verificó sin revisar bien

### Qué se puede corregir hoy

**Si sigue en `proof_uploaded` (no verificado aún):**
- Pedirle al inquilino que vuelva a subir desde el portal `/t/[token]`
- El portal permite subir comprobante mientras la obligation no esté `verified`

**Si ya está `verified` por error:**
- Via bot del owner: "marcá el cobro [nombre] como pendiente"
- Esto hace la transición `verified → pending` (NO disponible — `verified` es terminal en el state machine)
- Alternativa: cancelar la obligation (`verified → cancelled` tampoco es válido)

> **Limitación importante:** `verified` es un estado terminal. Si el owner verificó por error, hoy no hay un "deshacer" via UI/bot. La opción es cancelar manualmente la obligation en Supabase y crear una nueva.

**Corrección manual en Supabase (founder):**
```sql
-- Revisar el estado actual
SELECT id, title, status, "proofUrl" FROM "Obligation" WHERE id = 'OBLIGATION_ID';

-- Revertir a pending si fue un error (solo si no hubo pago real)
UPDATE "Obligation" SET status = 'pending', "proofUrl" = NULL, "proofUploadedAt" = NULL
WHERE id = 'OBLIGATION_ID';
```

### Mensaje para el inquilino
> "Hola [nombre], el comprobante que subiste no se ve bien. ¿Podés volver a subirlo desde el link de pago? [URL del portal]. Necesitamos que se vea el número de transacción y el monto."

### ¿Bloquea el ciclo de pago?
No, si no está verificado. Sí requiere atención si ya se verificó por error.

---

## 5. La boleta se procesó mal (monto incorrecto, fecha incorrecta)

### Diagnóstico: qué revisar primero
1. **¿La extracción AI devolvió datos?**
   - ActivityLog → buscar `bill.ingested` para esa obligation
   - Metadata tiene `extractedAmount` y `extractedDueDate`
2. **¿El monto en la obligation coincide con la boleta?**
   - Dashboard → obligation → monto mostrado vs boleta original ("Ver boleta ↗")
3. **¿La IA extrajo del PDF o imagen correctamente?**
   - PDFs nativos (texto seleccionable) → extracción confiable
   - Fotos de facturas → extracción aproximada, puede fallar
   - Boletas muy largas o con formato no estándar → más probable error

### Qué se puede corregir hoy

**Via bot del owner:**
> "corregí el monto del cobro [nombre] a [monto correcto]"
> "corregí la fecha de vencimiento del cobro [nombre] a [fecha]"

**Corrección manual en Supabase (founder):**
```sql
UPDATE "Obligation"
SET amount = NUEVO_MONTO, "dueDate" = 'YYYY-MM-DD'
WHERE id = 'OBLIGATION_ID';
```

**Re-procesar la boleta:**
- Decirle al owner que mande al bot: "procesá esta boleta: [URL de la boleta]"
- El bot re-intenta la extracción AI

### Mensaje para el owner
> "La extracción automática de la boleta tuvo un error — esto pasa con algunas fotos o PDFs escaneados. Corrijo el monto y la fecha manualmente. Confirmame: ¿el monto es [X] y vence el [fecha]?"

### ¿Bloquea el ciclo de pago?
Sí si el monto está mal y el inquilino ya lo vio. Hay que corregirlo antes de que pague.

---

## 6. Una obligation quedó mal creada (duplicada, monto 0, tipo incorrecto)

### Diagnóstico: qué revisar primero
1. **¿Es una obligation duplicada?**
   - Puede pasar si el cron corrió dos veces el mismo día por algún motivo
   - El cron tiene protección `findFirst` + `create` pero el race condition es posible
2. **¿El monto es 0 o incorrecto?**
   - Puede ser resultado de una extracción AI fallida
3. **¿El tipo está mal?**
   - `rent` creado como `custom`, etc.

### Qué se puede corregir hoy

**Via bot del owner:**
> "cancelá el cobro [nombre] del [mes]"

**Via dashboard:**
- La obligation con status `pending` o `upcoming` se puede cancelar desde el bot
- Luego crear la obligation correcta: bot → "creá un cobro de [tipo] por [monto] para [inquilino] con vencimiento [fecha]"

**Corrección de duplicada en Supabase (founder):**
```sql
-- Ver las obligations del mismo template en el mismo mes
SELECT id, title, status, amount, "dueMonth", "createdAt"
FROM "Obligation"
WHERE "templateId" = 'TEMPLATE_ID'
ORDER BY "createdAt" DESC;

-- Cancelar la duplicada (la más nueva)
UPDATE "Obligation" SET status = 'cancelled' WHERE id = 'OBLIGATION_ID_DUPLICADA';
```

### Mensaje para el owner
> "Vi que se creó un cobro duplicado/incorrecto. Lo cancelo y creo el correcto ahora. ¿Me confirmás el monto y fecha correctos para [nombre cobro]?"

### ¿Bloquea el ciclo de pago?
No si se resuelve antes de que el inquilino pague. Sí si el inquilino pagó el monto incorrecto.

---

## 7. El owner necesita corregir manualmente algo

### Correcciones disponibles hoy

| Acción | Via bot | Via dashboard | Via Supabase (founder) |
|---|---|---|---|
| Cambiar monto de obligation | ✓ | ✗ | ✓ |
| Cambiar fecha de vencimiento | ✓ | ✗ | ✓ |
| Cancelar obligation | ✓ | ✗ | ✓ |
| Verificar pago | ✓ | ✓ (botón "Verificar pago") | ✓ |
| Marcar como overdue | Via transición de status en bot | ✗ | ✓ |
| Actualizar CBU/alias | ✗ | ✓ (editar cobro recurrente) | ✓ |
| Cambiar email del inquilino | ✗ | ✗ | ✓ |
| Cambiar WhatsApp del inquilino | ✗ | ✗ | ✓ |
| Borrar comprobante erróneo | ✗ | ✗ | ✓ + borrar en Supabase Storage |

### Correcciones de contacto del inquilino en Supabase

```sql
-- Actualizar email del inquilino
UPDATE "TenantContact" SET email = 'nuevo@email.com' WHERE "unitId" = 'UNIT_ID';

-- Actualizar WhatsApp del inquilino (con código de país)
UPDATE "TenantContact" SET whatsapp = '+549XXXXXXXXXX' WHERE "unitId" = 'UNIT_ID';
```

### Mensaje para el owner
> "Para correcciones rápidas podés decirme directamente en el chat qué necesitás cambiar. Si es algo que no puedo hacer yo solo, lo hacemos con vos en 5 minutos."

### ¿Bloquea el ciclo de pago?
Depende de qué se quiere corregir. Ver tabla arriba.

---

## 8. El dashboard no muestra actividad porque el workspace es viejo

### Por qué pasa
El ActivityLog se creó en PR-02. Workspaces creados antes de esa fecha no tienen entradas históricas. El feed de actividad mostrará "No hay actividad registrada aún" aunque el workspace tenga meses de uso.

### Qué se puede hacer
- **Nada retroactivo** — no es posible reconstruir el ActivityLog histórico sin los eventos originales
- A partir del momento actual, todas las acciones nuevas se registran correctamente
- El feed se irá poblando con el primer ciclo nuevo

### Mensaje para el owner
> "El registro de actividad empezó a funcionar hace poco. Todo lo que hagas a partir de ahora va a aparecer ahí en tiempo real — pagos, recordatorios, comprobantes. El historial anterior no está disponible pero el nuevo sí."

### ¿Bloquea el ciclo de pago?
No. Es solo una limitación de visibilidad histórica.

---

## 9. La métrica no refleja bien la realidad de un caso puntual

### Casos frecuentes y por qué

**M2 (owner activo en WA) muestra 0 semanas aunque el owner sí usa el bot:**
- El owner manda mensajes pero no ejecuta acciones que generen ActivityLog
- Ej: mandó "hola", preguntó "cómo estás" — no genera log de `actorType=owner`
- Solo cuentan acciones reales (verify, reminder, crear cobro, etc.)

**M3 (ciclos completos) muestra 0 aunque haya pagos verificados:**
- Los pagos se verificaron pero el reminder se mandó fuera del sistema (WA directo)
- O el workspace es pre-PR-02 y no tiene ActivityLog de reminders
- O el pago se verificó via MercadoPago (no pasa por `reminder.sent`)

**M4 (self-service) muestra 0% aunque el inquilino sube comprobantes:**
- Si el workspace es pre-PR-02, los eventos `proof.uploaded` no están en ActivityLog
- Acciones futuras sí se van a registrar

**M5 (tiempo promedio) muestra "Sin datos":**
- No hay obligations verificadas con `paidAt` en los últimos 90 días
- O las obligations se verificaron sin que `paidAt` quede populado (flujo via bot sin MercadoPago)

### Mensaje para el owner
> "Las métricas se calculan sobre los datos del sistema a partir de cuando lo instalaste. Algunos números pueden ser bajos al principio — se van a ir llenando con cada ciclo. Lo importante es la tendencia, no el número absoluto en las primeras semanas."

### ¿Bloquea la beta?
No. Es una limitación de datos acumulados. Documentada y esperada.

---

## 10. El owner se frustra en el primer ciclo y necesita asistencia

### Señales de alerta temprana
- El owner manda más de 3 mensajes seguidos con preguntas al bot sin obtener lo que necesita
- El bot responde con "No puedo hacer eso" o frases genéricas
- El owner menciona que el inquilino no sabe cómo pagar
- El owner pregunta cómo ver si el inquilino pagó

### Protocolo de intervención

**Paso 1 — Diagnóstico express (2 min):**
```
¿Tiene inquilino configurado?        → Dashboard → tenantContact
¿Tiene al menos 1 cobro activo?      → Dashboard → obligations
¿El cobro tiene status pending?      → ¿Tiene dueDate próxima?
¿El inquilino tiene email/WhatsApp?  → Dashboard → perfil
¿Tiene CBU/alias cargado?            → Dashboard → editar cobro
```

**Paso 2 — Walkthrough con el owner (5 min):**
1. Mostrar el dashboard — qué significa cada número
2. Mostrar el portal del inquilino `/t/[token]` — qué ve el inquilino
3. Simular el ciclo: "fijate, el inquilino va a ver esto, y cuando pague hace clic acá"
4. Mostrar el botón "✓ Verificar pago" para cuando llegue el comprobante

**Paso 3 — Quick win:**
- Si hay un cobro pendiente → mandar reminder manual ahora mismo via bot
- Mostrar en tiempo real que aparece en ActivityLog

### Mensajes de soporte para founder → owner
> "Entiendo que puede parecer mucho al principio. Hacemos un call de 10 minutos y te muestro exactamente cómo funciona el primer ciclo completo — desde que el inquilino recibe el recordatorio hasta que vos lo verificás."

> "¿Querés que le mande yo el primer recordatorio a [nombre inquilino] ahora mismo para que veas cómo llega?"

> "Una vez que veas el primer ciclo completo, el resto son todos iguales. No cambia nada."

---

## 11. Checklist de soporte para founders

### Antes de arrancar con un owner nuevo
- [ ] ¿Tiene workspace creado con nombre?
- [ ] ¿Tiene al menos 1 casita (property + unit)?
- [ ] ¿Tiene inquilino configurado con nombre + email o WhatsApp?
- [ ] ¿Tiene al menos 1 cobro recurrente activo (template)?
- [ ] ¿El template tiene CBU/alias configurado? (necesario para que el inquilino sepa a dónde transferir)
- [ ] ¿El `ownerPhone` está cargado con código de país para recibir alertas?
- [ ] ¿El owner probó mandar "hola" al bot y recibió respuesta?
- [ ] ¿El owner vio el portal del inquilino `/t/[token]`?

### En cada ciclo mensual (primeros 2 meses)
- [ ] ¿Se creó la obligation de alquiler del mes? (revisar el día 1 de cada mes)
- [ ] ¿Se envió el reminder N días antes? (revisar Vercel Cron logs)
- [ ] ¿El owner recibió alerta en WhatsApp el día del vencimiento?
- [ ] ¿El inquilino subió comprobante? (ActivityLog → `proof.uploaded`)
- [ ] ¿El owner verificó el pago? (obligation status → `verified`)

### Señales de salud del sistema
```
✓ ActivityLog tiene entradas en las últimas 24h
✓ Vercel Cron logs muestran send-reminders sin errores
✓ No hay obligations en proof_uploaded con más de 48h sin verificar
✓ No hay obligations en overdue con más de 7 días sin respuesta del owner
```

---

## 12. Correcciones manuales disponibles hoy

### Forzar cron de reminders
```bash
curl -X GET "https://TU-DOMINIO.vercel.app/api/cron/send-reminders" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### Cambiar status de una obligation
```bash
# Requiere sesión de owner autenticada — usar desde el dashboard o el bot
# Via API directa (reemplazar con cookie de sesión real):
curl -X PATCH "https://TU-DOMINIO.vercel.app/api/obligations/OBLIGATION_ID/status" \
  -H "Content-Type: application/json" \
  -H "Cookie: TU-SESSION-COOKIE" \
  -d '{"status": "verified"}'
```

### Correcciones en Supabase Table Editor (founders)
```
1. Ir a app.supabase.com → tu proyecto → Table Editor
2. Tabla Obligation → filtrar por unitId o id
3. Editar directamente el campo que necesitás cambiar
4. Guardar — el cambio es inmediato
```

> **Aviso:** las correcciones directas en Supabase no generan ActivityLog. Documentalas en tu Notion/Slack de soporte interno.

### Ver logs de un cron específico
```
Vercel Dashboard → proyecto → Functions tab → /api/cron/send-reminders → Logs
Filtrar por fecha y hora del incidente
Buscar: "errors=" para ver si hubo fallas
```

---

## 13. Clasificación de incidentes: blocker vs ruido

### Bloquea el ciclo de pago — responder en < 2 horas
| Incidente | Por qué bloquea |
|---|---|
| Inquilino no sabe a dónde transferir (sin CBU configurado) | No puede pagar |
| Obligation con monto incorrecto visible al inquilino | Pagará el monto equivocado |
| Obligation con status cancelled pero pago real pendiente | Inquilino no tiene obligación activa |
| Bot caído o sin respuesta (Twilio error) | Owner no puede operar |
| Portal `/t/[token]` retorna 404 o error | Inquilino no puede subir comprobante |

### No bloquea — resolver en el día
| Incidente | Por qué no bloquea |
|---|---|
| Reminder automático no llegó | Inquilino puede pagar igual; owner puede mandar manual |
| ActivityLog vacío en workspace viejo | Solo afecta visibilidad histórica |
| Métricas muestran 0 en beta temprana | Datos insuficientes, no es un error |
| Alerta al owner no llegó por WA | Owner puede ver el dashboard |
| Boleta procesada con monto levemente incorrecto | Corregible antes del pago |

### Ruido operativo — documentar y cerrar
| Incidente | Acción |
|---|---|
| Owner pregunta por funcionalidad no existente | Anotar en backlog, explicar workaround |
| Métrica no refleja un caso particular | Explicar limitación conocida |
| Dashboard lento | Revisar queries, Supabase status |
| Owner confundido con el bot | Walkthrough de 10 min |

---

## 14. Plantilla de cierre de ciclo exitoso

Cuando un ciclo llega a `verified`, mandar este mensaje al owner (opcional, para refuerzo positivo):

> "✓ Perfecto — el pago de [nombre cobro] de [mes] quedó verificado. El sistema registró: recordatorio enviado → comprobante recibido → verificado por vos. Todo en orden para [nombre inquilino]."

Y al inquilino (si se quiere confirmar):

> "Hola [nombre], confirmamos la recepción del comprobante de [nombre cobro]. Muchas gracias. Cualquier cosa estamos disponibles."

---

*Este runbook se actualiza después de cada incidente relevante en beta.*
*Versión inicial: PR-13.*
