# 03 — Domain Model

## Entidades core de V1

### Workspace
Representa la casita / owner context.
Campos clave:
- id
- ownerPhone
- ownerEmail
- status
- paymentConfigRef
- whatsappConfigRef

### Unit
Representa la unidad/alquiler activo.
Campos clave:
- id
- workspaceId
- tenantName
- tenantPhone
- tenantEmail
- tenantToken
- currentRentAmount
- leaseStartDate
- leaseEndDate

### ObligationTemplate
Representa un cobro recurrente.
Campos clave:
- id
- unitId
- type
- title
- amount
- dueDay
- reminderDays
- reminderChannel

### Obligation
Representa un cobro concreto de un período.
Campos clave:
- id
- unitId
- templateId
- title
- amount
- dueDate
- status
- originalBillUrl
- proofUrl
- paymentLink
- verifiedAt

### Claim
V1 simple.
Campos clave:
- id
- unitId
- status
- description
- imageUrls
- createdAt

### ActivityLog
Nueva entidad obligatoria.
Campos clave:
- id
- workspaceId
- unitId
- actorType
- actorId
- action
- metadata
- channel
- createdAt

## Principios
- El modelo debe ser simple y legible
- Las relaciones deben servir al wedge
- No crear entidades futuristas sin uso real
- Evitar meter demasiada configuración en Workspace sin documentarlo

## Deuda aceptable
Workspace puede seguir siendo un poco "god object" en V1 si eso acelera el ship, pero debe quedar explícitamente documentado como deuda técnica.
