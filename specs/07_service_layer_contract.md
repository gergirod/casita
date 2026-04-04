# 07 — Service Layer Contract

## Objetivo
La capa `lib/services/*` es la fuente única de verdad del negocio.

## Estructura sugerida
```text
lib/services/
  obligations.ts
  reminders.ts
  payments.ts
  claims.ts
  bills.ts
  notifications.ts
  activity-log.ts
  tenants.ts
  workspaces.ts
```

## Reglas
- lógica de negocio vive acá
- validaciones viven acá
- state transitions viven acá o en helpers llamados desde acá
- side effects se centralizan acá
- logging se dispara acá

## Ejemplos de funciones
### obligations.ts
- getObligationsForWorkspace()
- createMonthlyObligations()
- verifyPayment()
- markProofUploaded()
- createManualCharge()
- markOverdue()

### reminders.ts
- sendReminder()
- sendOverdueFollowup()
- scheduleReminderIfNeeded()

### bills.ts
- ingestBillFromUpload()
- extractBillData()
- attachBillToObligation()

### claims.ts
- createClaim()
- updateClaimStatus()
- listClaimsForWorkspace()

### activity-log.ts
- logActivity()

## Contrato de cada service
Cada service debe tener:
- input tipado
- validación explícita
- side effects claros
- retorno consistente
- tests en lo posible

## Prohibido
- esconder side effects en utilities ambiguas
- escribir logs en algunos caminos sí y otros no
- duplicar queries iguales en skills y routes
