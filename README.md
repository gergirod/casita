# Casita — Owner Ops for Rentals

Casita is a Vercel-first, owner-first rental operations app for LATAM.

It helps landlords manage:
- monthly rent
- expensas and utility bills
- reminders
- original bill files
- proof of payment
- tenant follow-up
- status across multiple units

## Core promise
> Know what was paid, what is pending, and what needs follow-up without managing rentals through WhatsApp.

## Platform approach
- **Vercel** hosts the app
- **Supabase** handles database, auth, and storage
- **Mercado Pago** handles payment links and payment webhooks
- **Twilio / Meta** handle WhatsApp delivery
- **n8n** is optional automation glue, not the source of truth

## Package contents
- `spec.md`
- `architecture.md`
- `milestones.md`
- `backlog.md`
- `DEPLOY_VERCEL.md`
- `tasks/`
- `docs/`

## Current app scope
This repository currently includes:
- Supabase auth integration (magic link)
- owner onboarding flow and workspace setup
- property, unit and tenant contact management
- obligations engine (manual + recurring rent generation)
- owner dashboard with overdue/pending/proof verification views
- tenant secure page with proof upload
- email reminders and notification logging
- bill upload + extraction helpers
- n8n webhook route for bill ingestion
- Mercado Pago payment-link + webhook flow
- optional WhatsApp delivery wiring
- storage integration for bills, proofs and contracts

## Quick start
1. Copy env template:
   ```bash
   cp .env.example .env.local
   ```
2. Fill the required variables in `.env.local` (see `.env.example`).
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Run app:
   ```bash
   npm run dev
   ```

## WhatsApp Bot MVP (Twilio + n8n + OpenAI)

Casita can receive inbound tenant messages from WhatsApp and forward them to n8n.

### Required env vars
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `N8N_WEBHOOK_SECRET`
- `N8N_WHATSAPP_WEBHOOK_URL` (n8n inbound webhook URL)

### Inbound webhook
- `POST /api/webhooks/twilio-whatsapp`
- Source: Twilio Sandbox / WhatsApp Sender
- Security: validates `X-Twilio-Signature`
- Body type: `application/x-www-form-urlencoded`
- Forwards to n8n as JSON with header `x-casita-secret`

### n8n helper APIs
- `GET /api/tenant-by-phone?number=whatsapp:+549...`
  - Header: `x-casita-secret: <N8N_WEBHOOK_SECRET>`
  - Returns tenant + unit + active obligations context
- `POST /api/tenant/[token]/proof-url`
  - Header: `x-casita-secret: <N8N_WEBHOOK_SECRET>`
  - Body: `{ obligationId, mediaUrl, contentType? }`
  - Downloads Twilio media URL and stores proof in Supabase
- `POST /api/tenant/[token]/note`
  - Header: `x-casita-secret: <N8N_WEBHOOK_SECRET>`
  - Body: `{ text, category?: \"reclamo\" | \"consulta\" | \"otro\" }`
  - Saves message as `custom` obligation (`sourceType: n8n`) for owner visibility

See `docs/whatsapp-bot-mvp.md` for full flow and n8n node-by-node setup.
