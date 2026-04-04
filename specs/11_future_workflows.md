# 11 — Future Workflows

## Objetivo
Diseñar V1 de forma que después sea fácil agregar workflows nuevos.

## Workflows futuros posibles
- aumento de alquiler
- negociación / disputa
- plan de pagos
- renovación de contrato
- expensas
- boletas de servicios
- coordinación con proveedores
- reclamos más complejos

## Patrón obligatorio para cualquier workflow nuevo
Toda feature nueva debe definirse con:
1. intención
2. entidad principal
3. estados
4. services
5. eventos / ActivityLog
6. respuestas por canal
7. permisos / confirmaciones

## Ejemplo — Rent Adjustment
### Intents
- propose_rent_increase
- view_rent_increase
- counteroffer_rent_increase
- accept_rent_increase
- reject_rent_increase

### Estados
- draft
- proposed
- tenant_reviewing
- counteroffered
- owner_reviewing
- accepted
- rejected
- expired
- formalized

### Services
- createRentAdjustmentProposal()
- submitCounteroffer()
- acceptProposal()
- rejectProposal()
- expireProposal()

## Importante
No construir esto en V1.
Solo asegurar que la arquitectura V1 no lo haga imposible.
