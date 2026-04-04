# Audit — Estado actual

## 1. Executive summary

Casita es hoy un **dashboard de gestión de alquileres con un bot de WhatsApp adosado**. No es todavía una "capa operativa WhatsApp-native". La ambición es correcta, la ejecución está fragmentada.

El repo tiene ~8,500 líneas de TypeScript distribuidas en 47 API routes, 30 componentes/páginas, 20 módulos de librería, y 2 agentes de IA de ~2,300 líneas combinadas. Hay código muerto significativo (~1,500+ líneas en componentes huérfanos), 3 implementaciones paralelas de ingesta de email, features parcialmente construidas (MercadoPago, n8n, claims), y cero tests.

**Lo que funciona bien:** El modelo de dominio (workspace/unit/obligation) es sólido, el onboarding es claro, y la idea de WhatsApp como canal principal es correcta para LATAM. El patrón de webhook asíncrono para Twilio está bien resuelto.

**Lo que preocupa:** Se están construyendo demasiadas cosas a la vez. El bot es un wrapper grueso de 1,601 líneas sobre OpenAI function calling que mezcla clasificación, ejecución, CRUD, y lógica de negocio en un solo archivo. No hay separación entre lo que decide el LLM y lo que decide el sistema. No hay tests. No hay observabilidad real. Hay código muerto por todos lados.

**Recomendación principal:** Recortar el 40% del código, enfocar en un solo wedge (cobranzas + seguimiento de pagos), separar clasificación de ejecución, y dejar de construir el dashboard en paralelo con el bot.

---

## 2. Qué producto tenemos hoy realmente

### Lo que es
Un panel web para propietarios argentinos con 1-5 unidades que:
- Crea "casitas" (workspaces) con cobros recurrentes
- Genera obligaciones mensuales automáticas
- Envía recordatorios por email y WhatsApp
- Permite al inquilino subir comprobantes por link seguro
- Tiene un bot de WhatsApp que puede hacer casi todo lo del dashboard vía chat

### Lo que no es (todavía)
- No es WhatsApp-native (el dashboard sigue siendo el centro de gravedad)
- No es una capa operativa (no hay workflows, no hay estado operativo vivo)
- No tiene trazabilidad real (no hay event log general)
- No automatiza el ciclo completo (requiere intervención manual en múltiples puntos)

### Jobs que resuelve hoy
1. **Recordar al inquilino que pague** (cron + email/WhatsApp) ✅
2. **Saber si pagaron** (proof upload + verificación manual) ✅ parcial
3. **Guardar boletas originales** (upload + storage) ✅
4. **Registrar cobros recurrentes** (templates) ✅
5. **Consultar estado por WhatsApp** (bot) ✅ pero frágil

### ICP real actual
Propietario argentino con 1-3 departamentos que hoy gestiona todo por WhatsApp personal, le manda fotos de boletas al inquilino, y persigue pagos manualmente.

### Flujo principal
```
Propietario crea casita → configura cobros → sube boletas mensuales
→ sistema recuerda al inquilino → inquilino paga y sube comprobante
→ propietario verifica
```

### Qué parte es valiosa
- **Modelo workspace/unit/obligation**: Simple, correcto, extensible
- **Token-based tenant access**: Cero fricción para el inquilino
- **Cron de recordatorios**: Automatización real que reduce follow-up
- **Bot owner por WhatsApp**: La dirección correcta (aunque la ejecución necesita trabajo)

### Qué parte es ruido / scope creep
- **3 providers de email** (IMAP + Gmail API + Outlook API): Demasiada superficie
- **Contract reader/RAG**: Feature secundaria que consume mucho código
- **n8n templates**: Código muerto — los agentes lo reemplazaron
- **Claims panel**: Construido pero no es el wedge
- **MercadoPago**: Parcialmente construido, parcialmente muerto
- **5+ componentes huérfanos**: dashboard-client.tsx, monthly-obligations-view.tsx, bill-upload-form.tsx, obligation-verifier.tsx, contract-manager.tsx, mercadopago-connect.tsx

---

## 3. Arquitectura actual

### Stack
| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, inline styles (mix Tailwind) |
| Backend | Next.js API routes (serverless) |
| Database | PostgreSQL vía Prisma ORM |
| Auth | Supabase Auth (magic link / OTP) |
| Storage | Supabase Storage (bills, proofs, contracts) |
| AI | OpenAI GPT-5.4-mini (agents), GPT-5.4 (contract reader) |
| Email outbound | Resend |
| Email inbound | IMAP (imapflow) + Gmail API + Outlook API |
| WhatsApp | Twilio |
| Payments | MercadoPago (parcial) |
| Cron | Vercel Cron (3 jobs) |
| Deployment | Vercel |

### Diagrama de alto nivel
```
                    ┌─────────────┐
                    │   Twilio     │
                    │  WhatsApp    │
                    └──────┬──────┘
                           │ POST webhook
                    ┌──────▼──────┐
                    │  route.ts   │──→ phone-router ──→ owner? / tenant?
                    │  (webhook)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
     ┌────────────────┐      ┌──────────────────┐
     │  owner-agent   │      │  whatsapp-agent   │
     │  (1601 líneas) │      │  (725 líneas)     │
     │  OpenAI FC     │      │  OpenAI FC        │
     │  ~25 tools     │      │  ~6 tools         │
     └───────┬────────┘      └────────┬──────────┘
             │                        │
             ▼                        ▼
     ┌───────────────┐       ┌────────────────┐
     │    Prisma      │       │    Prisma      │
     │  PostgreSQL    │       │  PostgreSQL    │
     └───────────────┘       └────────────────┘
             │
    ┌────────┼────────────────────┐
    ▼        ▼                    ▼
 Supabase  Resend   Twilio REST   Gmail/Outlook/IMAP
 Storage   Email    (reply)       (bill fetch)
```

### Entradas al sistema
1. **Dashboard web** (owner, auth Supabase)
2. **WhatsApp inbound** (owner + tenant, via Twilio webhook)
3. **Tenant portal** (/t/[token], sin auth, capability URL)
4. **Cron jobs** (Vercel, 3 schedules)
5. **OAuth callbacks** (Google/Microsoft email)
6. **MercadoPago webhook** (payment notifications)
7. **n8n webhook** (bill ingestion — legacy)

### API routes: 47 totales
- 16 de CRUD de dominio (workspaces, properties, units, contacts, obligations, templates)
- 8 de configuración (email, MP, WhatsApp, n8n)
- 5 de tenant operations (portal, proof, note)
- 4 de cron
- 4 de OAuth
- 3 de webhooks (Twilio, n8n, MP)
- 3 de bills (extract, upload, monthly-bill)
- 2 de reminders
- 2 de test/dev

---

## 4. Modelo de dominio actual

### Entidades (Prisma schema — 297 líneas)

```
Workspace (casita)
  ├── ownerPhone, emailProvider, emailAddress, emailEncryptedPassword
  ├── emailRefreshToken, mpAccessTokenEncrypted, mpPaymentLink
  ├── n8nWebhookUrl, n8nSecret
  └── Property (propiedad física)
       └── Unit (período de alquiler)
            ├── tenantToken, contractUrl, contractText, leaseEndDate
            ├── TenantContact (fullName, email, whatsapp, dni)
            ├── ObligationTemplate (cobro recurrente)
            │    └── type, providerSlug, amount, dueDay, billingPeriod
            │         reminderDays, reminderChannel, ingestionMode
            ├── Obligation (cobro mensual concreto)
            │    └── title, amount, dueDate, status, originalBillUrl
            │         proofUrl, proofUploadedAt, mpPreferenceId, mpPaymentLink
            └── Claim (reclamo)
                 └── description, status, imageUrls, createdAt

ChatMessage (historial de conversación por teléfono)
ScheduledReminder (recordatorios programados por el owner)
NotificationLog (dedup de notificaciones por obligación)
MessageDeliveryLog (log de entregas email/whatsapp)
```

### Observaciones sobre el modelo
- **Property es redundante hoy**: Solo hay 1 property por workspace, 1 unit por property. La jerarquía Workspace → Property → Unit agrega complejidad sin beneficio actual.
- **ChatMessage es global por teléfono**: No está scoped a workspace/unit. Si un owner tiene 3 casitas, la conversación es una sola.
- **No hay Activity/Event log**: Los cambios de estado no quedan registrados. Solo hay NotificationLog (para dedup de envíos) y DeliveryLog (para email/WA).
- **Workspace acumula demasiado**: Email creds, MP tokens, n8n config, WhatsApp settings — todo en una tabla. Es un "god object".
- **Claim es básico**: Solo texto + imágenes + status. No tiene assigned_to, priority, category, resolution, ni timeline.

---

## 5. Flujos actuales

### Flujo 1: Onboarding
```
Landing → Magic Link → Onboarding Wizard (4 pasos)
→ Crea workspace + property + unit + tenant + template
→ Envía bienvenida (email + WhatsApp)
→ Upload contrato (opcional)
→ Redirect a dashboard
```
**Estado: ✅ Funciona bien. Es el flujo más pulido.**

### Flujo 2: Gestión mensual (dashboard)
```
Owner abre dashboard → ve mes actual
→ Para cada template: sube boleta o ingresa monto manual
→ Sistema crea/actualiza obligation
→ Cron envía recordatorio al inquilino
→ Inquilino entra por /t/[token] y sube comprobante
→ Owner verifica en dashboard
```
**Estado: ✅ Funciona. UnitEditor es complejo (1800+ líneas) pero operativo.**

### Flujo 3: Bot owner (WhatsApp)
```
Owner escribe por WhatsApp → Twilio webhook
→ phone-router identifica como owner
→ owner-agent.ts procesa con OpenAI function calling
→ ~25 tools disponibles (CRUD completo + email fetch + contract Q&A)
→ Responde por Twilio REST API
```
**Estado: ⚠️ Funciona pero frágil. 1601 líneas monolíticas. Toda la lógica de negocio está dentro de las tools del agente. Sin tests.**

### Flujo 4: Bot tenant (WhatsApp)
```
Inquilino escribe → phone-router identifica como tenant
→ whatsapp-agent.ts procesa con OpenAI function calling
→ ~6 tools (obligations, proof upload, claims, contract Q&A)
→ Responde por Twilio REST API
```
**Estado: ⚠️ Similar. 725 líneas. Duplica patrones del owner-agent.**

### Flujo 5: Email ingestion
```
Owner conecta email (IMAP o OAuth) → configura templates con providerSlug
→ "Buscar facturas" (manual o cron)
→ Sistema busca emails por sender patterns
→ Descarga adjuntos → OpenAI Vision extrae datos
→ Crea/actualiza obligation con monto y bill URL
→ Notifica al inquilino
```
**Estado: ⚠️ 3 implementaciones paralelas (IMAP 687 líneas + Gmail API 255 líneas + Outlook API ~similar). Funciona pero es mucha superficie.**

### Flujo 6: Recordatorios automáticos
```
Cron diario (11am UTC) → revisa obligations con dueDate cercano
→ Envía email (Resend) según template config
→ NotificationLog evita duplicados
```
**Estado: ✅ Funciona. Simple y efectivo.**

### Flujo 7: Pagos MercadoPago
```
Owner configura MP link → sistema genera preference por obligation
→ Tenant ve link de pago en portal
→ MP webhook marca obligation como verified
```
**Estado: ⚠️ Parcialmente construido. Webhook sin verificación de firma. Rutas duplicadas.**

---

## 6. Qué sirve

| Cosa | Por qué sirve | Nivel |
|------|---------------|-------|
| Modelo workspace/unit/obligation | Base sólida, simple, extensible | ⭐⭐⭐⭐⭐ |
| Tenant token (capability URL) | Cero fricción para el inquilino | ⭐⭐⭐⭐⭐ |
| Onboarding wizard | Flujo limpio y completo | ⭐⭐⭐⭐ |
| Cron de recordatorios | Automatización real que elimina trabajo manual | ⭐⭐⭐⭐ |
| Webhook asíncrono Twilio | Buena ingeniería, resuelve el timeout | ⭐⭐⭐⭐ |
| Phone router | Simple y efectivo | ⭐⭐⭐⭐ |
| Supabase storage adapter | Limpio, reutilizable | ⭐⭐⭐⭐ |
| Template → obligation generation | Automatización core del producto | ⭐⭐⭐⭐ |
| Bill extraction (OpenAI Vision) | Ahorra tiempo real al owner | ⭐⭐⭐ |
| Error handling en agentes | try/catch global con fallback message | ⭐⭐⭐ |

---

## 7. Qué sobra

| Cosa | Por qué sobra | Acción |
|------|---------------|--------|
| `lib/n8n-templates.ts` (257 líneas) | Los agentes in-app reemplazaron a n8n. Código muerto. | **Borrar** |
| `components/dashboard-client.tsx` (540 líneas) | No se importa en ningún lado. Legacy/dev. | **Borrar** |
| `components/monthly-obligations-view.tsx` (714 líneas) | No se importa. Duplica UnitEditor. | **Borrar** |
| `components/bill-upload-form.tsx` (~400 líneas) | No se importa. Funcionalidad duplicada. | **Borrar** |
| `components/obligation-verifier.tsx` | No se importa. | **Borrar** |
| `components/contract-manager.tsx` | No se importa. Superseded por WorkspaceSettings. | **Borrar** |
| `components/mercadopago-connect.tsx` | No se importa. | **Borrar o conectar** |
| `app/api/reminders/send/route.ts` | Sin referencias. Superseded por cron routes. Abierto sin CRON_SECRET. **Riesgo de seguridad.** | **Borrar** |
| `app/api/test/send-reminder/route.ts` | Solo dev. Throws en producción. | **Aceptable pero marcar** |
| `docs/n8n-whatsapp-bot-mvp.workflow.json` | Legacy n8n workflow. | **Archivar o borrar** |
| Código muerto en `dashboard/[workspaceId]/page.tsx` | ~230 líneas de componentes no usados (Section, ObligationRow, etc.) | **Borrar** |
| `@google/generative-ai` dependency | No se usa (todo es OpenAI ahora) | **Desinstalar** |

**Total estimado de código muerto: ~2,400 líneas** (~28% del codebase activo).

---

## 8. Dónde nos estamos complicando al pedo

### 1. Tres implementaciones de email ingestion
`mail-fetcher.ts` (IMAP, 687 líneas) + `gmail-api.ts` (255 líneas) + `outlook-api.ts` → El ICP usa Gmail. Punto.

**Simplificación:** Solo Gmail OAuth. Borrar IMAP y Outlook. Recuperar ~900 líneas.

### 2. El owner-agent es un monolito de 1,601 líneas
25 tools, system prompt gigante, CRUD directo a Prisma, lógica de negocio, envío de emails/WhatsApp, media download, bill extraction — todo mezclado en UN archivo.

**Simplificación:** Separar en classifier (qué quiere hacer) + executor (cómo se hace). Las tools deberían llamar a servicios, no implementar lógica inline.

### 3. Dashboard Y WhatsApp al mismo tiempo
Se están construyendo dos interfaces completas en paralelo. El dashboard tiene ~3,500 líneas de componentes. El bot tiene ~2,300 líneas. Son dos productos.

**Simplificación:** Si el producto es WhatsApp-native, el dashboard debería ser read-only status view. No más wizards ni forms en el dashboard que dupliquen lo que hace el bot.

### 4. Contract RAG con OpenAI Vision
166 líneas dedicadas a leer PDFs de contratos y responder preguntas. Es un feature cool pero secundario. Nadie va a comprar Casita por poder preguntarle cosas a su contrato.

**Simplificación:** Postergar. Si un inquilino pregunta sobre el contrato, responder "Consultá con tu propietario" o linkear al PDF. No necesitamos RAG para el MVP.

### 5. Claims system
Un sistema de reclamos con panel, status transitions, API routes. Pero el claim no tiene categorización, prioridad, asignación, ni workflow. Es un TODO list glorificado.

**Simplificación:** Postergar como feature separada. Los reclamos hoy pueden ser un simple mensaje al owner por WhatsApp que queda en el historial de chat.

### 6. Uso excesivo de LLM para cosas determinísticas
El bot usa OpenAI para decidir: "¿El owner quiere ver sus cobros?" → llama tool `get_obligations`. Esto podría ser un intent classifier + switch statement. No necesitás un LLM para ejecutar `prisma.obligation.findMany()`.

**El LLM debería:**
- Interpretar lenguaje natural ambiguo
- Clasificar intención
- Redactar respuestas naturales
- Resumir información

**El LLM NO debería:**
- Decidir qué status poner
- Construir queries
- Manejar state transitions
- Tomar decisiones de negocio

### 7. Provider catalog estático de 298 líneas
Una lista hardcoded de proveedores argentinos con sender patterns. Es mantenimiento manual que escala mal.

**Simplificación:** Empezar con los top 5 (Edenor, Metrogas, AySA, Telecentro + expensas genérico). Expandir cuando sea necesario.

### 8. gemini.ts se llama Gemini pero usa OpenAI
Confusión para cualquiera que lea el código. El package `@google/generative-ai` sigue instalado sin usarse.

**Simplificación:** Renombrar a `bill-extractor.ts`. Desinstalar `@google/generative-ai`.

### 9. Workspace como god object
Workspace tiene: email creds (provider, address, encrypted password, refresh token, IMAP host/port, connected date), MP tokens, n8n config, WhatsApp settings, owner phone — todo en una tabla.

**Simplificación:** Aceptable para el MVP, pero documentar que es deuda técnica. Si se escala, separar en EmailConnection, PaymentConfig, etc.

### 10. 47 API routes
Muchas son CRUD simple que el agente duplica con Prisma directo. Si el producto es WhatsApp-first, ¿necesitamos `POST /api/obligations/manual` Y una tool `create_manual_charge`?

**Simplificación:** Las API routes son para el dashboard. Si el dashboard se simplifica a read-only, muchas routes se pueden borrar.

---

## 9. Riesgos actuales

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|------------|
| **LLM clasifica mal y ejecuta acción incorrecta** (ej: borra una casita, cambia un status) | 🔴 Alto | 🟡 Media | Separar clasificación de ejecución. Confirmación para acciones destructivas. El LLM NO ejecuta, solo clasifica. |
| **Secrets leakeados al frontend** (`serializeWorkspace` spread incluye encrypted passwords, refresh tokens) | 🔴 Alto | 🟡 Media | Explicit `select` en queries que van al cliente. Nunca spread. |
| **MercadoPago webhook sin verificación de firma** | 🔴 Alto | 🟡 Media | Implementar verificación de `x-signature` de MP. |
| **OAuth start routes sin verificar ownership** (cualquiera con un workspaceId puede iniciar OAuth) | 🟡 Medio | 🟡 Media | Agregar auth check o signed state parameter. |
| **0 tests** | 🟡 Medio | 🔴 Alta | Al menos tests de las state transitions de obligations y del phone router. |
| **Costo de OpenAI descontrolado** (GPT-5.4 para contract reader, 5.4-mini para cada mensaje) | 🟡 Medio | 🟡 Media | Rate limiting por usuario. Caché agresivo. Prompts más cortos. |
| **Phone matching ambiguo** (`contains` en phone-router, sin orden determinístico) | 🟡 Medio | 🟡 Media | Exact match con normalización consistente. |
| **Twilio sandbox limit** (50 msgs/día) | 🟡 Medio | 🔴 Alta (ya pasó) | Migrar a Twilio production WhatsApp Business. |
| **Código muerto acumula confusión** (~2,400 líneas) | 🟠 Bajo-medio | 🔴 Alta | Limpiar. Un PR de limpieza. |
| **Un solo dev, muchos frentes abiertos** | 🟡 Medio | 🔴 Alta | Reducir scope. Un wedge. Ship it. |
| **`/api/reminders/send` abierto sin CRON_SECRET`** | 🔴 Alto | 🟡 Media | Borrar la ruta (superseded). |

---

## 10. Oportunidades claras

1. **El wedge de cobranzas por WhatsApp es fuerte.** "Dejá de perseguir inquilinos. Casita cobra por vos." Es una frase que un propietario argentino entiende y valora.

2. **El ciclo recordatorio → pago → comprobante → verificación es automatable al 80%.** Hoy está al ~50%. Completar ese ciclo con WhatsApp-native es diferenciación real.

3. **El modelo de dominio ya está.** No hay que reinventar la base. Workspace/Unit/Obligation funciona.

4. **Token-based tenant access es gold.** Cero fricción. El inquilino no necesita bajar nada ni crear cuenta. Eso es LATAM-compatible.

5. **WhatsApp como canal para owners chicos es inmejorable.** No van a abrir un dashboard todos los días. Sí van a responder un WhatsApp.

6. **Datos operativos como moat futuro.** Si Casita gestiona miles de alquileres, tiene data sobre: patrones de pago, mora por zona, estacionalidad, proveedores — eso es valioso.

---

# Next Level Proposal

## 11. Producto / categoría recomendada

**Categoría:** Plataforma de operaciones de alquileres por WhatsApp para LATAM.

**Frase:** "Casita gestiona tu alquiler por WhatsApp. Cobra, recuerda, rastrea y verifica — sin perseguir a nadie."

**No es:** Un chatbot. No es un dashboard. No es un ERP. Es una **capa operativa que convierte mensajes en estado y acciones trazables**.

---

## 12. ICP recomendado

**Propietario argentino con 1-5 departamentos en alquiler** que:
- Gestiona todo por WhatsApp personal
- Pierde tiempo persiguiendo pagos cada mes
- No tiene sistema (usa memoria, notas, fotos en el chat)
- Quiere algo simple, no un software enterprise
- Tiene relación directa con los inquilinos (no usa administración)

**Tier 2 (después):** Administradores chicos (5-20 unidades) que necesitan escalar sin contratar gente.

---

## 13. Wedge recomendado

### **Cobranzas y seguimiento de pagos por WhatsApp**

| Criterio | Score | Por qué |
|----------|-------|---------|
| **Frecuencia** | ⭐⭐⭐⭐⭐ | Mensual por cada cobro. Es el loop más frecuente. |
| **Dolor** | ⭐⭐⭐⭐⭐ | "Perseguir pagos" es el #1 pain point de todo propietario. |
| **Urgencia** | ⭐⭐⭐⭐⭐ | Plata. Siempre es urgente. |
| **Disposición a pagar** | ⭐⭐⭐⭐ | "Si me ahorra perseguir pagos, pago." |
| **Expansión** | ⭐⭐⭐⭐⭐ | Desde cobranzas → reclamos → mantenimiento → coordinación. Natural. |

**Ciclo core del wedge:**
```
Template recurrente configurado
  → Día del mes: sistema genera obligation
  → reminder_days antes: WhatsApp al inquilino
  → Inquilino paga y sube comprobante (por WhatsApp o portal)
  → Sistema notifica al owner
  → Owner verifica (o auto-verifica si MP)
  → Obligation → verified
  → Si no paga: follow-up automático escalado
```

**Alternativas descartadas:**
- **Reclamos/mantenimiento:** Menos frecuente, menos urgente, más difícil de automatizar
- **Inbox unificado:** Suena bien pero es un feature, no un wedge. No resuelve un dolor específico.
- **Coordinación de proveedores:** Fase posterior. Requiere red de proveedores que no tenemos.

---

## 14. Arquitectura recomendada

### Principio rector
```
Mensaje → Clasificación (AI) → Acción determinística (sistema) → Estado explícito → Respuesta (AI)
```

El LLM **interpreta y redacta**. El sistema **decide y ejecuta**.

### Componentes
```
┌─────────────────────────────────────────┐
│              WhatsApp (Twilio)           │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Message Router                  │
│  phone-router → owner / tenant / unknown │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Intent Classifier (LLM)         │
│  "quiero ver mis cobros" → GET_OBLIG    │
│  "pagué el alquiler" → UPLOAD_PROOF     │
│  "hay una gotera" → CREATE_CLAIM        │
│  Input: mensaje + contexto mínimo       │
│  Output: { intent, params, confidence } │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Action Executor (deterministic) │
│  switch(intent) → service function      │
│  Validación explícita                   │
│  State transitions controladas          │
│  Event log de cada acción               │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Response Composer (LLM)         │
│  Datos + contexto → mensaje natural     │
│  Formato WhatsApp-friendly              │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Twilio REST API (send)          │
└─────────────────────────────────────────┘
```

### Por qué este diseño
- **Classifier separado:** Si clasifica mal, no ejecuta nada peligroso. Solo dice "no entendí".
- **Executor determinístico:** Las state transitions son código, no prompts. Testeables. Predecibles.
- **Composer separado:** Puede cambiar de tono, idioma, formato sin tocar la lógica.
- **Event log:** Cada acción queda registrada. Auditable.

### Stack simplificado
- **Next.js** (API routes + páginas mínimas)
- **Prisma + PostgreSQL** (Supabase)
- **OpenAI** (classifier + composer, ambos con gpt-5.4-mini)
- **Twilio** (WhatsApp)
- **Resend** (email fallback)
- **Supabase Storage** (archivos)
- **Vercel** (deploy + cron)

**Sacar:** IMAP, Outlook API, n8n, contract RAG, MercadoPago (postpone).

---

## 15. Dominio y estados recomendados

### Entidades core (simplificadas)

```
Workspace (casita)
  └── Unit (alquiler activo)
       ├── TenantContact
       ├── ObligationTemplate (cobro recurrente)
       └── Obligation (cobro del mes)

ActivityLog (evento por acción — nuevo)
```

**Eliminar Property como entidad separada.** Hoy es 1:1 con Workspace. Si en el futuro hay multi-property, se agrega. No antes.

### State machine: Obligation

```
                  ┌──────────┐
                  │ upcoming │ (generado, antes de vencimiento)
                  └────┬─────┘
                       │ dueDate - reminderDays
                  ┌────▼─────┐
                  │ reminded │ (recordatorio enviado)
                  └────┬─────┘
                       │ dueDate
                  ┌────▼─────┐
                  │ pending  │ (vencimiento hoy/pasado, sin pago)
                  └────┬─────┘
                       │
            ┌──────────┼───────────┐
            │                      │
       ┌────▼──────┐         ┌────▼─────┐
       │ overdue   │         │ proof_   │ (comprobante subido)
       │           │         │ uploaded │
       └────┬──────┘         └────┬─────┘
            │                     │
            │                ┌────▼─────┐
            └───────────────►│ verified │ (owner confirmó)
                             └──────────┘
                                  │
                             ┌────▼──────┐
                             │ cancelled │ (excepcional)
                             └───────────┘
```

**Cada transición genera un ActivityLog.**

### State machine: Claim (si se implementa)

```
open → in_progress → resolved
         └──────────→ escalated (futuro)
```

### ActivityLog (nuevo — tabla recomendada)

```sql
ActivityLog
  id         String
  workspaceId String
  unitId     String?
  actorType  "owner" | "tenant" | "system" | "cron"
  actorId    String
  action     String -- "obligation.created", "obligation.proof_uploaded", etc.
  metadata   Json   -- datos relevantes
  channel    "whatsapp" | "dashboard" | "cron" | "api"
  createdAt  DateTime
```

---

## 16. Qué hace AI vs qué hace lógica determinística

### AI hace (LLM)
| Tarea | Por qué AI |
|-------|-----------|
| Interpretar mensaje de texto libre | Lenguaje natural, ambigüedad, español informal |
| Clasificar intención | "pagué" vs "cuánto debo" vs "se rompió el caño" |
| Extraer datos de mensajes | "pagué 150k ayer" → { amount: 150000, date: yesterday } |
| Extraer datos de boletas (Vision) | Foto/PDF → { amount, dueDate, provider } |
| Redactar respuestas naturales | Formatear datos en español amigable |
| Resumir historial | "Tu inquilino pagó 3 de 4 cobros este mes" |

### Sistema hace (código determinístico)
| Tarea | Por qué sistema |
|-------|----------------|
| Crear/actualizar obligation | State transition controlada |
| Cambiar status de obligation | Validación explícita de transiciones válidas |
| Enviar recordatorio | Cron + reglas de negocio |
| Verificar pago | Owner approval o auto-verify con MP |
| Generar obligations mensuales | Template → obligation, lógica pura |
| Routing de mensajes | Phone → owner/tenant, determinístico |
| Persistir archivos | Upload a storage, sin AI |
| Enviar notificaciones | Email/WhatsApp con template, sin AI |
| Validar permisos | Owner solo ve sus casitas, tenant solo ve su unidad |
| Calcular estados derivados | Mora, días de atraso, totales |

### Zona gris (empezar determinístico, iterar)
| Tarea | Recomendación |
|-------|--------------|
| Follow-up automático de mora | Empezar con reglas (3 días sin pago → recordar). Iterar con AI después. |
| Clasificación de reclamos | Empezar manual. AI después. |
| Sugerencia de aumento de alquiler | No construir. |

---

## 17. Herramientas / actions recomendadas

### Owner (prioridad alta — wedge)
| Action | Tipo | Descripción |
|--------|------|-------------|
| `get_overview` | Read | Ver casitas, cobros del mes, estados |
| `get_obligations` | Read | Listar cobros por mes/status |
| `verify_payment` | Write | Confirmar pago de una obligation |
| `upload_bill` | Write | Subir boleta (con extracción AI) |
| `send_reminder` | Write | Enviar recordatorio manual al inquilino |
| `create_charge` | Write | Crear cobro puntual |
| `get_tenant_info` | Read | Ver datos del inquilino |

### Owner (prioridad media — post-wedge)
| Action | Tipo | Descripción |
|--------|------|-------------|
| `update_rent` | Write | Actualizar monto de alquiler |
| `fetch_bills_email` | Write | Buscar facturas en Gmail |
| `schedule_reminder` | Write | Programar recordatorio futuro |
| `get_claims` | Read | Ver reclamos del inquilino |
| `update_claim` | Write | Cambiar status de reclamo |

### Owner (postergar)
| Action | Razón para postergar |
|--------|---------------------|
| `create_casita` | Raro hacerlo por WhatsApp, mejor onboarding web |
| `delete_casita` | Peligroso, solo web |
| `start_rental` / `end_rental` | Infrecuente, mejor web |
| `ask_contract` | Edge use case |
| `connect_email_oauth` | Setup, mejor web |

### Tenant
| Action | Tipo | Descripción |
|--------|------|-------------|
| `get_my_obligations` | Read | Ver qué debo este mes |
| `upload_proof` | Write | Subir comprobante de pago |
| `create_claim` | Write | Registrar reclamo |
| `get_payment_info` | Read | Ver CBU / alias / link de pago |

---

## 18. Human-in-the-loop y approvals

### Automático (sin aprobación)
- Generar obligations mensuales desde templates
- Enviar recordatorios programados
- Clasificar intención del mensaje
- Guardar comprobante subido por inquilino
- Registrar reclamo del inquilino
- Notificar al owner de nuevo comprobante

### Requiere aprobación del owner
- Verificar un pago como "pagado"
- Cambiar monto de alquiler
- Crear nuevo cobro recurrente
- Terminar alquiler
- Borrar casita
- Enviar mensaje masivo

### Requiere confirmación explícita en el chat
- Acciones destructivas: "¿Seguro que querés borrar esta casita? Escribí SI BORRAR"
- Cambios de monto: "¿Confirmo actualizar el alquiler a $XXX? Respondé Sí"

### Sistema decide (sin humano)
- State transitions automáticas: upcoming → reminded (por cron)
- Detección de mora: pending + overdue (por fecha)
- Follow-up de mora: recordatorio escalonado automático
- Dedup de notificaciones

---

## 19. Simplificación radical

### "Si quisiéramos que esto sea 50% más simple"

#### Borrar ahora (~2,400 líneas)
- `components/dashboard-client.tsx` (540)
- `components/monthly-obligations-view.tsx` (714)
- `components/bill-upload-form.tsx` (400)
- `components/obligation-verifier.tsx` (~80)
- `components/contract-manager.tsx` (~60)
- `lib/n8n-templates.ts` (257)
- `docs/n8n-whatsapp-bot-mvp.workflow.json`
- Código muerto en `dashboard/[workspaceId]/page.tsx` (230)
- Dependencia `@google/generative-ai`

#### Postergar (sacar de scope activo)
- **Outlook API** (`lib/outlook-api.ts`, `microsoft-oauth.ts`, routes Microsoft) — El ICP usa Gmail
- **IMAP** (`lib/mail-fetcher.ts` 687 líneas, `email-connect.tsx` IMAP path) — Gmail OAuth es suficiente
- **Contract RAG** (`lib/contract-reader.ts` 166 líneas, tool `ask_contract` en ambos agentes)
- **Claims panel completo** — Reducir a "registrar reclamo" simple
- **MercadoPago** — Posponer hasta tener tracción. CBU/alias es suficiente para Argentina hoy
- **n8n** — No es necesario si los agentes están in-app
- **Dashboard forms de write** — Hacer el dashboard solo de lectura. Todo write por WhatsApp o onboarding

#### Fusionar
- **owner-agent.ts + whatsapp-agent.ts:** Compartir la lógica de tools (services), separar solo el system prompt y el set de tools disponibles
- **Property + Unit conceptualmente:** No borrar de DB, pero dejar de exponer Property como entidad separada en la UI

#### Convertir en manual (temporalmente)
- **Bill ingestion:** En vez de IMAP/Gmail automático, el owner reenvía la boleta por WhatsApp. El bot la procesa con Vision. Más simple, más WhatsApp-native.
- **Aumento de alquiler:** El owner actualiza por WhatsApp diciendo "actualizá el alquiler a $250.000". No necesita un form.

#### No construir todavía
- Multi-tenant roles (admin, viewer)
- CSV export
- Rent history analytics
- Provider marketplace
- Autopay
- Legal document generation
- Notificaciones push
- App mobile nativa

---

## 20. Roadmap 30 / 60 / 90 días

### Días 1-30: "El cobrador automático"

**Objetivo:** Un propietario puede configurar una casita y el sistema cobra por WhatsApp sin intervención manual.

- [ ] Limpiar código muerto (2,400 líneas)
- [ ] Renombrar `gemini.ts` → `bill-extractor.ts`
- [ ] Desinstalar `@google/generative-ai`
- [ ] Fix security: `serializeWorkspace` no debe leakear secrets
- [ ] Fix security: Borrar `/api/reminders/send` (ruta abierta)
- [ ] Migrar a Twilio production WhatsApp Business
- [ ] Agregar ActivityLog (tabla + escritura en state transitions clave)
- [ ] Refactor owner-agent: extraer tools a service functions reutilizables
- [ ] Tests: phone-router, obligation state transitions, tool functions clave
- [ ] Follow-up automático de mora: cron que re-envía si obligation es overdue > 3 días
- [ ] Owner onboarding → primer recordatorio → primer ciclo de cobro COMPLETO por WhatsApp
- [ ] Demo video de 2 minutos

### Días 31-60: "Más inteligente, más confiable"

**Objetivo:** El sistema maneja edge cases, es más confiable, y el owner confía en dejar las cobranzas en automático.

- [ ] Separar classifier / executor / composer en el agente
- [ ] Rate limiting por teléfono (anti-abuse)
- [ ] Gmail OAuth para bill ingestion (solo Gmail, bien hecho)
- [ ] Bill ingestion por WhatsApp (owner reenvía foto → Vision → crea obligation)
- [ ] Dashboard read-only: estados, historial, métricas simples
- [ ] Confirmaciones para acciones destructivas en el bot
- [ ] Observabilidad: logs estructurados de cada interacción bot
- [ ] Error handling mejorado con retry + dead letter

### Días 61-90: "Expandir el wedge"

**Objetivo:** Agregar las features que los primeros usuarios pidan + empezar a cobrar.

- [ ] Claims/reclamos simple (registrar + notificar, sin workflow complejo)
- [ ] Multi-casita mejorado (el owner gestiona 3-5 casitas desde un chat)
- [ ] Métricas owner: % de cobro, días promedio de pago, mora por inquilino
- [ ] MercadoPago como canal de pago (si hay demanda)
- [ ] Pricing: plan gratuito (1 casita) + plan pago (3+ casitas)
- [ ] Landing page con social proof
- [ ] Onboarding simplificado: crear casita en 3 mensajes de WhatsApp

---

## 21. Qué NO construir todavía

| Feature | Por qué no |
|---------|-----------|
| App mobile nativa | WhatsApp ES la app |
| Multi-role (admin, viewer, accountant) | Solo owners por ahora |
| Autopay / débito automático | Regulatoria + complejidad. CBU manual funciona. |
| Contract generation / legal | Liability. No somos legales. |
| Accounting / tax integration | No somos contadores. |
| Provider marketplace | Necesitamos red de proveedores que no tenemos. |
| CSV/Excel export | Nadie lo va a usar en el MVP. |
| Push notifications | WhatsApp ES push. |
| Email marketing | No somos marketing. |
| AI scheduling / calendar | Scope creep. |
| Multi-country (más allá de Argentina) | Un país bien primero. |
| Outlook email ingestion | Gmail cubre >80% del ICP. |
| IMAP email ingestion | Gmail OAuth es mejor UX. |
| Contract RAG | Cool pero no mueve la aguja. |
| n8n integration | Los agentes in-app lo reemplazaron. |

---

## 22. Qué podría ser moat real

### Lo que cualquiera puede copiar
- Un bot de WhatsApp con OpenAI function calling
- CRUD de obligaciones
- Recordatorios automáticos
- Subida de comprobantes
- Bill extraction con Vision

**Estos son table stakes, no moat.**

### Lo que suena bien pero no es moat
- "AI-powered" — Todo el mundo dice eso
- "WhatsApp integration" — Twilio API es pública
- "Automación de cobros" — Un cron job no es moat

### Lo que SÍ podría volverse moat real

| Moat potencial | Por qué | Timeline |
|----------------|---------|----------|
| **Estado operativo estructurado por unidad** | Si cada alquiler tiene un "digital twin" con estado vivo, historial, y workflows — eso es infraestructura que crece con el uso. Difícil de replicar una vez que tiene data. | 6-12 meses |
| **Historial conversacional como memoria operativa** | Cada conversación alimenta el contexto. El sistema "sabe" que Juan siempre paga el 10, que María pide extensión cada 3 meses. Eso es data que no se puede comprar. | 12+ meses |
| **Playbooks operativos de alquileres LATAM** | Cómo cobrar en Argentina (CBU, MP, efectivo), cuándo recordar, cómo escalar mora, qué decir legalmente. Conocimiento de dominio codificado. | 6+ meses |
| **Network de proveedores (futuro)** | Si conectamos plomeros, electricistas, administraciones — el owner no se va. Lock-in por conveniencia. | 12-18 meses |
| **Datos operativos agregados** | Patrones de pago por zona, estacionalidad, benchmarks de alquiler. Valor para owners, inmobiliarias, y fintech. | 18+ meses |

**El moat más realista a corto plazo:** Estado operativo + historial conversacional. Cada mes que un owner usa Casita, más difícil es irse. El sistema aprende del patrón de cada inquilino.

---

## 23. Recomendación final brutalmente honesta

### Lo bueno
Casita tiene una intuición de producto **correcta**. El dolor es real. El canal (WhatsApp) es correcto para LATAM. El modelo de dominio base es sólido. El onboarding funciona. Hay momentum de desarrollo.

### Lo preocupante
Se está construyendo **demasiado, demasiado rápido, sin foco**. Hay 3 formas de ingerir emails, 2 interfaces completas (dashboard + bot), un sistema de reclamos sin terminar, integración de pagos sin terminar, contract RAG, n8n muerto — y 0 tests.

El bot de WhatsApp es un **monolito de 1,600 líneas** donde el LLM decide todo: desde qué query hacer a Prisma hasta si borrar una casita. Eso no es "AI-powered operations" — es "pray the LLM doesn't hallucinate a DELETE".

### Qué haría yo en las próximas 2 semanas

1. **Día 1:** Borrar 2,400 líneas de código muerto. Un PR, merge, done.
2. **Día 2-3:** Fix security issues (serializeWorkspace, reminders/send route, MP webhook).
3. **Día 3-5:** Extraer las tools del owner-agent a service functions. Cada tool llama a un servicio con validación explícita. El agente solo interpreta y despacha.
4. **Día 5-7:** Agregar ActivityLog. Cada state transition de obligation queda registrada.
5. **Día 7-10:** Completar el ciclo de cobro end-to-end por WhatsApp. Owner configura → sistema recuerda → inquilino paga → owner verifica → done.
6. **Día 10-12:** Tests para phone-router, obligation transitions, y services extraídos.
7. **Día 12-14:** Twilio production + demo video.

### La pregunta que deberías hacerte

> "Si un propietario me paga $5,000/mes por casita, ¿qué tiene que pasar para que sienta que le ahorro más de eso en tiempo y dolor?"

La respuesta es: **que no tenga que perseguir pagos**. Todo lo demás es nice-to-have.

Enfocate en eso. Ship eso. Vendé eso. El resto viene después.
