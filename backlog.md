# Backlog

_Última actualización: 6 de abril 2026_

---

## ✅ Ya implementado (no repetir)

- Owner bot con 20+ tools (`lib/owner-agent.ts`)
- Phone routing owner/tenant (`lib/phone-router.ts`)
- Gmail OAuth + Microsoft OAuth a nivel cuenta (`OwnerProfile`)
- Búsqueda de facturas en Gmail por proveedor y por custom sender
- Expensas: custom sender pattern por template (`ObligationTemplate.customSenderPattern`)
- `list_recent_emails` — lista emails sin AI extraction para que el owner elija
- `process_specific_email` — procesa el email elegido por el owner
- `check_setup` tool — prerequisite checker driven por `lib/agent-checklist.ts`
- `agent-checklist.ts` — fuente de verdad para reglas y loops de refinamiento
- Manejo de límite Twilio sandbox (log + guardar reply no entregado en DB)
- Modelo Claim persistido
- RAG de contrato (text en contexto)
- Settings panel mobile-friendly en dashboard
- WhatsApp onboarding banner en dashboard

---

## 🔥 Próximo sprint (ordenado por impacto)

- **Obligaciones de alquiler automáticas**: generar obligación de alquiler el 1ro de cada mes para todas las casitas activas. Hoy solo se crea si el owner lo pide manualmente.
- **Notificación al owner cuando el inquilino sube comprobante**: hoy no hay alerta proactiva al owner bot. (gap crítico del flujo de pago)
- **Notificación al owner cuando MP confirma pago**: webhook `/api/webhooks/mercadopago` ya verifica la obligación pero no avisa por WhatsApp al dueño.
- **Verificación de comprobante desde el dashboard**: botón para marcar como verificado sin pasar por WhatsApp.
- **Pasar a producción Twilio**: eliminar el límite de 50 msgs/día del sandbox. Requiere número real + Meta Business verification.

---

## 📋 Mediano plazo

### Bot / agente
- **Comunicación entre agentes**: cuando tenant sube comprobante → notificar owner bot. Cuando owner verifica → notificar tenant. Evaluar pub/sub o mensajes directos.
- **Guardar reminders en ChatMessage**: el bot no tiene contexto cuando el inquilino responde a un recordatorio.
- **Loop de búsqueda de facturas por proveedor**: igual que expensas, si no encuentra → `list_recent_emails` → user elige. Hoy solo expensas tiene este loop.
- **`save_custom_sender` por subject keyword**: además del remitente, guardar una pista del asunto (ej: "LIQUIDACION") para filtrar emails en futuras búsquedas sin AI extraction en newsletters.
- **Outlook: `listRecentEmailsFromSender` y `processSpecificEmail`**: hoy solo existen para Gmail. Hay que implementar equivalentes en `outlook-api.ts`.

### Datos / DB
- **Historial de aumentos de alquiler**: guardar cada cambio de monto con fecha y motivo. Visible en el dashboard de la casita.
- **Limpieza de ChatMessage**: job periódico para borrar mensajes >30 días.
- **Limpieza de debug logs**: sacar los `console.log([gmail-debug] ...)` antes de producción.

### Dashboard
- **Vista de facturas por casita**: listado de facturas subidas con PDF descargable, monto, período y estado.
- **Historial de obligaciones**: ver todas las obligaciones (pagas, pendientes, vencidas) por unidad en una timeline.

### Observabilidad
- Trazas por `messageSid` — idempotencia y retries en webhook
- Rate limiting propio para evitar floods

---

## 🔭 Largo plazo

- **Google Calendar integration**: crear eventos automáticos de vencimiento de alquiler para owner e inquilino. Requiere OAuth de Google Calendar por separado del OAuth de Gmail. Útil pero no crítico para MVP.
- **Mercado Pago checkout dinámico por obligación**: generar un link de MP con `external_reference=obligation:xxx` por cada cobro, en lugar del link fijo del owner. Permite auto-verificación sin que el inquilino suba comprobante.



- Dashboard multi-casita con filtros y analytics
- CSV export de obligaciones y pagos
- Más proveedores de pago (Stripe, transferencias bancarias directas)
- Modo asistente (acceso compartido para una persona de confianza del owner)
- Gemini/GPT Vision: mejorar extracción de facturas escaneadas o en imagen
- Multi-idioma (portugués para Brasil)

---

## 👤 Edge cases pendientes

- **Usuario que es owner e inquilino con el mismo teléfono**: el router hoy siempre prioriza owner. Solución futura: keyword "modo inquilino" para cambiar contexto, o segundo número por rol.

---

## ❌ Descartado para MVP

- Autopago de servicios de terceros
- Suite contable / conciliación bancaria
- Portal de inmobiliaria / marketplace
- Cobranzas / acciones legales
- n8n para lógica de negocio central (solo puede usarse para jobs y notificaciones secundarias)
