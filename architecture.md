# Technical Architecture

## 1. Platform map

### Vercel
Use Vercel for:
- Next.js frontend
- route handlers / API endpoints
- tenant secure pages
- provider webhook endpoints
- preview deployments
- environment variables

### Supabase
Use Supabase for:
- Postgres database
- auth
- storage for original bills and proofs

### Mercado Pago
Use Mercado Pago for:
- payment links for rent
- webhook notifications for successful payment
- payment status lookups

### Twilio or Meta WhatsApp API
Use for:
- outbound WhatsApp reminders
- optional proof-related notifications

### n8n
Use for optional automation glue:
- email ingestion pipeline
- scheduled reminder orchestration
- non-critical integrations
- experiments

Do not use n8n as:
- source of truth
- main business logic
- permission layer
- canonical state machine

## 2. Core system boundaries

### App core owns
- workspaces
- properties
- units
- tenant contacts
- obligations
- proofs
- bill review queue
- statuses
- activity timeline
- adapter config

### External adapters provide
- payment link creation
- message delivery
- inbound email events
- payment webhooks

## 3. Recommended app stack
- Next.js App Router
- TypeScript
- Tailwind
- Supabase client + server SDK
- Zod for validation
- Prisma or Drizzle ORM
- Vercel deployment

## 4. Adapter interfaces

### PaymentProviderAdapter
Methods:
- createPaymentLink(obligation)
- parseWebhook(payload)
- resolveExternalReference(payload)
- fetchPaymentStatus(externalRef)

### CommunicationAdapter
Methods:
- sendMessage(template, recipient, data)

### BillIngestionAdapter
Methods:
- ingest(source)
- createReviewItem()
- attachFiles()

## 5. Secure tenant access
Use signed token links with:
- unit-scoped access
- expiration or revocation support
- no broad workspace access

## 6. Event model
Append-only activity events:
- obligation_created
- reminder_sent
- proof_uploaded
- obligation_verified
- bill_received
- bill_reviewed
- payment_link_generated
- payment_confirmed

## 7. File model
Store:
- original filename
- mime type
- category
- related unit
- related obligation
- uploader
- timestamps

## 8. Scalability note
Scalability comes from:
- clean adapter boundaries
- Vercel preview/prod discipline
- keeping state in app + Supabase
- avoiding provider-specific logic in UI
