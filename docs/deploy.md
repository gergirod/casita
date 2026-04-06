# Casita — Sandbox → Producción

Guía completa para llevar Casita de desarrollo local (Twilio sandbox) a producción real.

---

## Resumen del camino

```
Sandbox local  →  Deploy Vercel  →  WhatsApp Business  →  Beta live
   (dev)           (~30 min)         (1-7 días espera)     (🟢)
```

El bloqueante más largo es la aprobación de WhatsApp Business por Meta. Todo lo demás se puede hacer en un par de horas. **Recomendación: iniciá el trámite de WhatsApp Business primero**, mientras terminás de preparar el resto.

---

## Fase 1 — Meta Business Manager (prerequisito para WhatsApp)

> Podés saltear esto si ya tenés un Business Manager.

### 1.1 Crear el Business Manager
1. Ir a [business.facebook.com](https://business.facebook.com)
2. Click "Crear cuenta" → completar nombre del negocio, nombre y email
3. Verificar el email

Eso es todo. **En la mayoría de los casos no hace falta verificación con documentos.**

> Meta puede pedirte verificación adicional (extracto bancario, factura de servicio) solo si tu cuenta tiene historial raro o si querés escalar a más de 1.000 conversaciones/día — irrelevante para la beta. Si te lo pide, cualquier documento a nombre tuyo sirve. Si no te lo pide, seguí.

---

## Fase 2 — Cuenta de Twilio lista para producción

### 2.1 Agregar método de pago
1. [console.twilio.com](https://console.twilio.com) → **Billing** → Add credit card
2. El trial account tiene límite de 50 mensajes/día y no puede enviar a números no verificados

### 2.2 Registrar un número WhatsApp Business
1. Console → **Messaging** → **Senders** → **WhatsApp Senders**
2. Click **"Register WhatsApp Sender"**
3. Completar el formulario:
   - **WhatsApp Business Account**: conectar con el Facebook Business Manager verificado del Paso 1
   - **Display name**: `Casita` (o el nombre de tu negocio — es lo que ven los usuarios)
   - **Phone number**: elegir un número de Twilio existente o comprar uno nuevo
   - **Category**: `Professional Services` o `Real Estate`
   - **Business description**: breve descripción (ej: "Gestión de alquileres para propietarios")
4. Aceptar los Términos de WhatsApp Business
5. Enviar y **esperar aprobación de Meta** (normalmente 1-5 días hábiles)

### 2.3 Mientras esperás la aprobación
- Podés seguir usando el sandbox con el código `join shine-perfect`
- Podés completar el deploy a Vercel con el número de sandbox
- Cuando llegue la aprobación, solo cambiás las env vars

### 2.4 Una vez aprobado — configurar el webhook de producción
1. Console → Messaging → WhatsApp Senders → tu sender
2. En **"A message comes in"** → pegar la URL de producción:
   ```
   https://tu-dominio.vercel.app/api/webhooks/twilio-whatsapp
   ```
3. Method: `POST`

---

## Fase 3 — Deploy a Vercel

### 3.1 Subir el código a GitHub
```bash
git add .
git commit -m "production ready"
git push origin main
```

### 3.2 Crear el proyecto en Vercel
1. [vercel.com](https://vercel.com) → **Add New Project**
2. Importar desde GitHub → seleccionar el repo de Casita
3. Framework: **Next.js** (autodetectado)
4. **No deployar todavía** — primero configurar las env vars

### 3.3 Configurar env vars en Vercel
Settings → Environment Variables → agregar cada una:

#### Supabase (requeridas)
| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (privada) |
| `DATABASE_URL` | Connection string — usar **Transaction pooler** (puerto 6543) |
| `DIRECT_URL` | Connection string — usar **Session pooler** o direct (puerto 5432) |

> Los connection strings están en Supabase → Project Settings → Database → Connection string.

#### App (requeridas)
| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.vercel.app` |
| `CRON_SECRET` | Generar: `openssl rand -base64 32` |
| `ENCRYPTION_SECRET` | Generar: `openssl rand -base64 32` |

#### OpenAI (requerida)
| Variable | Valor |
|----------|-------|
| `OPENAI_API_KEY` | tu API key |

#### Email — Resend (requerida para recordatorios)
| Variable | Valor |
|----------|-------|
| `RESEND_API_KEY` | tu API key de Resend |
| `EMAIL_FROM` | `Casita <noreply@tudominio.com>` |

> Para `EMAIL_FROM` con dominio propio, verificar el dominio en Resend → Domains. Si usás `onboarding@resend.dev` funciona pero va a spam.

#### WhatsApp — Twilio (requeridas)
| Variable | Valor |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | Account SID de Twilio |
| `TWILIO_AUTH_TOKEN` | Auth Token de Twilio |
| `TWILIO_WHATSAPP_FROM` | Tu número aprobado: `+549XXXXXXXXX` |
| `NEXT_PUBLIC_TWILIO_WHATSAPP_FROM` | Mismo número |

> **`TWILIO_SANDBOX_JOIN_CODE` no va en producción.** Al no estar definida, el banner de WhatsApp del dashboard no muestra el código de sandbox.

#### Mercado Pago (opcional — si querés recibir pagos online)
| Variable | Valor |
|----------|-------|
| `MERCADOPAGO_ACCESS_TOKEN` | Token de MP |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret para validar webhooks |

#### Gmail OAuth (opcional — para buscar facturas en Gmail)
| Variable | Valor |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Client ID de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Client Secret |

#### Outlook OAuth (opcional — para buscar facturas en Outlook)
| Variable | Valor |
|----------|-------|
| `MICROSOFT_CLIENT_ID` | Application ID de Azure |
| `MICROSOFT_CLIENT_SECRET` | Client Secret |

### 3.4 Deployar
1. Ir a Deployments → **Redeploy** (o el primer deploy arranca automático)
2. Esperar que termine (2-3 minutos)
3. Copiar la URL asignada: `https://casita-xxx.vercel.app`

### 3.5 Correr las migraciones en la DB de producción
```bash
# En tu máquina local, con el DATABASE_URL de producción
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

> `migrate deploy` aplica las migraciones pendientes sin hacer prompt interactivo — ideal para CI/producción.

---

## Fase 4 — Actualizar URLs en todos los servicios

### 4.1 Twilio webhook (si ya tenés número aprobado)
```
https://tu-dominio.vercel.app/api/webhooks/twilio-whatsapp
```

### 4.2 Google OAuth — agregar redirect URI de producción
1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Editar el OAuth client → **Authorized redirect URIs** → agregar:
   ```
   https://tu-dominio.vercel.app/api/auth/google-email/callback
   ```

### 4.3 Microsoft OAuth — agregar redirect URI de producción
1. [portal.azure.com](https://portal.azure.com) → App registrations → Casita
2. Authentication → Redirect URIs → agregar:
   ```
   https://tu-dominio.vercel.app/api/auth/microsoft-email/callback
   ```

### 4.4 Mercado Pago webhook (si usás MP)
1. [mercadopago.com.ar](https://www.mercadopago.com.ar) → Tus integraciones → Webhooks
2. URL: `https://tu-dominio.vercel.app/api/webhooks/mercadopago`
3. Eventos: `payment`

---

## Fase 5 — Verificar que todo funciona

### 5.1 Checklist previo al go-live
```bash
# Build limpio sin errores
npm run build

# Tests (94 tests puros)
npm test
```

### 5.2 Verificar crons activos en Vercel
1. Vercel → tu proyecto → **Settings** → **Crons**
2. Confirmar que están los 3:

| Cron | Schedule | Descripción |
|------|----------|-------------|
| `/api/cron/send-reminders` | `0 11 * * *` | Recordatorios diarios a las 8:00 AM ARG |
| `/api/cron/owner-alerts` | `0 12 * * *` | Alertas al owner a las 9:00 AM ARG |
| `/api/cron/process-reminders` | `*/15 * * * *` | Recordatorios programados cada 15 min |

### 5.3 Test de WhatsApp end-to-end
1. Entrar al dashboard → configurar tu número de WhatsApp
2. Recibir el mensaje de bienvenida
3. Escribir "hola" al bot → verificar que responde
4. Crear una casita de prueba y dar de alta un inquilino de prueba
5. Desde el número del inquilino de prueba, escribir "cuánto debo"
6. Verificar que el bot responde con las obligaciones

### 5.4 Test del portal del inquilino
1. Obtener el link del portal desde el dashboard o bot
2. Abrir `https://tu-dominio.vercel.app/t/[token]`
3. Verificar que se ven las obligaciones y los datos de pago

---

## Fase 6 — Dominio personalizado (opcional)

Si querés `app.tudominio.com` en vez de `casita-xxx.vercel.app`:

1. Vercel → Settings → Domains → **Add Domain**
2. Ingresar `app.tudominio.com`
3. Seguir las instrucciones para agregar el CNAME en tu registrador de DNS
4. Vercel genera el certificado SSL automáticamente
5. Actualizar `NEXT_PUBLIC_APP_URL` en Vercel con el nuevo dominio
6. Hacer redeploy

---

## Notas de seguridad antes del go-live

- [ ] `.env.local` está en `.gitignore` (verificar con `git status`)
- [ ] Ningún secret fue commiteado al repo
- [ ] `ENCRYPTION_SECRET` y `CRON_SECRET` son distintos en prod y dev
- [ ] `TWILIO_SANDBOX_JOIN_CODE` **no está** en las env vars de Vercel
- [ ] El webhook de Twilio usa HTTPS (Vercel lo provee automáticamente)

---

## Configuración de Gmail OAuth (si usás búsqueda de facturas)

### Crear proyecto en Google Cloud
1. [console.cloud.google.com](https://console.cloud.google.com) → New Project → `Casita`
2. APIs & Services → Library → **Gmail API** → Enable
3. APIs & Services → OAuth consent screen → External → completar:
   - App name: `Casita`
   - User support email: tu email
   - Scopes: `gmail.readonly`
4. Credentials → Create Credentials → **OAuth client ID**
   - Type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google-email/callback` (dev)
     - `https://tu-dominio.vercel.app/api/auth/google-email/callback` (prod)
5. Copiar Client ID y Client Secret

---

## Configuración de Outlook OAuth (si usás búsqueda de facturas)

### Registrar app en Azure
1. [portal.azure.com](https://portal.azure.com) → App registrations → **New registration**
   - Name: `Casita`
   - Supported accounts: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `https://tu-dominio.vercel.app/api/auth/microsoft-email/callback`
2. Overview → copiar **Application (client) ID**
3. Certificates & secrets → New client secret → copiar Value
4. API permissions → Add permission → Microsoft Graph → Delegated:
   - `Mail.Read`, `offline_access`, `openid`, `email`
5. Authentication → agregar también: `http://localhost:3000/api/auth/microsoft-email/callback` (dev)

---

## Timeline estimado

| Tarea | Tiempo |
|-------|--------|
| Meta Business verification | 2 horas a 2 días |
| Twilio WhatsApp Business approval | 1 a 5 días hábiles |
| Deploy Vercel + env vars | 30-60 minutos |
| Configurar OAuth emails | 30 minutos |
| Test E2E | 30 minutos |
| **Total (sin esperas)** | **~2 horas** |
| **Total (con esperas)** | **3 a 7 días** |

> Iniciá el trámite de Meta + Twilio hoy para no quedar bloqueado esperando aprobación.
