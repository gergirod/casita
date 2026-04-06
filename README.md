# Casita — Rental Ops for LATAM

> Manejá tus alquileres desde WhatsApp sin vivir persiguiendo gente.

Casita es una capa operativa de alquileres construida para propietarios en LATAM. Convierte mensajes de WhatsApp en acciones, estado y trazabilidad. Todo lo que importa — cobros, comprobantes, reclamos, recordatorios — queda registrado y visible.

---

## ¿Quiénes usan Casita?

| Rol | Canal principal | Acceso |
|-----|----------------|--------|
| **Owner** (propietario) | WhatsApp + Dashboard web | Control total de casitas, cobros, inquilinos |
| **Tenant** (inquilino) | WhatsApp + Portal seguro | Consultas, pagos y reclamos de su unidad |

---

## Rol: Owner (propietario)

### ✅ Qué puede hacer

#### Desde WhatsApp (bot conversacional)
| Skill | Comando de ejemplo |
|-------|--------------------|
| Ver resumen de casitas | "resumen" / "cómo estamos" |
| Ver obligaciones de una casita | "qué tiene pendiente [casita]" |
| Ver datos del inquilino | "datos de mi inquilino" |
| Ver comprobantes por verificar | "qué comprobantes tengo para revisar" |
| Verificar un pago | "verificar pago de [nombre]" |
| Cambiar estado de obligación | "cancelar la obligación X" |
| Crear cobro puntual | "crear cobro de expensas por $50.000, vence el 15" |
| Crear cobro recurrente | "crear cobro mensual de luz Edenor $12.000 vence el 20" |
| Crear casita nueva | "crear casita Palermo" |
| Dar de alta inquilino | "nuevo inquilino Juan García, jgarcia@email.com" |
| Terminar alquiler | "terminar alquiler de [casita]" |
| Actualizar monto de alquiler | "actualizar alquiler a $180.000" |
| Borrar casita | "borrar casita [nombre]" *(requiere confirmación explícita)* |
| Enviar recordatorio ahora | "mandar recordatorio a [inquilino]" |
| Programar recordatorio | "recordale el viernes a las 9" |
| Ver recordatorios programados | "qué recordatorios tengo" |
| Cancelar recordatorio | "cancelar el recordatorio X" |
| Enviar bienvenida al inquilino | "mandar bienvenida" |
| Subir factura (imagen/PDF) | enviar foto o PDF de la factura |
| Buscar facturas en email | "buscá la factura de Edenor" / "traé las expensas del Admin Rodríguez" |
| Ver reclamos de inquilinos | "qué reclamos hay abiertos" |
| Actualizar estado de reclamo | "marcar reclamo X como resuelto" |
| Conectar email (Gmail/Outlook) | "conectar mi Gmail" |
| Verificar si email está conectado | "tengo el email conectado?" |

#### Desde el Dashboard (web)
- Vista de todas las casitas con estado rápido (vencidas, pendientes, por verificar)
- Detalle de cada casita: obligaciones, plantillas, inquilino activo
- Verificar pagos con un click desde la obligación en `proof_uploaded`
- Ver comprobante antes de verificar
- Historial de actividad reciente (ActivityLog)
- Gestión de inquilinos, contratos y documentos
- Configuración de métodos de pago (CBU, alias, Mercado Pago)
- Conexión de email (Gmail / Outlook OAuth)
- Métricas de beta: onboarding, actividad WA, ciclos completos, autoservicio del inquilino, tiempo de ciclo

### ❌ Qué NO puede hacer (fuera de scope)
- No puede autopagar facturas de servicios
- No puede generar comprobantes fiscales (AFIP)
- No puede gestionar proveedores de mantenimiento
- No puede firmar o generar contratos digitales
- No puede procesar pagos directamente (solo links/verificación manual)
- No puede agregar múltiples owners al mismo workspace
- No puede acceder a conversaciones de otros owners

---

## Rol: Tenant (inquilino)

### ✅ Qué puede hacer

#### Desde WhatsApp (bot conversacional)
| Skill | Comando de ejemplo |
|-------|--------------------|
| Consultar deuda y vencimientos | "cuánto debo" / "cuándo vence el alquiler" |
| Ver datos de pago | "cómo pago" / "me das el CBU" |
| Subir comprobante de pago | enviar foto o PDF del comprobante |
| Registrar un reclamo | "se rompió el calefón" / "hay una filtración" |
| Ver datos del contrato | "cuándo vence mi contrato" / "tengo un PDF?" |
| Preguntar sobre el contrato | "cuál es la cláusula de rescisión" / "cuánto es el depósito" |
| Recibir link a su portal | "mandame el link" |

#### Desde el Portal web (`/t/[token]`)
- Ver todas sus obligaciones con estado
- Ver datos de pago (CBU, alias, link de Mercado Pago)
- Subir comprobantes de pago directamente
- Ver historial de pagos verificados

### ❌ Qué NO puede hacer
- No puede ver datos de otros inquilinos
- No puede crear ni cancelar obligaciones
- No puede contactar directamente al owner desde el portal (solo vía WhatsApp externo)
- No puede ver actividad de pagos de otras unidades
- No puede modificar sus datos de contacto desde el portal
- No tiene acceso al dashboard del owner

---

## Agente WhatsApp — Qué tiene y qué no tiene

### ✅ Tiene
- **Routing inteligente por número**: detecta automáticamente si quien escribe es owner o inquilino
- **Historial de conversación**: recuerda el contexto de los últimos mensajes (12 owner / 10 tenant)
- **Function calling estructurado**: cada acción se ejecuta via tool call, no via texto libre
- **State machines explícitas**: las transiciones de estado de obligaciones y reclamos son validadas antes de ejecutarse
- **ActivityLog**: toda acción queda registrada con actor, canal, entidad y metadata
- **Respuesta asíncrona**: el bot responde de inmediato mientras procesa en background (evita timeout de Twilio)
- **Extracción AI de facturas**: sube la foto, extrae monto y vencimiento con OpenAI Vision
- **Búsqueda en email**: busca facturas en Gmail/Outlook conectado por proveedor o remitente custom
- **Lectura de contratos**: responde preguntas sobre el contrato PDF del inquilino via RAG
- **Validación de ownership**: ninguna tool puede afectar datos de otro owner
- **Anti-injection**: el sistema prompt protege contra intentos de manipulación por mensaje

### ❌ No tiene (fuera de MVP)
- No ejecuta pagos ni transferencias automáticas
- No tiene memoria entre sesiones separadas por más de 12 turnos
- No tiene lógica de escalado automático a humano (el owner sigue decidiendo)
- No tiene voz ni procesamiento de audios
- No interpreta imágenes de comprobantes (solo guarda; la verificación es manual del owner)
- No tiene multi-idioma (solo español argentino)
- No tiene rate limiting por usuario
- No tiene reintentos automáticos de mensajes fallidos
- No envía notificaciones push fuera de WhatsApp/email

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| App | Next.js 15 (App Router, Server Components) |
| Auth | Supabase Auth (magic link) |
| DB | PostgreSQL via Supabase + Prisma ORM |
| Storage | Supabase Storage (facturas, comprobantes, contratos) |
| WhatsApp | Twilio (inbound/outbound) |
| AI | OpenAI `gpt-4o-mini` (agentes), `gpt-4o` (extracción de facturas) |
| Email | Resend (notificaciones salientes), Gmail/Outlook OAuth (ingesta) |
| Pagos | Mercado Pago (links + webhooks) |
| Deploy | Vercel (serverless) |

---

## Quick start

```bash
cp .env.example .env.local
# Completar variables requeridas

npx prisma migrate dev
npm run dev
```

### Variables de entorno requeridas

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=

# OpenAI
OPENAI_API_KEY=

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=+14155238886

# App
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
CRON_SECRET=
ENCRYPTION_SECRET=

# Opcional — dev sandbox
TWILIO_SANDBOX_JOIN_CODE=join tu-codigo-sandbox
```

### Variables opcionales

```bash
# Mercado Pago (webhooks de pago)
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# OAuth Email (Gmail)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OAuth Email (Outlook)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
```

---

## Webhooks

| Endpoint | Origen | Descripción |
|----------|--------|-------------|
| `POST /api/webhooks/twilio-whatsapp` | Twilio | Mensajes de WhatsApp (owner + tenant) |
| `POST /api/webhooks/mercadopago` | Mercado Pago | Confirmación de pagos |
| `GET /api/cron/send-reminders` | Vercel Cron | Genera obligaciones y envía recordatorios |
| `GET /api/cron/owner-alerts` | Vercel Cron | Alertas diarias al owner por WhatsApp |
| `GET /api/cron/process-reminders` | Vercel Cron | Procesa recordatorios programados |

---

## Tests

```bash
npm test
# 94 tests puros — sin DB, sin red, sin framework
# Cubre: obligation state machine, claim transitions, bill helpers, reminder logic
```

---

## Documentación interna

| Documento | Descripción |
|-----------|-------------|
| `docs/audit_whatsapp_rental_ops_latam.md` | Audit completo del producto |
| `docs/beta-runbook.md` | Runbook operativo para la beta |
| `docs/smoke-test.md` | Checklist de smoke test E2E |
| `docs/smoke-test-results.md` | Resultados del smoke test técnico |
| `docs/beta-launch-pack.md` | ICP, mensajes y checklist de beta |
| `specs/` | Especificaciones técnicas por módulo |
