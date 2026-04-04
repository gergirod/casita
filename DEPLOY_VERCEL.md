# Casita — Vercel Deployment Guide

## 1. Overview
Casita should be deployed as a Vercel-first Next.js app.

### Stack
- Vercel: app hosting
- Supabase: DB/Auth/Storage
- Mercado Pago: payment links + webhooks
- Resend: email
- Twilio or Meta: WhatsApp
- n8n: optional automation layer

## 2. Local setup
```bash
mkdir casita
cd casita
git init
```

Copy the spec package files into the project root.

Then:
```bash
git add .
git commit -m "initial spec-driven package"
```

## 3. GitHub
Create a GitHub repo and push:
```bash
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 4. Create Vercel project
Option A: Vercel dashboard
- Add New Project
- Import GitHub repo
- Framework: Next.js

Option B: CLI
```bash
npm i -g vercel
vercel
vercel link
```

## 5. Supabase setup
Create a Supabase project with:
- Postgres DB
- Auth enabled
- Storage bucket(s)

Recommended buckets:
- original-bills
- proofs
- contracts-later

Connect Supabase to Vercel through the Vercel Marketplace if desired.

## 6. Environment variables

### Core
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

### Email
```env
RESEND_API_KEY=
EMAIL_FROM=
```

### Mercado Pago
```env
MP_WEBHOOK_URL=
```

Note: access tokens are stored per workspace from the app settings (not as a global env var).

### WhatsApp (Twilio example)
```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
```

### App
```env
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
WEBHOOK_SECRET=
ENCRYPTION_SECRET=
GEMINI_API_KEY=
```

## 7. Local environment sync
Once env vars exist in Vercel:
```bash
vercel env pull .env.local
```

## 8. Deploy model
- feature branches => Preview deployments
- main => Production deployment

## 9. Webhooks
### Mercado Pago webhook endpoint
Configured route:
`/api/webhooks/mercadopago`

This route should:
- validate secret if applicable
- parse webhook payload
- resolve internal obligation by external reference
- update obligation status
- write activity event

## 10. Email ingestion
Recommended V1:
- create forwarding inbox provider / inbound email webhook
- point inbound events to `/api/webhooks/n8n-bill`
- store attachments
- create IncomingBillReview row

## 11. n8n placement
n8n should live outside Vercel.

Recommended options:
- n8n cloud
- Railway
- Render
- VPS / DigitalOcean

Use n8n for:
- reminder orchestration
- inbound email processing
- experiments

Do not use n8n to hold source-of-truth state.

## 12. Production domains
Use:
- app domain on Vercel
- webhook URLs from Vercel production domain
- preview domains only for testing, not external payment production callbacks

## 13. Suggested deployment order
1. Vercel project
2. Supabase project
3. env vars
4. foundations deploy
5. email reminders
6. forwarding inbox
7. Mercado Pago adapter
8. WhatsApp adapter
