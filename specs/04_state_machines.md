# 04 — State Machines

## Obligations
Estados oficiales:
- upcoming
- reminded
- pending
- proof_uploaded
- verified
- overdue
- cancelled

## Reglas base
- una obligation recién creada entra en `upcoming`
- cuando se envía reminder automático o manual, puede pasar a `reminded`
- si llega la fecha y no hay pago verificado, pasa a `pending`
- si pasan X días sin pago, pasa a `overdue`
- si el tenant sube comprobante, pasa a `proof_uploaded`
- si owner verifica, pasa a `verified`
- `cancelled` es excepcional

## Claim
V1 simple:
- open
- in_progress
- resolved

## Futuro: Rent Adjustment
Preparar arquitectura para poder agregar:
- draft
- proposed
- tenant_reviewing
- counteroffered
- owner_reviewing
- accepted
- rejected
- expired
- formalized

## Regla crítica
Toda transición debe:
1. validar que sea legal
2. persistirse de forma determinística
3. escribir ActivityLog
4. disparar side effects si aplica

## No permitido
- cambiar estados dentro de prompts
- cambiar estados por string suelto en múltiples archivos
- side effects ocultos
