# Casita — Guía de Deploy y Setup de Integraciones

## 1. Gmail OAuth Setup (Google Cloud Console)

### a) Crear proyecto
1. Ir a https://console.cloud.google.com
2. Arriba a la izquierda, click en el selector de proyecto → "New Project"
3. Nombre: `Casita` → Create

### b) Habilitar Gmail API
1. Menú lateral: APIs & Services → Library
2. Buscar "Gmail API" → click → **Enable**

### c) Configurar pantalla de consentimiento
1. APIs & Services → OAuth consent screen
2. Elegir "External" → Create
3. Completar:
   - App name: `Casita`
   - User support email: tu email
   - Developer contact: tu email
4. Scopes: click "Add or remove scopes" → buscar `gmail.readonly` → tildar → Update → Save
5. Test users: agregar tu email de Gmail → Save
6. Seguir hasta el final (publicar o dejar en Testing para probar)

### d) Crear credenciales OAuth
1. APIs & Services → Credentials → Create Credentials → **OAuth client ID**
2. Application type: **Web application**
3. Name: `Casita WhatsApp`
4. Authorized redirect URIs — agregar **las dos**:
   - `http://localhost:3000/api/auth/google-email/callback` (dev)
   - `https://TU-DOMINIO.vercel.app/api/auth/google-email/callback` (producción)
5. Click Create
6. Copiar **Client ID** y **Client Secret**

### e) Env vars
```
GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxx
```

---

## 2. Outlook OAuth Setup (Azure Portal)

### a) Registrar app
1. Ir a https://portal.azure.com → buscar "App registrations" → **New registration**
2. Name: `Casita`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Redirect URI: Web → `http://localhost:3000/api/auth/microsoft-email/callback`
5. Register

### b) Anotar Client ID
- Overview → **Application (client) ID** → copiar

### c) Crear Client Secret
1. Certificates & secrets → **New client secret**
2. Description: `casita-prod`, Expires: 24 months
3. Click Add → **copiar el Value inmediatamente** (después no se puede ver)

### d) Agregar permisos
1. API permissions → Add a permission → **Microsoft Graph** → Delegated permissions
2. Tildar:
   - `Mail.Read`
   - `offline_access`
   - `openid`
   - `email`
3. Click "Add permissions"

### e) Agregar redirect URI de producción
1. Authentication → Add platform → Web
2. Agregar: `https://TU-DOMINIO.vercel.app/api/auth/microsoft-email/callback`

### f) Env vars
```
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 3. Twilio — de Sandbox a Producción

El sandbox (`+14155238886`) es solo para testear. Para producción se necesita un número propio con WhatsApp Business.

### a) Comprar número Twilio
1. Console → Phone Numbers → Buy a Number
2. Elegir un número (puede ser USA, el usuario ve el nombre del negocio)

### b) Activar WhatsApp Business
1. Console → Messaging → Senders → WhatsApp Senders
2. Click "Register WhatsApp Sender"
3. Se necesita:
   - Un **Facebook Business Manager** verificado (https://business.facebook.com)
   - Un **nombre de display** para WhatsApp (ej: "Casita")
   - Aceptar los ToS de WhatsApp Business API
4. Facebook revisa y aprueba (1-7 días)

### c) Configurar webhook
1. Console → Messaging → WhatsApp Senders → tu sender
2. Webhook URL: `https://TU-DOMINIO.vercel.app/api/webhooks/twilio-whatsapp`
3. Method: POST

### d) Env vars
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=+1XXXXXXXXXX                    # número WhatsApp Business
NEXT_PUBLIC_TWILIO_WHATSAPP_FROM=+1XXXXXXXXXX         # mismo número (para botón wa.me)
```

> Mientras se espera la aprobación de WhatsApp Business, se puede seguir usando el Sandbox.

---

## 4. Variables de entorno completas para Vercel

En Vercel: Settings → Environment Variables.

### Supabase
| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (privada) |
| `DATABASE_URL` | Connection string (Transaction pooler) |
| `DIRECT_URL` | Connection string (Direct/Session pooler) |

### App
| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://TU-DOMINIO.vercel.app` |
| `CRON_SECRET` | String random largo (`openssl rand -base64 32`) |
| `ENCRYPTION_SECRET` | 32+ chars para AES-256 (`openssl rand -base64 32`) |
| `WEBHOOK_SECRET` | String random para validar webhooks |
| `N8N_WEBHOOK_SECRET` | Secret para n8n |

### Email (Resend)
| Variable | Descripción |
|---|---|
| `RESEND_API_KEY` | API key de Resend |
| `EMAIL_FROM` | `Casita <noreply@tudominio.com>` |

### AI
| Variable | Descripción |
|---|---|
| `OPENAI_API_KEY` | API key de OpenAI |

### WhatsApp (Twilio)
| Variable | Descripción |
|---|---|
| `TWILIO_ACCOUNT_SID` | Account SID |
| `TWILIO_AUTH_TOKEN` | Auth Token |
| `TWILIO_WHATSAPP_FROM` | Número WhatsApp Business (`+1XXXXXXXXXX`) |
| `NEXT_PUBLIC_TWILIO_WHATSAPP_FROM` | Mismo número (frontend) |

### Gmail OAuth
| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google Cloud |

### Outlook OAuth
| Variable | Descripción |
|---|---|
| `MICROSOFT_CLIENT_ID` | Application ID de Azure |
| `MICROSOFT_CLIENT_SECRET` | Client Secret de Azure |

---

## 5. Checklist de Deploy

### Antes de deployar
```bash
# Verificar que el build no tiene errores
npm run build

# Push a GitHub (Vercel auto-deploya si está conectado)
git add .
git commit -m "production ready"
git push
```

### Después del deploy
1. Correr migraciones en DB de producción:
   ```bash
   DATABASE_URL="tu-connection-string-de-prod" npx prisma db push
   ```
2. Actualizar redirect URIs de Google y Microsoft con el dominio real de Vercel
3. Configurar webhook de Twilio con la URL de Vercel
4. Verificar que los crons estén activos en Vercel (Settings → Crons, hay 3)
5. Probar mandando "hola" al bot por WhatsApp

### Crons configurados (vercel.json)
| Cron | Schedule | Descripción |
|---|---|---|
| `/api/cron/send-reminders` | Todos los días 11:00 UTC | Envía recordatorios de pagos |
| `/api/cron/owner-alerts` | Todos los días 12:00 UTC | Alerta proactiva al owner |
| `/api/cron/process-reminders` | Cada 15 minutos | Procesa recordatorios programados |

### Seguridad
- Verificar que `.env.local` esté en `.gitignore`
- Nunca commitear archivos con secrets
- Las contraseñas de email se guardan encriptadas con AES-256
- Los refresh tokens de OAuth se guardan encriptados
- Twilio valida firma en el webhook
