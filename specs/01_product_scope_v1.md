# 01 — Product Scope V1

## Qué debe resolver V1
1. Crear una casita y una unidad desde web
2. Generar obligaciones mensuales
3. Enviar recordatorios automáticos
4. Permitir al inquilino ver qué debe
5. Permitir al inquilino subir comprobante
6. Permitir al owner verificar pago
7. Hacer follow-up automático si no paga
8. Mostrar todo eso en un dashboard simple
9. Registrar timeline / ActivityLog

## Qué entra
### Owner por WhatsApp
- get_overview
- get_obligations
- verify_payment
- upload_bill
- send_reminder
- create_charge
- get_tenant_info
- update_rent
- get_claims
- update_claim

### Tenant por WhatsApp
- get_my_obligations
- upload_proof
- get_payment_info
- create_claim

### Web
- onboarding
- dashboard read-only
- settings
- timeline de actividad
- edición puntual de datos sensibles

## Qué no entra
- contract RAG
- claims workflow complejo
- email ingestion completo
- Outlook / IMAP
- provider marketplace
- multi-role complejo
- autopay
- app mobile nativa
- dashboards write-heavy

## Definition of done V1
1. owner crea casita en menos de 5 minutos
2. owner recibe saludo por WhatsApp
3. owner consulta cobros por WhatsApp
4. owner manda foto/PDF de boleta y se procesa
5. tenant recibe recordatorio
6. tenant sube comprobante
7. owner recibe notificación
8. owner verifica pago por WhatsApp
9. si tenant no paga en 3 días, recibe follow-up automático
10. owner ve estado completo en dashboard
