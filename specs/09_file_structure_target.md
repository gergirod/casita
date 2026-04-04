# 09 — Target File Structure

```text
app/
  dashboard/
  onboarding/
  t/[token]/
  api/
    whatsapp/webhook/route.ts
    cron/
    obligations/
    claims/
    settings/

lib/
  ai/
    classifier.ts
    response-composer.ts
    bill-extractor.ts

  router/
    phone-router.ts
    intent-router.ts

  skills/
    owner/
      get-overview.ts
      get-obligations.ts
      verify-payment.ts
      send-reminder.ts
      upload-bill.ts
      create-charge.ts
      update-rent.ts
      get-claims.ts
      update-claim.ts
    tenant/
      get-my-obligations.ts
      upload-proof.ts
      get-payment-info.ts
      create-claim.ts

  services/
    obligations.ts
    reminders.ts
    payments.ts
    claims.ts
    bills.ts
    notifications.ts
    activity-log.ts
    tenants.ts
    workspaces.ts

  workflows/
    obligation-state-machine.ts
    claim-state-machine.ts

  adapters/
    whatsapp.ts
    email.ts
    storage.ts

  db/
    prisma.ts

  auth/
    auth.ts
```

## Nota
No hace falta llegar exactamente a esta estructura en un solo PR.
Es una dirección objetivo.
