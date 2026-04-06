# Casita — Resumen completo del proyecto

> Documento generado como cierre de ciclo de desarrollo.
> Cubre qué construimos, cómo lo construimos, y qué decisiones tomamos en el camino.

---

## 1. Producto

### Qué es Casita

Casita es una **capa operativa de alquileres WhatsApp-native para LATAM**.

No es un chatbot. No es un ERP. Es el sistema que convierte conversaciones de WhatsApp en acciones reales, estado estructurado y trazabilidad completa — para propietarios argentinos con 1 a 5 unidades que hoy gestionan todo por WhatsApp personal, mensajes de voz, fotos de boletas y persecución manual de pagos.

### El problema que resuelve

Un propietario chico en Argentina tiene que:
- Acordarse de mandar la boleta de luz cada bimestre
- Perseguir al inquilino si no pagó
- Guardar comprobantes de transferencia en un chat de WhatsApp
- Llevar mentalmente el estado de 2 o 3 propiedades
- Responder preguntas del inquilino sobre el contrato, el CBU, el vencimiento

Todo esto vive en su cabeza y en un WhatsApp personal. Casita lo saca de ahí.

### El usuario central

**Owner (propietario):** dueño de 1-5 departamentos, no técnico, trabaja desde el celular. Quiere saber si le pagaron, mandar recordatorios y subir boletas sin abrir una app nueva.

**Tenant (inquilino):** recibe mensajes y links. No necesita instalar nada. Puede subir comprobantes, hacer reclamos y consultar el contrato desde WhatsApp o un link seguro.

### El one-liner

> Manejá tus alquileres por WhatsApp. Sin planillas, sin perseguir gente.

### Qué puede hacer el sistema hoy

#### Para el owner (por WhatsApp):
- Crear una casita nueva (con nombre, inquilino, CBU/alias, monto de alquiler)
- Registrar un inquilino y enviarle el mensaje de bienvenida
- Crear cobros recurrentes (alquiler, expensas, luz, gas — mensual, bimestral, trimestral)
- Crear cobros puntuales de una sola vez
- Subir una factura enviando un PDF o foto al chat
- Subir un contrato enviando un PDF al chat
- Consultar cláusulas del contrato en lenguaje natural
- Ver el resumen de estado de todas sus casitas
- Ver las obligaciones pendientes, vencidas y por verificar
- Enviar un recordatorio de pago al inquilino
- Verificar un pago recibido
- Ver y gestionar reclamos abiertos
- Conectar Gmail o Outlook para búsqueda automática de facturas
- Buscar facturas específicas en su correo conectado

#### Para el inquilino (por WhatsApp o portal web):
- Consultar deuda pendiente
- Subir comprobante de pago
- Hacer un reclamo o reportar un problema
- Consultar el contrato
- Recibir recordatorios automáticos de pago

#### Para el sistema (automático):
- Generar obligaciones mensuales a partir de templates
- Enviar recordatorios automáticos por email o WhatsApp N días antes del vencimiento
- Marcar obligaciones como vencidas si no se pagaron
- Buscar facturas de proveedores en el email conectado del owner
- Notificar al owner cuando el inquilino sube un comprobante
- Verificar pagos de Mercado Pago via webhook

### El dashboard (misión control)

El dashboard web es el **centro de supervisión**, no el centro de operación. Desde ahí el owner puede ver:
- Estado de cada casita y sus obligaciones del mes
- Feed de actividad reciente (quién hizo qué, cuándo, por qué canal)
- Links de inquilino para compartir
- Configuración de email (conectar/desconectar OAuth)
- Configuración de WhatsApp (número de cuenta)
- Cobros recurrentes, vencimientos, comprobantes y boletas

### Onboarding

Cuando un owner llega a Casita por primera vez y el dashboard está vacío:
- Ve un **banner de bienvenida de WhatsApp** que le explica cómo conectar su número
- Ingresa su teléfono → recibe un mensaje de bienvenida en WhatsApp con todo lo que puede hacer
- A partir de ahí opera principalmente desde el chat

### Flujo operativo completo (ciclo de cobro)

```
1. Owner crea casita por WhatsApp → sistema registra workspace, unit, tenant, template de alquiler
2. Sistema genera obligación mensual el 1ro de cada mes
3. N días antes del vencimiento → cron envía recordatorio al inquilino
4. Inquilino paga → sube comprobante por WhatsApp o portal web
5. Sistema notifica al owner
6. Owner verifica desde WhatsApp → obligación queda marcada como "verified"
7. Si no paga → follow-up automático a los 3 días → overdue a los 7
```

### Decisiones de producto importantes

| Decisión | Qué elegimos | Por qué |
|---|---|---|
| Canal principal | WhatsApp | Es donde ya vive la operación en LATAM |
| Dashboard | Supervisión, no operación | El owner no quiere aprender una app nueva |
| Tenant access | Link seguro por token, sin login | Cero fricción para el inquilino |
| Teléfono del owner | Una cuenta, no por casita | Un número registrado sirve para todas las propiedades |
| Email OAuth | Google + Outlook via OAuth2 | Sin contraseñas, sin IMAP, revocable desde Google |
| Payment info | CBU/alias en el template de alquiler | El inquilino lo necesita en el mensaje de bienvenida |
| Owner + Tenant mismo teléfono | Owner siempre gana | Edge case raro, documentado en backlog |

---

## 2. Arquitectura y Tecnología

### Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL (Supabase) |
| Storage | Supabase Storage (PDFs, imágenes) |
| Auth | Supabase Auth (JWT sessions) |
| IA | OpenAI (`gpt-5.4-mini` con function calling + vision) |
| WhatsApp | Twilio WhatsApp Business API |
| Email saliente | Resend |
| Email entrante | Gmail API + Microsoft Graph API (OAuth2) |
| Pagos | Mercado Pago webhooks |
| Deployment | Vercel |
| Tunnel local | ngrok (para webhook de Twilio en dev) |
| Lenguaje | TypeScript estricto en todo el proyecto |

---

### Modelo de dominio

```
User (Supabase Auth)
  └── OwnerProfile           → teléfono WhatsApp y config global del owner
  └── Workspace              → "casita" = una propiedad gestionada
        └── Property
              └── Unit       → unidad física (departamento, local)
                    ├── TenantContact   → datos del inquilino actual
                    ├── ContractHistory → historial de contratos subidos
                    ├── ObligationTemplate → cobros recurrentes configurados
                    │     └── paymentMethod / paymentCbu / paymentName / paymentMpLink
                    ├── Obligation      → instancia de cobro mensual
                    │     └── status: upcoming → pending → reminded → proof_uploaded → verified / overdue / cancelled
                    └── Claim           → reclamo o ticket del inquilino

ActivityLog                  → log de auditoría de todo lo que pasa
ChatMessage                  → historial de conversación por teléfono
ScheduledReminder            → recordatorios programados (cron)
MessageDeliveryLog           → log de envíos (email/WhatsApp)
```

### Estado de una Obligation (state machine)

```
upcoming → pending → reminded → proof_uploaded → verified  (terminal)
                   ↓           ↓
                overdue      overdue
                   ↓
               cancelled  (terminal)
```

Las transiciones son determinísticas: validadas por `lib/services/obligation-state-machine.ts`. El LLM no decide el estado — llama una tool, la tool llama el service, el service valida la transición.

---

### Arquitectura en capas

```
WhatsApp (Twilio)
    ↓
POST /api/webhooks/twilio-whatsapp
    ↓
lib/phone-router.ts  →  owner | tenant | unknown
    ↓                        ↓               ↓
lib/owner-agent.ts   lib/whatsapp-agent.ts  "no registrado"
    ↓                        ↓
  OpenAI                   OpenAI
  Function Calling         Function Calling
    ↓                        ↓
lib/services/*           lib/services/*
    ↓                        ↓
Prisma + Supabase       Prisma + Supabase
```

### Routing por teléfono

`lib/phone-router.ts` recibe el número entrante y decide:
1. Busca en `OwnerProfile` (por dígitos, normalizado) → si encuentra: **owner bot**
2. Busca en `TenantContact` (por dígitos, normalizado) → si encuentra: **tenant bot**
3. Si no encuentra nada: responde "número no registrado"

El número se normaliza antes de guardar (strips espacios y caracteres, formato E.164-ish) para evitar mismatches entre `+549 11 1234 5678` y `+5491112345678`.

---

### Los agentes de IA

#### Owner Agent (`lib/owner-agent.ts`)

- Modelo: `gpt-5.4-mini` con function calling
- Historial: últimos 12 mensajes por número de teléfono (persistido en `ChatMessage`)
- Max rounds de tools: 3 por mensaje (evita loops infinitos)
- `max_completion_tokens`: 2000 (el sistema prompt es largo, necesita espacio para razonar)
- Fallback: si OpenAI devuelve contenido vacío, hay una segunda llamada sin tools forzando respuesta de texto

**Tools disponibles:**

| Tool | Qué hace |
|---|---|
| `get_overview` | Resumen de todas las casitas con estado de cobros |
| `get_obligations` | Obligaciones de una casita específica con filtro de estado |
| `get_tenant_info` | Datos del inquilino (nombre, WhatsApp, portal link) |
| `get_pending_proofs` | Comprobantes recibidos pendientes de verificación |
| `get_claims` | Reclamos abiertos por casita |
| `get_reminders` | Recordatorios programados pendientes |
| `create_casita` | Crea workspace + unit + tenant + template de alquiler |
| `create_recurring_charge` | Crea/actualiza ObligationTemplate (upsert por tipo) |
| `create_manual_charge` | Crea una Obligation puntual |
| `create_new_rental` | Registra nuevo inquilino en casita existente |
| `end_rental` | Cierra el contrato de un inquilino |
| `update_rent` | Actualiza el monto del alquiler |
| `delete_casita` | Borra un workspace (requiere confirmación "SI BORRAR") |
| `send_reminder` | Envía recordatorio de pago al inquilino |
| `schedule_reminder` | Programa un recordatorio para una fecha futura |
| `cancel_reminder` | Cancela un recordatorio programado |
| `send_welcome` | Envía mensaje de bienvenida al inquilino |
| `verify_payment` | Marca una obligación como verified |
| `upload_bill` | Sube una factura (PDF/imagen) a Supabase + extrae metadata con AI |
| `upload_contract` | Sube un contrato (PDF) + valida contra datos del inquilino |
| `update_claim` | Actualiza estado de un reclamo |
| `ask_contract` | Consulta en lenguaje natural el contrato del inquilino |
| `connect_email_oauth` | Genera link de autorización Google o Outlook |
| `fetch_bills_email` | Busca facturas de un proveedor en el email conectado |
| `search_email_custom` | Busca por remitente custom en el email conectado |
| `get_field_requirements` | Retorna campos requeridos/opcionales de una acción |

#### Tenant Agent (`lib/whatsapp-agent.ts`)

Bot más simple para inquilinos:
- Consultar deuda
- Subir comprobante
- Hacer reclamos
- Consultar contrato
- No puede hacer acciones de gestión

---

### Service Layer (`lib/services/`)

Toda la lógica de negocio vive aquí, separada de los agentes. Los agentes son orchestradores finos.

| Archivo | Responsabilidad |
|---|---|
| `obligations.ts` | Crear, verificar, marcar proof, transicionar estado |
| `obligation-state-machine.ts` | Transiciones válidas, validación de owner, ActivityLog |
| `claims.ts` | Crear y actualizar claims con validación de transiciones |
| `rentals.ts` | Crear workspace, registrar tenant, cerrar alquiler, actualizar monto |
| `bills.ts` | Subir factura a storage, extraer datos con OpenAI, crear Obligation |
| `reminders.ts` | Enviar recordatorio al inquilino, programar, cancelar |
| `notifications.ts` | Welcome message al tenant (idempotente via `welcomeSentAt`) |
| `owner-queries.ts` | Lecturas del dashboard y del bot (overview, obligations, claims) |
| `chat-history.ts` | Cargar y guardar historial de conversación |
| `activity-log.ts` | Escritura en ActivityLog (nunca rompe el flujo si falla) |
| `validation-metrics.ts` | Métricas de validación de datos |

Todas las funciones que modifican estado devuelven `ServiceResult<T>`:

```typescript
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: "not_found" | "forbidden" | "invalid_input" | "conflict" | "missing_field" }
```

---

### Onboarding Specs (`lib/onboarding-specs.ts`)

Single source of truth para los campos requeridos y opcionales de cada acción del bot.

- `ONBOARDING_SPECS` define por acción: nombre del campo, label, tipo, si es requerido, opciones enum, condiciones dependientes, hints.
- `validateRequiredFields(action, data)` → validación server-side antes de tocar la DB
- `getFieldRequirements(action)` → usado por la tool `get_field_requirements` para que el bot sepa qué pedir antes de arrancar un wizard

Acciones cubiertas: `create_casita`, `create_recurring_charge`, `create_manual_charge`, `create_new_rental`.

---

### Procesamiento de documentos con IA

#### Facturas (PDF/imagen)
1. Owner manda foto o PDF al chat de WhatsApp
2. Twilio entrega el media URL al webhook
3. El bot descarga el archivo y llama `ingestBill()`
4. `ingestBill()` sube el archivo a Supabase Storage
5. Llama a OpenAI Vision (o file API para PDF) para extraer: proveedor, monto, período, vencimiento
6. Crea o actualiza la Obligation correspondiente
7. Detecta si el período extraído es de un mes anterior → devuelve warning al owner

#### Contratos (PDF)
1. Owner manda el PDF y menciona "contrato"
2. Bot llama `upload_contract()`
3. Se sube el archivo a `STORAGE_BUCKETS.contracts` en Supabase
4. Se actualiza `unit.contractUrl` y se crea registro en `ContractHistory`
5. Se llama `extractContractMetadata()` con OpenAI Vision para extraer: nombre del inquilino, nombre del propietario, fecha de inicio y fin
6. Se compara con los datos registrados:
   - Si el nombre no coincide con el tenant registrado → warning
   - Si el contrato está vencido → warning
   - Si la fecha de inicio es futura → warning
7. El owner puede hacer update si subió el equivocado

#### Consultas de contrato
`lib/contract-reader.ts` implementa un RAG simple:
- Extrae texto del PDF (si es imagen, OCR via OpenAI Vision)
- Guarda el texto en `unit.contractText`
- Cache invalidable en memoria para evitar re-extracciones
- El bot puede hacer preguntas en lenguaje natural sobre las cláusulas

---

### OAuth de Email

#### Flujo completo (desde WhatsApp o Dashboard)

```
1. Owner pide "conectar Gmail" por WhatsApp
   — o toca botón "Conectar con Google" en el dashboard
2. Bot / dashboard redirige a GET /api/auth/google-email/start?workspaceId=xxx
3. Server genera la URL de Google OAuth con scope gmail.readonly
4. Owner ve la pantalla de autorización de Google en el navegador
5. Acepta → Google redirige a /api/auth/google-email/callback?code=xxx&state=workspaceId
6. Server intercambia el code por refresh_token + email
7. Guarda en Workspace: emailProvider="gmail-oauth", emailAddress, emailRefreshToken (AES-256)
8. Busca el teléfono del owner en OwnerProfile y envía confirmación por WhatsApp
9. Owner vuelve a WhatsApp con el email conectado
```

Lo mismo para Outlook (`microsoft-email`). Desconectar limpia `emailRefreshToken` además de todos los demás campos.

---

### API Routes relevantes

| Route | Propósito |
|---|---|
| `POST /api/webhooks/twilio-whatsapp` | Entry point de todos los mensajes de WhatsApp |
| `POST /api/webhooks/mercadopago` | Verificación automática de pagos MP |
| `GET /api/auth/google-email/start` | Inicia OAuth de Gmail |
| `GET /api/auth/google-email/callback` | Recibe el código de Google, guarda token |
| `GET /api/auth/microsoft-email/start` | Inicia OAuth de Outlook |
| `GET /api/auth/microsoft-email/callback` | Recibe el código de Microsoft, guarda token |
| `DELETE /api/workspaces/[id]/email-connect` | Desconecta email (limpia todos los campos) |
| `POST /api/owner/phone` | Guarda teléfono del owner, envía welcome message |
| `GET /api/tenant/[token]` | Portal del inquilino (sin login) |
| `POST /api/tenant/[token]/proof` | Subida de comprobante por portal web |
| `GET /api/cron/send-reminders` | Cron de recordatorios automáticos |
| `GET /api/cron/fetch-bills` | Cron de ingesta de facturas por email |
| `GET /api/cron/owner-alerts` | Cron de alertas al owner (overdue) |

---

### Infraestructura de datos

#### Supabase Storage (buckets)
- `contracts` → PDFs de contratos
- `bills` → facturas de proveedores
- `proofs` → comprobantes de pago de inquilinos

#### Seguridad
- Contraseñas de email (IMAP legacy): AES-256 encrypted en DB
- OAuth refresh tokens: AES-256 encrypted en DB
- Twilio webhook signature verification (HMAC-SHA1)
- Token de tenant: UUID único por unidad, sin login requerido

---

### Tests

94 tests unitarios puros (sin DB, sin red, sin framework externo). Se corren con `npm test`.

| Archivo | Tests | Qué cubre |
|---|---|---|
| `obligation-state-machine.test.ts` | 55 | Todas las transiciones válidas e inválidas |
| `claims.test.ts` | 16 | Transiciones de claims |
| `bills.test.ts` | 15 | `mimeToExt`, `nextMonthLastDay` |
| `reminders.test.ts` | 8 | `selectReminderEmailType` con todos los boundary cases |

---

## 3. Decisiones Conceptuales y Aprendizajes

### El cambio más importante: de chatbot a sistema con estado

Al inicio el bot era un agente de OpenAI que hacía todo inline. Cada mensaje generaba lógica de negocio dentro del agente. Esto era:
- No testeable
- No trazable
- Difícil de debuggear
- Frágil ante cambios de prompt

La refactorización separó claramente:

| LLM decide | Sistema decide |
|---|---|
| Qué quiso decir el owner | Si la transición de estado es válida |
| Qué tool llamar | Si el owner tiene ownership de la obligación |
| Cómo redactar la respuesta | Si los campos requeridos están presentes |
| Si el contrato es sospechoso | Si el archivo se guardó correctamente |

Esto hace el sistema predecible. El LLM puede equivocarse interpretando, pero no puede poner una obligación en un estado inválido o borrar una casita sin la frase de confirmación.

---

### OwnerProfile: de acoplado a Workspace a nivel de cuenta

Al inicio el teléfono del owner vivía en cada `Workspace`. Esto generaba:
- El owner tenía que registrar su número en cada casita
- Si cambiaba el número, tenía que actualizarlo en N lugares
- El router por teléfono era complejo

Solución: `OwnerProfile` como entidad separada, 1:1 con el usuario, con el teléfono una sola vez. El owner registra su número una vez y sirve para todas sus propiedades.

---

### onboarding-specs.ts: el checklist determinístico

Problema: el LLM olvidaba pedir el CBU, o el tenant no quedaba con todos los datos necesarios.

Solución: `lib/onboarding-specs.ts` define exactamente qué campos son requeridos y opcionales para cada acción. Se usa en dos lugares:
1. **Service-side**: antes de tocar la DB, `validateRequiredFields()` verifica que llegaron los campos requeridos
2. **Bot-side**: la tool `get_field_requirements` le dice al LLM qué pedir antes de arrancar un wizard

Esto hace los onboarding flows mucho más robustos que depender solo del prompt.

---

### Normalización de teléfonos

Bug real: una tenant registrada con `+61 452 466 760` (con espacios) no era reconocida cuando escribía desde WhatsApp (`+61452466760`). 

Solución: función `normalizeWhatsApp()` que convierte cualquier formato a dígitos puros con `+` al inicio antes de guardar en DB. El router también normaliza antes de buscar.

---

### Límites de Twilio Sandbox vs Producción

Aprendizajes del testing con sandbox:
- Límite de 50 mensajes diarios por sandbox
- Límite de 1600 caracteres por mensaje → agregamos truncación en `sendWhatsApp()`
- Los participantes tienen que hacer "join [code]" para recibir mensajes
- En producción nada de esto aplica → el sandbox es solo para desarrollo

---

### max_completion_tokens y el bot silencioso

Bug sutil: el modelo `gpt-5.4-mini` usa tokens internos para razonar antes de responder. Si `max_completion_tokens` es muy bajo (500-600), el modelo termina el reasoning pero no llega a escribir la respuesta → `finish_reason: "length"` → contenido vacío.

Solución: aumentar a 2000. Y agregar un fallback: si el contenido es vacío (`""`), hacer una segunda llamada sin tools forzando respuesta de texto.

---

### OAuth dashboard vs WhatsApp: el mismo flow, dos puntos de entrada

Antes: el dashboard usaba formulario de contraseña de aplicación (IMAP). El bot usaba OAuth2.

Problema: dos sistemas paralelos, el de dashboard menos seguro (el usuario comparte credenciales).

Solución: el dashboard ahora usa los mismos botones OAuth que el bot. La ruta `/api/auth/google-email/start` acepta el click desde cualquier origen. El callback envía confirmación por WhatsApp después de guardar el token.

---

### Arquitectura de WhatsApp: respuesta asíncrona

Twilio espera respuesta en 15 segundos o reintentos. OpenAI puede tardar más. 

Solución: el webhook devuelve TwiML vacío inmediatamente (`<Response></Response>`) y procesa el mensaje de forma async. La respuesta se envía al usuario via Twilio REST API en lugar de via la respuesta del webhook.

---

### ActivityLog: trazabilidad append-only

Todo evento relevante del sistema escribe en `ActivityLog`:
- Quién lo hizo (owner, tenant, sistema, cron)
- Qué hizo (obligation.created, proof.uploaded, payment.verified, etc.)
- Por qué canal (whatsapp, dashboard, cron, api)
- Qué entidad afectó (id, tipo)
- Metadata extra (monto, estado anterior, estado nuevo, título)

El feed de actividad del dashboard lo consume. Las funciones de log están wrapeadas en try/catch para que nunca rompan el flujo principal si fallan.

---

### PRs completados (15 en total)

| PR | Objetivo |
|---|---|
| PR-01 | Kickoff y auditoría del repo, docs de specs |
| PR-02 | ActivityLog: modelo, migration, helpers, integración en puntos críticos |
| PR-03 | Service layer: obligations, claims — lógica sale de los agentes |
| PR-04 | State machine de obligations: transiciones explícitas y determinísticas |
| PR-05 | Adelgazamiento de agentes: reminders, notifications, chat-history como services |
| PR-06 | Rental lifecycle + lecturas: rentals.ts + owner-queries.ts |
| PR-07 | Bill ingestion: bills.ts, lógica de upload fuera del agente |
| PR-08 | 94 tests unitarios puros, sin framework nuevo |
| PR-09 | Dashboard activity feed: getRecentActivity + ActivityFeed component |
| PR-10 | Audit del loop crítico de cobranza, identificación de beta blockers |
| PR-11 | Beta blocker fixes: normalización de teléfonos, upsert de templates, validaciones |
| PR-12 | Validation metrics |
| PR-13 | Beta ops runbook |
| PR-14 | End-to-end smoke test |
| PR-15 | Closed beta launch pack |

---

### Estado actual del sistema

- **TypeScript errors**: 0
- **Tests**: 94 pasando
- **Bot owner**: operativo con 22 tools
- **Bot tenant**: operativo
- **OAuth email**: Google + Outlook, desde WhatsApp y dashboard
- **Dashboard**: funcional con activity feed
- **Onboarding flow**: con checklist determinístico
- **Normalización de teléfonos**: activa en todo el stack
- **Procesamiento de documentos**: facturas + contratos con AI validation
- **Backlog documentado**: edge cases y features futuras fuera del MVP

---

*Este documento refleja el estado del proyecto al cierre del ciclo de desarrollo inicial.*
