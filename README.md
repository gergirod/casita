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
- `cursor_rules.mdc`
- `DEPLOY_VERCEL.md`
- `tasks/`
- `docs/`
