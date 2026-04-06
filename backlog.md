# Backlog

## Próximo sprint

- **Obligaciones de alquiler automáticas**: hoy el alquiler solo aparece en la vista mensual si se creó manualmente. Debería generarse automáticamente el 1ro de cada mes para todas las casitas activas.
- **Notificación al propietario cuando el inquilino sube comprobante**: hoy no hay alerta.
- **Verificación de comprobante desde el dashboard**: botón para marcar como verificado.

## Mediano plazo

- **Usuario que es owner e inquilino con el mismo teléfono**: hoy el router prioriza siempre owner. Si un owner también es inquilino en otra casita, ese número nunca puede hablar como inquilino. Decisión de MVP: aceptable (caso muy raro). Posibles soluciones futuras: keyword "modo inquilino" para cambiar contexto, o permitir un segundo número por rol.

- Mercado Pago payment link en la obligación de alquiler
- Webhook MP para verificación automática
- WhatsApp reminders (Twilio o Meta Cloud API)
- Historial de aumentos de alquiler visible en la casita
- Gemini: mejorar extracción (manejar más formatos de boleta AR)

### 💬 Chat Casita por WhatsApp (tenant-first)

> El inquilino se maneja 100% desde WhatsApp, sin abrir ningún portal.

**MVP técnico implementado:**
1. `POST /api/webhooks/twilio-whatsapp` con verificación de firma Twilio (production) y bridge a n8n.
2. `GET /api/tenant-by-phone` con normalización de teléfono para resolver unidad por WhatsApp.
3. `POST /api/tenant/[token]/proof-url` para guardar media de Twilio como comprobante en Supabase.
4. `POST /api/tenant/[token]/note` para registrar mensajes/reclamos como items visibles para owner.
5. Etiqueta de origen en dashboard (`WhatsApp`) para items `sourceType: n8n`.
6. Documentación y workflow importable de n8n (`docs/whatsapp-bot-mvp.md` y `docs/n8n-whatsapp-bot-mvp.workflow.json`).

**Agente inteligente implementado (reemplaza n8n):**
- OpenAI Function Calling con gpt-4o-mini (sin LangGraph, sin n8n para bot).
- Tools: `get_obligations`, `get_payment_info`, `save_proof`, `save_claim`, `get_contract_info`.
- Memory: últimos 10 mensajes por teléfono (`ChatMessage` model).
- Multi-round tool calls (hasta 3 rondas).
- System prompt hardened con anti-injection.
- `save_proof` sube comprobante a Supabase y notifica al owner.
- Fallback a regex si `OPENAI_API_KEY` no está configurada.

**Follow-ups pendientes:**
- ~~**Owner bot**: agente para el propietario por WhatsApp~~ ✅ Implementado en `lib/owner-agent.ts` con 19 tools (overview, obligaciones, verificar pagos, crear cobros, crear/borrar casitas, alta/baja alquiler, recordatorios inmediatos y programados, listar/cancelar recordatorios, bienvenida, subir facturas, buscar facturas en email por proveedor o administración custom). Phone routing via `lib/phone-router.ts`. Alertas proactivas al owner via cron (`/api/cron/owner-alerts`). Recordatorios programados procesados cada 15 min (`/api/cron/process-reminders`).
- **RAG de contrato**: permitir al inquilino hacer preguntas sobre su contrato (parseo de PDF + context window). Evaluar si embeddings o simplemente incluir texto en prompt.
- **Guardar reminders en ChatMessage**: para que el bot tenga contexto cuando el inquilino responde a un recordatorio.
- **Comunicación entre agentes**: cuando el tenant sube comprobante, notificar al owner bot proactivamente. Cuando el owner verifica, notificar al tenant. Evaluar modelo pub/sub o mensajes directos entre agentes.
- **Observabilidad**: trazas por `messageSid`, retries e idempotencia.
- **Modelo Claim**: persistir reclamos en un modelo dedicado (hoy se logean a console).
- **Limpieza de ChatMessage**: job periódico para borrar mensajes viejos (>30 días).

## Largo plazo

- **Gmail API + Microsoft Graph OAuth**: reemplazar IMAP por OAuth2 nativo. Gmail API para Gmail users, Microsoft Graph para Outlook/Hotmail. Cubre 95% de LATAM. IMAP queda como fallback para Yahoo/otros. Ventajas: sin app passwords (mejor UX), búsqueda más potente, tokens renovables. Alternativa: Nylas v3 como API unificada (costo por cuenta).
- Dashboard multi-casita con filtros y analytics
- CSV export
- Más proveedores de pago (Stripe, transferencias)
- Modo asistente (acceso compartido para una persona de confianza)

## n8n (pendiente de diseño UX)

n8n puede usarse para:
- Ingestión de emails con boletas
- Notificaciones salientes (WhatsApp, email) como alternativa al cron

Requiere pensar bien el flujo antes de implementar.
No reemplaza la lógica de negocio central (statuses, templates, amounts).

## Descartado para MVP

- Autopago de servicios de terceros
- Suite contable
- Portal de inmobiliaria
- Cobranzas / acciones legales
- Conciliación bancaria
- Marketplace de propiedades
