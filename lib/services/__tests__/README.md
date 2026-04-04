# Service layer — unit tests

## Running tests

```bash
npm test
```

Runs all pure unit tests in sequence. No framework, no DB, no network. Exits with code 1 if any test fails.

Individual files:

```bash
npx tsx lib/services/__tests__/obligation-state-machine.test.ts
npx tsx lib/services/__tests__/claims.test.ts
npx tsx lib/services/__tests__/bills.test.ts
npx tsx lib/services/__tests__/reminders.test.ts
```

## What is tested (pure unit tests)

| File | Tests | What it covers |
|---|---|---|
| `obligation-state-machine.test.ts` | 55 | All state transitions for obligations — valid, invalid, terminal, cron boundaries |
| `claims.test.ts` | 17 | Claim transition table shape + `isValidClaimTransition` — all valid/invalid paths |
| `bills.test.ts` | 15 | `mimeToExt` (8 cases) + `nextMonthLastDay` (7 cases) |
| `reminders.test.ts` | 8 | `selectReminderEmailType` — all boundary values + exhaustiveness |

**Total: ~95 pure unit tests, < 3 seconds, zero external dependencies.**

## What is NOT tested here (integration manual)

These require a live DB + external services. Run manually against the dev environment.

### `obligations.ts`

| Case | How to verify |
|---|---|
| `verifyPayment` with correct ownerId → ok | WhatsApp: "verificá el pago de [obligationId]" |
| `verifyPayment` with wrong ownerId → forbidden | Call with mismatched ownerId directly |
| `createManualObligation` → obligation created + logged | Dashboard: create charge, check ActivityLog |
| `transitionObligationStatus` from verified → any → invalid_input | Attempt to move a verified obligation |
| `markObligationReminded` on proof_uploaded → protected | Cron runs against proof_uploaded obligation |
| `markObligationOverdue` on verified → protected | Cron runs against verified obligation |
| `verifyPaymentByExternalRef` already verified → idempotent | Fire MP webhook twice for same payment |

### `claims.ts`

| Case | How to verify |
|---|---|
| `createClaim` → claim created + ActivityLog | WhatsApp tenant: "tengo un problema con..." |
| `updateClaimStatus` resolved → any → invalid_input (terminal) | Attempt to reopen a resolved claim |
| `updateClaimStatus` wrong ownerId → forbidden | Call with mismatched ownerId |

### `rentals.ts`

| Case | How to verify |
|---|---|
| `createWorkspace` with full tenant + rent → workspace + contact + template | WhatsApp: "creá una casita nueva" |
| `registerTenant` with active unit → conflict | Attempt to add tenant when one exists |
| `endRental` → unit isActive=false + templates isActive=false | WhatsApp: "terminá el alquiler" |
| `deleteWorkspace` without "SI BORRAR" → invalid_input | Send wrong confirmation string |
| `updateRentAmount` without active template → not_found | Update rent with no active rent template |

### `reminders.ts`

| Case | How to verify |
|---|---|
| `sendReminderToTenant` — email + WhatsApp both sent | Obligation with email+WhatsApp tenant |
| `sendReminderToTenant` — email only (no WhatsApp) | Obligation with email-only tenant |
| `sendReminderToTenant` — wrong ownerId → not_found | Call with mismatched ownerId |
| `scheduleReminder` — past date → invalid_input | Send `send_at` in the past |
| `cancelReminder` — already sent reminder → not_found | Cancel a reminder with status="sent" |

### `bills.ts`

| Case | How to verify |
|---|---|
| `ingestBill` PDF → obligation + billUrl + extractedAmount | WhatsApp: send PDF |
| `ingestBill` image → obligation + billUrl + extractedAmount | WhatsApp: send JPEG |
| `ingestBill` extraction fails → obligation + billUrl, no amount | Disconnect OPENAI_API_KEY temporarily |
| `ingestBill` storage fails → no obligation created | Point to invalid SUPABASE_URL |
| `ingestBill` wrong ownerId → forbidden | Call with mismatched ownerId |
