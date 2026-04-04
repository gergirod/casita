# PR-11 — Fix Only Real Beta Blockers

> **Objetivo:** resolver exactamente los 2 blockers detectados en PR-10 antes de beta cerrada.  
> Sin nuevas features. Sin refactors grandes. Sin cambios de schema.

---

## Blocker 1 — Verificar pago desde el dashboard

### Problema
Cuando el inquilino sube un comprobante, la obligation pasa a `proof_uploaded`.
El dashboard muestra el badge "Comprobante subido" pero sin CTA de verificación.
El owner no puede cerrar el ciclo desde la web sin usar el bot.

### Solución mínima
Agregar un botón "Verificar ✓" en el status strip de la obligation cuando
`monthlyObligation.status === "proof_uploaded"`.

El botón llama `PATCH /api/obligations/[id]/status` con `{ status: "verified" }`.
La ruta ya existe y está protegida por ownership.

### Archivos a tocar
- `components/unit-editor.tsx` — solo el status strip (líneas ~506-576)
  - Agregar función `onVerify(obligationId)` al componente
  - Agregar botón condicional en la zona derecha del strip cuando status = `proof_uploaded`
  - El botón muestra "Verificar ✓" (idle) / "Verificando…" (busy) / refresca al completar

### Qué NO se toca
- El wizard "Agregar cobro recurrente" — intacto
- Los modales de edición y aumento — intactos
- `TemplateBillButton` — intacto
- Ninguna otra ruta de API
- Schema Prisma — intacto

### Riesgo de compatibilidad
Muy bajo. El botón solo aparece si `status === "proof_uploaded"`. No afecta otros estados.
La función `onVerify` es análoga a `onDeactivate` — mismo patrón ya existente.

---

## Blocker 2 — Datos de pago visibles en el portal del inquilino

### Problema
El owner configura `paymentMethod: "cbu"`, `paymentCbu`, `paymentName` en el template.
El inquilino abre `/t/[token]` y no ve a dónde transferir.
Tiene que preguntar por fuera del sistema.

### Solución mínima
1. En `app/t/[token]/page.tsx`: incluir `obligationTemplates` en la query Prisma
   (solo campos de pago: `id`, `paymentMethod`, `paymentCbu`, `paymentName`)
2. Construir un map `templateId → paymentInfo`
3. Enriquecer los objetos de obligation con `paymentInfo` antes de pasar a `TenantPortal`
4. En `tenant-portal.tsx`: mostrar datos de transferencia cuando `paymentMethod === "cbu"`

### Qué se muestra en el portal
Cuando el template tiene `paymentMethod === "cbu"` y `paymentCbu` tiene valor:

```
┌─────────────────────────────────┐
│  Transferí a:                   │
│  CBU/Alias: [paymentCbu]        │
│  Titular: [paymentName]         │
└─────────────────────────────────┘
```

Aparece entre el nombre/monto de la obligation y el botón de subir comprobante.
No reemplaza el botón de MP si `paymentLinkUrl` también existe — ambos coexisten.

Para obligations sin templateId (manuales/puntuales) o sin paymentMethod configurado:
no se muestra nada — comportamiento actual sin cambios.

### Archivos a tocar
- `app/t/[token]/page.tsx` — agregar `obligationTemplates` al include de Prisma + construcción del map
- `components/tenant-portal.tsx` — nuevo campo `paymentInfo` en el tipo `Obligation` + render condicional del bloque de transferencia

### Qué NO se toca
- La lógica de upload de comprobante — intacta
- El historial de pagos — intacto
- El contrato — intacto
- Ninguna ruta de API — todo es solo lectura en el server component
- Schema Prisma — el campo `paymentCbu` ya existe en `ObligationTemplate`

### Riesgo de compatibilidad
Muy bajo. Solo lectura, sin efectos. El campo `paymentInfo` es opcional en el tipo —
si es null, el componente no renderiza el bloque. Backward compatible con obligations existentes.

---

## Qué queda fuera a propósito

| Item | Razón |
|---|---|
| WhatsApp reminders en cron diario | Requiere cambios en `send-reminders` + test de no-spam. Para post-beta. |
| Pending proofs cross-workspace queue | Nice to have. No cambia el flujo core. |
| Follow-up estructurado (3 intentos) | Refinamiento post-beta. El overdue actual es funcional. |
| Diseño del portal del inquilino | Solo datos, sin rediseño. |
