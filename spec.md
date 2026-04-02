# Casita — Product Spec

## 1. Product story
Casita is a simple owner operations app for landlords with multiple rental units in LATAM.

Today, the owner manages rentals through:
- WhatsApp
- email
- PDF bills
- screenshots
- memory
- spreadsheets

The recurring pain is:
- asking tenants if they already paid
- asking again for proof
- losing original bills in email threads
- forgetting due dates
- not knowing what is pending across several units

Casita becomes the place where each unit has:
- recurring rent
- utility/expensas obligations
- original bill files
- reminders
- proof uploads
- payment status
- activity history

## 2. Primary and secondary users

### Primary
- owner / landlord

### Secondary
- tenant

The tenant does not need a full dashboard in V1.
A secure link flow is enough.

## 3. Jobs to be done
1. I want to know what each tenant owes this month.
2. I want new bills to appear in the right property instead of getting lost in email.
3. I want tenants to receive reminders without me manually chasing them.
4. I want tenants to see the original bill they are being asked to pay.
5. I want proof stored in the right place.
6. I want a clean dashboard across all my units.

## 4. MVP scope

### In scope
- multiple properties
- multiple units
- one owner workspace
- tenant contact per unit
- recurring rent obligations
- manually created bills
- email-forwarded bill ingestion into review queue
- original bill file storage
- obligation statuses
- tenant proof upload
- owner verification
- email reminders
- optional WhatsApp reminders
- optional Mercado Pago payment links for rent
- timeline per unit

### Out of scope
- full property manager / inmobiliaria multi-role complexity
- maintenance workflow
- accounting suite
- contract e-signing
- automatic payment of third-party utility bills
- bank sync
- heavy OCR
- autopay orchestration
- collections/legal workflow

## 5. Product principles
1. Owner-first
2. Property-centric
3. Original files visible to both owner and tenant
4. App is the system of record
5. Providers and channels must be replaceable through adapters
6. Vercel-first deployment model

## 6. Core roles

### Owner can
- create properties and units
- configure recurring rent
- upload bills
- review ingested bills
- connect payment provider settings
- trigger reminders
- verify proof of payment
- see all history

### Tenant can via secure link
- view obligations assigned to their unit
- open original bill file
- open payment link if available
- upload proof of payment
- see current status

## 7. Core entities

### Workspace
- owner account
- locale
- currency
- timezone
- communication preferences

### Property
- name
- address
- notes

### Unit
- property
- identifier
- tenant name
- tenant email
- tenant WhatsApp
- active / inactive

### Obligation
Types:
- rent
- expensas
- electricity
- gas
- water
- internet
- custom

Fields:
- unit_id
- type
- title
- amount
- due_date
- status
- responsible_party
- original_bill_file_url
- payment_link_url
- source_type
- source_reference
- notes

Statuses:
- upcoming
- pending
- reminded
- proof_uploaded
- verified
- overdue
- cancelled

### ProofOfPayment
- obligation_id
- file_url
- uploader_type
- uploaded_at
- notes

### IncomingBillReview
- workspace_id
- sender
- subject
- attachment_urls
- suggested_type
- suggested_unit_id nullable
- status: new / reviewed / discarded / converted

### ActivityEvent
- unit_id
- obligation_id optional
- actor
- event_type
- payload
- created_at

## 8. Payment modes

### Mode A — app-native payment link
Used mainly for rent.

Flow:
1. Owner sets rent amount and due day.
2. Casita generates monthly rent obligation.
3. Mercado Pago adapter creates payment link.
4. Tenant gets reminder with secure page and payment link.
5. Mercado Pago sends webhook.
6. Casita verifies obligation automatically.

### Mode B — external bill with tenant proof
Used for utilities and expensas.

Flow:
1. Bill is uploaded or forwarded by email.
2. Casita creates obligation with original file.
3. Tenant gets reminder.
4. Tenant uploads proof.
5. Owner verifies manually.

### Mode C — owner manual verification
Fallback where no integration exists.

## 9. Email bill ingestion

### V1 mode
Forwarding inbox per workspace:
- bills+workspace@casita.app

Behavior:
- email arrives
- attachments are stored
- review item is created
- owner confirms unit and bill type
- obligation is created from review item

### V1.5 suggestions
- sender-based suggestions:
  - Edenor => electricity
  - Metrogas => gas
  - admin/consorcio => expensas

### Not in V1
- full Gmail sync
- provider portal scraping
- guaranteed bill parsing for all formats

## 10. OCR stance
OCR is optional later, not required for MVP.
The wedge is:
- collect original file
- create obligation
- remind tenant
- store proof
- show status

## 11. Communication model

### Email in V1
Required:
- due soon reminder
- due today reminder
- overdue reminder
- proof received owner notification

### WhatsApp in V1.5
Optional adapter:
- due reminder
- overdue reminder
- proof request
- proof received

## 12. Integrations

### Payment provider adapter interface
- create_payment_link(obligation)
- parse_webhook(payload)
- verify_payment_status(external_ref)

V1:
- Mercado Pago

Future:
- Stripe
- local PSPs
- transfer providers

### Communication adapter interface
- send_due_reminder()
- send_overdue_reminder()
- send_proof_received()

V1:
- Email

V1.5:
- WhatsApp via Twilio or Meta

### Bill source adapter interface
- ingest_bill(file or email)
- create_review_item()
- attach_original_document()

V1:
- manual upload
- forwarding inbox

Future:
- Gmail
- Outlook
- provider-specific pulls

## 13. UX flows

### Owner onboarding
1. Create workspace
2. Add property
3. Add unit
4. Add tenant contact
5. Set monthly rent amount + due day
6. Choose payment mode for rent
7. Activate reminders

### Owner recurring workflow
1. Open dashboard
2. Review pending/overdue items
3. Forward or upload bills
4. Review bill queue
5. Verify proofs
6. Send follow-ups

### Tenant flow
1. Receive reminder link
2. Open obligation page
3. View original bill
4. Pay or upload proof
5. See updated status

## 14. Main dashboard requirements
Show:
- active units
- pending obligations
- overdue obligations
- proofs awaiting verification
- upcoming due this week

## 15. Brutally honest risks
1. Single-property owners may not pay.
2. Owner may still use WhatsApp manually and ignore the app.
3. Utility autopay ambition can push the product into support/compliance complexity.
4. Too much scope from providers and channels can bloat the MVP.

## 16. Positioning
Casita is not property management software.

Casita is:
> the owner operations app for rentals in LATAM

More concrete:
> See what was paid, what is pending, and which bill needs follow-up across all your rentals.
