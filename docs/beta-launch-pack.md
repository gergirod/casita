# Casita — Closed Beta Launch Pack

> **PR-15** · Uso interno · Para founders que activan los primeros 3-5 owners reales.
> Versión: 4 de abril de 2026.

---

## Estado del sistema al lanzar beta

| Verificación | Resultado |
|---|---|
| TypeScript build | ✅ 0 errores |
| Cron send-reminders | ✅ Funcionando — crea obligations + envía reminders por email |
| Cron owner-alerts | ✅ Funcionando — envía WA al owner en fechas clave |
| Cron process-reminders | ✅ Funcionando — procesa reminders programados |
| Portal del tenant `/t/[token]` | ✅ HTTP 200 — obligation y datos visibles |
| Botón "✓ Verificar pago" | ✅ Implementado (PR-11) |
| CBU visible en portal del tenant | ✅ Implementado (PR-11) — requiere `paymentMethod = "cbu"` |
| ActivityLog | ✅ Funciona para workspaces nuevos |
| Métricas de beta `/metricas` | ✅ Disponibles |
| Runbook de soporte | ✅ `docs/beta-runbook.md` |

**Veredicto:** BETA-READY WITH MANUAL SUPPORT.
Documentado en `docs/smoke-test-results.md`.

---

## ICP beta — A quién invitar primero

### Perfil ideal

> Owner individual en Argentina (AMBA preferido) con 1 a 3 unidades activas,
> que hoy persigue pagos por WhatsApp o Excel, con relación previa con el founder.

**Tick todos los boxes antes de invitar:**
- [ ] 1 a 3 unidades activas con inquilinos pagando mensual
- [ ] Alquiler fijo mensual (no vacacional, no por semana)
- [ ] Usa WhatsApp como canal principal
- [ ] Conoce al founder — puede dar feedback honesto sin suavizarlo
- [ ] Disponible para 10 minutos de setup inicial
- [ ] Paga por CBU/alias o MP link real (no "lo configuramos después")

### No invitar todavía

| Perfil | Por qué no |
|---|---|
| Administradores con 5+ unidades | Multi-workspace no está testeado en profundidad |
| Alquileres vacacionales / temporarios | Ciclo de pago irregular, fuera del modelo mensual |
| Owners que esperan autopago desde el día 1 | Beta requiere algo de setup manual — van a frustarse |
| Contactos completamente fríos | Van a abandonar en la primera fricción sin relación previa |
| Owners con solo Mercado Pago sin link real | El campo `paymentMpLink` tiene que tener valor, si no el tenant no ve instrucciones |

---

## Criterios de selección — scoring rápido

Para cada candidato, puntuar de 1 a 3:

| Criterio | 1 | 2 | 3 |
|---|---|---|---|
| Dolor real con pagos | Vago | Mencionado alguna vez | Nos lo contó con detalle |
| Relación con founder | Conocido | Amigo/cliente previo | Relación de confianza fuerte |
| Unidades activas | 0 listo | 1 listo | 2-3 listos |
| Canal WhatsApp | Dice que lo usa | Lo usa seguido | Lo usa a diario |
| Disposición a feedback | Desconocida | Aceptó en principio | Comprometido explícitamente |

**Umbral mínimo para invitar:** suma ≥ 10 puntos.
No invitar a nadie por debajo de 10 aunque tengan la relación.

---

## Mensajes listos para copiar

> **Tono:** WhatsApp-style, directo, cálido, en argentino. Sin formalidades. Sin "estimado/a".

---

### Mensaje 1 — Invitación inicial

Enviar por WhatsApp. Personalizar con el nombre real.

```
Hola [nombre] 👋

Estoy armando Casita — una app para que los dueños de propiedades
dejen de perseguir pagos por WhatsApp.

Quiero probarla con 4 o 5 personas de confianza antes de abrirla
al público. ¿Tenés alquileres activos?

Si querés ser uno de los primeros en probarla gratis y darme tu
opinión, te mando acceso esta semana.
```

---

### Mensaje 2 — Onboarding inicial (después de que accede)

Enviar por WhatsApp o email. Personalizar con nombre del inquilino si se conoce.

```
Hola [nombre] 👋 Bienvenido a Casita.

Para arrancar el primer ciclo necesitamos configurar tu propiedad
juntos — son 10 minutos y después el sistema trabaja solo.

Tres pasos para el primer ciclo:
1. Creá tu casita con el nombre del departamento o propiedad
2. Agregá los datos de tu inquilino: nombre, WhatsApp o email
3. Configurá el cobro mensual con el monto y tu CBU/alias

Cuando esté listo, el sistema le manda el recordatorio
automáticamente y te avisa cuando pague.

¿Cuándo tenés 10 minutos para hacer los 3 pasos? Te puedo ayudar
en vivo si querés.

[URL del dashboard: https://casita.app/dashboard]
```

---

### Mensaje 3 — Seguimiento a las 48-72h

Si no hubo actividad o no terminó el setup.

```
Hola [nombre], ¿cómo va Casita?

¿Pudiste configurar el primer cobro? Si hay algo que no quedó claro
o que no funciona como esperabas, contame — esto es beta y tu
feedback es lo más valioso que tenemos.

Si querés hacemos un call de 10 minutos y te ayudo a terminar la
config. Sin problema.
```

---

### Mensaje 4 — Feedback después del primer ciclo completo

Enviar cuando ActivityLog muestre `payment.verified` para ese owner, o cuando el owner nos cuente que cobró.

```
Hola [nombre] 👋

Veo que terminaste el primer ciclo — ¡buenísimo!

Tres preguntas rápidas, sin filtro:

1. ¿Sentiste que tuviste que hacer menos cosas que antes para cobrar?
2. ¿Hubo algo que no entendiste o que te molestó?
3. ¿Lo recomendarías a otro dueño que conozcas?

Con eso me alcanza por ahora. Gracias por el tiempo 🙌
```

---

### Mensaje extra — Si piden funcionalidad que no existe

```
Buena idea — lo anoto para la próxima versión. Por ahora lo que
hacemos bien es [X]. ¿Te alcanza con eso para este mes?
```

---

## Checklist de activación por beta tester

> Completar ANTES de enviar el Mensaje 1 de invitación.
> Un owner sin checklist completo no se invita.

### Pre-configuración técnica (founder hace esto, no el owner)

- [ ] Workspace creado con nombre real de la propiedad
- [ ] Al menos 1 unit activa (`isActive = true`)
- [ ] `TenantContact` creado con nombre + email O WhatsApp (mínimo 1 de los dos)
- [ ] `ObligationTemplate` activo con:
  - [ ] Tipo: `rent`
  - [ ] Monto real
  - [ ] Día de vencimiento real (`dueDay`)
  - [ ] `reminderDays` configurado (recomendado: 3)
  - [ ] **`paymentMethod = "cbu"` Y `paymentCbu` con alias o CBU real** ← obligatorio
  - [ ] `paymentName` con el nombre real del titular
- [ ] `ownerPhone` configurado en el workspace con código de país (`+549XXXXXXXXXX`)
- [ ] `whatsappEnabled = true` en el workspace

### Verificación visual antes de invitar

- [ ] Abrir `/t/[token]` en browser incógnito → confirmar que muestra:
  - [ ] Nombre del inquilino y nombre de la propiedad
  - [ ] Monto y fecha de vencimiento del cobro
  - [ ] Bloque "Transferí a:" con CBU/alias y titular
  - [ ] Botón "Subir comprobante"
- [ ] Abrir el dashboard del workspace → confirmar que muestra el cobro en el strip mensual

### Registro interno de founders (para cada beta tester)

Completar en Notion / Slack / donde se coordinen:

```
Owner: [nombre]
Workspace ID: [id]
Tenant: [nombre]
Email tenant: sí / no
WhatsApp tenant: sí / no
paymentMethod: cbu / mp_link
CBU/alias: [valor o "pendiente"]
ownerPhone: sí / no
Portal verificado: sí / no
Invitado el: [fecha]
Setup completo el: [fecha o "pendiente"]
Primer ciclo completo: sí / no / "en proceso"
```

---

## Qué vamos a observar en cada owner

### Señales técnicas (dashboard + ActivityLog)

Acceder desde `/dashboard/[workspaceId]/metricas` una vez por semana.

| Señal | Qué buscar | Herramienta |
|---|---|---|
| Owner usó el bot | `ActivityLog.actorType=owner, channel=whatsapp` | `/metricas` → M2 |
| Tenant subió comprobante | `ActivityLog.action=proof.uploaded, actorType=tenant` | ActivityFeed |
| Owner verificó el pago | `ActivityLog.action=payment.verified` | ActivityFeed |
| Reminder automático enviado | `ActivityLog.action=reminder.sent` | ActivityFeed |
| Ciclo completo trazado | M3 en `/metricas` | `/metricas` |
| Tiempo promedio del ciclo | M5 en `/metricas` | `/metricas` |

### Señales operativas (canal humano)

Registrar en el canal interno:

- [ ] ¿El owner necesitó ayuda del founder para terminar el setup?
- [ ] ¿El tenant preguntó algo por fuera del portal?
- [ ] ¿El owner tuvo que mandar un reminder manualmente por fuera del sistema?
- [ ] ¿Hubo algún error visible o mensaje de error?
- [ ] ¿El owner volvió al dashboard más de 1 vez en la semana?

### Preguntas de seguimiento (Día 7)

Además del Mensaje 4, estas preguntas dan señales de producto:

1. "¿En qué momento del ciclo sentiste que el sistema te ayudó más?"
2. "¿Hubo algo que tuviste que hacer de todas formas a mano aunque el sistema estuviera?"
3. "¿Qué haría que lo usaras todos los meses sin pensarlo?"

---

## Criterios de éxito de la beta cerrada

### Semana 1 — Setup
- **Verde:** ≥ 3 de 5 owners completan el setup solos o con ayuda mínima (< 10 min)
- **Amarillo:** 2 de 5 — hay fricción de onboarding a revisar
- **Rojo:** < 2 de 5 — hay un blocker de UX antes del primer ciclo

### Semana 2-3 — Primer ciclo
- **Verde:** ≥ 2 de 5 owners tienen un ciclo completo (reminder → comprobante → verificado)
- **Amarillo:** 1 ciclo completo — el sistema funciona pero hay fricción en algún paso
- **Rojo:** 0 ciclos completos — hay un blocker en el loop crítico

### Feedback cualitativo
- **Verde:** al menos 2 owners dicen que sintieron menos trabajo manual
- **Amarillo:** feedback mixto — algunos sí, algunos no saben comparar
- **Rojo:** nadie sintió diferencia o el feedback es negativo consistente

---

## Qué NO cambiar durante la beta cerrada

> La beta sirve para aprender, no para parchear en tiempo real.
> Si aparece un issue menor, documentarlo y resolverlo después del primer ciclo.

- No agregar features que un owner mencione durante el seguimiento
- No rediseñar el portal o el dashboard entre invitación y feedback
- No cambiar el comportamiento de los crons mientras la beta está activa
- No expandir el scope a más owners antes de tener feedback del primer grupo

**La única excepción:** si un blocker real impide que el tenant pague o suba el comprobante → fix inmediato (runbook en `docs/beta-runbook.md`).

---

## Tabla de beta testers (completar al invitar)

| Owner | Workspace | Status | Invitado | Setup | 1er ciclo | Feedback |
|---|---|---|---|---|---|---|
| [nombre 1] | [id] | pendiente | — | — | — | — |
| [nombre 2] | [id] | pendiente | — | — | — | — |
| [nombre 3] | [id] | pendiente | — | — | — | — |
| [nombre 4] | [id] | pendiente | — | — | — | — |
| [nombre 5] | [id] | pendiente | — | — | — | — |

**Status posibles:** pendiente / invitado / en setup / activo / primer ciclo / feedback recibido / churned

---

*Versión inicial: PR-15 · 4 de abril de 2026.*
*Actualizar la tabla a medida que se activan beta testers.*
