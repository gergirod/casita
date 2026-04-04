# 05 — Channel Behavior

## Regla central
WhatsApp opera.
Web controla y configura.

## WhatsApp — responsibilities
### Owner
- consultar overview
- consultar cobros
- verificar pago
- mandar reminder
- crear cobro puntual
- actualizar alquiler
- subir boleta
- ver reclamos

### Tenant
- consultar qué debe
- recibir reminder
- subir comprobante
- consultar instrucciones de pago
- crear reclamo simple

## Web — responsibilities
- onboarding
- dashboard de estado
- timeline / ActivityLog
- configuración
- revisión de datos
- settings de integraciones
- edición puntual de casos sensibles

## No hacer en web al inicio
- flows operativos complejos
- forms que dupliquen al bot
- lógica paralela de negocio

## No hacer en WhatsApp al inicio
- setup complejo
- integraciones OAuth
- acciones destructivas sin confirmación
- procesos largos de configuración

## Regla técnica
Web, WhatsApp, cron y webhooks deben terminar llamando a los mismos services.

## Ejemplo
Verificar pago:
- desde WhatsApp: skill -> verifyPayment service
- desde web: route/server action -> verifyPayment service
- ambos terminan en la misma lógica y el mismo ActivityLog
