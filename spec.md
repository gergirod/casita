# Casita — Product Spec

## 1. Qué es Casita

Casita es una app de gestión de alquileres para propietarios en LATAM.

Reemplaza el flujo de WhatsApp + email + memoria con un panel limpio donde el propietario:
- Ve qué cobros tiene por mes
- Sube boletas de servicios y expensas
- El sistema recuerda al inquilino sin intervención manual
- Rastrea si se pagó y guarda el comprobante

## 2. Modelo mental central

> **Una casita = un alquiler activo**

- `Workspace` = la casita (el departamento/casa física)
- `Unit` = el período de alquiler (quién vive ahí y cuándo)
- Una casita puede tener varios alquileres en el tiempo (historial), pero solo uno activo

Cuando el inquilino se va: "Terminar alquiler" → casita libre → nuevo inquilino → nuevo alquiler.
El historial queda archivado en la misma casita.

## 3. Usuarios

**Propietario** (usuario primario):
- Crea casitas y configura cobros recurrentes
- Sube boletas del mes
- Ve estado de pagos
- Revisa comprobantes

**Inquilino** (usuario secundario, sin cuenta):
- Accede por link seguro único
- Ve sus obligaciones del mes
- Sube comprobante de pago
- Ve la boleta original

## 4. Cobros recurrentes (templates)

Cada casita tiene cobros configurados que se repiten todos los meses:

| Tipo | Monto | Cómo funciona |
|------|-------|---------------|
| Alquiler | Fijo | El propietario lo actualiza si hay aumento |
| Expensas | Variable | El propietario sube la boleta cada mes |
| Servicios (Luz, Gas, etc.) | Variable | El propietario sube la boleta cada mes |

Los templates tienen:
- `dueDay` → el día del mes en que vence
- `reminderDays` → cuántos días antes mandar el recordatorio al inquilino
- `reminderChannel` → email / whatsapp / ambos

## 5. Flujo mensual del propietario

```
1. Entra al dashboard de la casita
2. Ve el mes actual con los cobros configurados
3. Para alquiler: ya aparece el monto (fijo)
4. Para expensas/servicios: sube la boleta (o ingresa el monto manual)
5. El sistema guarda la obligación con monto + fecha de vencimiento
6. El cron job diario manda recordatorio al inquilino N días antes del vencimiento
7. El inquilino paga y sube el comprobante por su link seguro
8. El propietario verifica
```

## 6. Recordatorios automáticos (cron diario)

El cron `/api/cron/send-reminders` corre todos los días a las 11am UTC.

Lógica por obligación:
- `hoy == dueDate - reminderDays` → "vence en N días"
- `hoy == dueDate` → "vence hoy"
- `hoy > dueDate` (hasta 7 días) → "vencida" (solo una vez)

El `reminderDays` se configura por cada cobro recurrente.

## 7. Navegación por meses

El panel de cobros es una vista mensual navegable (← mes → con swipe):

- **Mes actual**: muestra estado real (sin boleta / boleta cargada / pagado / vencido)
- **Meses pasados**: historial de lo que pasó
- **Meses futuros**: monto estimado del template, badge "Próximo"
- **Límite de navegación**: fin del contrato (`leaseEndDate`)

## 8. Ciclo de vida de una casita

```
Casita creada (vacía)
  ↓
[Iniciar nuevo alquiler]
  → datos del inquilino
  → fecha inicio / fin del contrato
  → cobros recurrentes
  ↓
Gestión mensual (subir boletas, ver estados)
  ↓
[Terminar alquiler] en Configuración
  → casita queda libre
  → historial archivado
  ↓
[Iniciar nuevo alquiler] (nuevo inquilino)
```

## 9. Extractión de boletas con IA (opcional)

Si `GEMINI_API_KEY` está configurado, al subir una boleta el sistema intenta extraer:
- Monto total
- Fecha de vencimiento
- Período

Si Gemini no está configurado o falla, el propietario ingresa los datos manualmente.
El label "Extraído con IA" solo aparece si realmente hubo extracción.

## 10. Integraciones

| Integración | Estado | Para qué |
|-------------|--------|---------|
| Resend (email) | ✅ Activo | Recordatorios automáticos al inquilino |
| Supabase Storage | ✅ Activo | Boletas originales, contratos, comprobantes |
| Gemini | ⚙️ Opcional | Extracción de datos de boletas |
| Mercado Pago | 🔜 Pendiente | Links de pago para alquiler |
| WhatsApp (Twilio) | 🔜 Pendiente | Recordatorios por WhatsApp |

## 11. Lo que Casita NO es

- No es un ERP de propiedades
- No autopaga servicios
- No es una inmobiliaria
- No tiene contabilidad
- No maneja cobranzas legales

## 12. Regla de decisión para nuevas features

Antes de agregar algo, verificar:
1. ¿Reduce el trabajo manual del propietario?
2. ¿Clarifica el estado de pago?
3. ¿Cabe en el modelo "casita = alquiler"?
4. ¿Se puede explicar en una oración?

Si no es claramente sí, va al backlog.
