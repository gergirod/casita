# PR-12 — Validation Metrics

> **Objetivo:** instrumentar 5 métricas mínimas de validación de beta,
> sin montar un sistema de analytics nuevo ni cambiar arquitectura.  
> Todo se construye sobre ActivityLog, Prisma queries existentes y datos ya persistidos.

---

## Source of truth disponible

| Dato | Tabla / campo |
|---|---|
| Workspaces del owner | `Workspace.ownerId` |
| Unidad tiene inquilino | `Unit.tenantContact != null` |
| Unidad tiene templates activos | `ObligationTemplate.isActive = true` |
| Obligations creadas | `Obligation.status` + `createdAt` |
| Obligations verificadas | `Obligation.status = "verified"` + `paidAt` |
| Comprobante subido | `Obligation.proofUrl != null` + `proofUploadedAt` |
| Quién subió el comprobante | `ActivityLog.action = "proof.uploaded"`, `actorType` |
| Reminder enviado | `ActivityLog.action = "reminder.sent"`, `entityId = obligationId` |
| Owner activo en WhatsApp | `ActivityLog.actorType = "owner"`, `channel = "whatsapp"`, `createdAt` |
| Timestamp de verificación | `ActivityLog.action = "payment.verified"`, `createdAt` |

---

## Definición exacta de las 5 métricas

### M1 — Onboarding completion rate

**Qué mide:** qué % de casitas (units) tiene el loop mínimo activo.

**Definición de "completa":**
Una unit es "completa" si tiene los 3 componentes del loop:
1. `tenantContact` configurado (inquilino registrado)
2. al menos 1 `ObligationTemplate` activo
3. al menos 1 `Obligation` creada

**Scope:** todas las units activas del owner (cross-workspace).

**Retorna:**
```
total: N units activas
complete: X units con loop completo
rate: X/N × 100 (%)
```

**Source:** Prisma — `Unit` join `tenantContact`, `obligationTemplates`, `obligations`.

---

### M2 — Owner activo en WhatsApp ≥1x por semana

**Qué mide:** en las últimas 4 semanas, cuántas veces el owner usó WhatsApp para ejecutar una acción real (no solo mandar "hola").

**Definición de "activo en una semana":**
Al menos 1 `ActivityLog` donde:
- `actorType = "owner"` AND `channel = "whatsapp"` AND `action` no es vacío
- `createdAt` dentro de la semana ISO

**Scope:** cross-workspace, para el owner.
**Ventana:** últimas 4 semanas desde hoy (28 días).

**Retorna:**
```
activeWeeks: X (de 4)
lastActivityAt: ISO date | null
```

**Source:** ActivityLog — actorType + channel + createdAt.

> **Nota:** `actorId` en ActivityLog contiene el teléfono del owner cuando channel = "whatsapp".
> No se expone en la UI, solo se usa para el conteo de filas.

---

### M3 — Ciclos completos: obligation → reminder → proof → verified

**Qué mide:** cuántas obligations llegaron al final del ciclo crítico con todos los pasos intermedios trazados.

**Definición de "ciclo completo":**
Una obligation cumplió el ciclo si:
1. `status = "verified"` (está verificada)
2. existe al menos 1 `ActivityLog` con `action = "reminder.sent"` Y `entityId = obligationId`

**Scope:** workspace.

**Retorna:**
```
verifiedTotal: total obligations verificadas en el workspace
completeCycles: cuántas tienen al menos 1 reminder registrado
rate: completeCycles / verifiedTotal × 100 (%)
```

**Source:** Prisma (Obligation verificadas) + ActivityLog (reminder.sent por entityId).

> **Limitación conocida:** solo cuenta ciclos donde el reminder fue enviado *a través del sistema*.
> Si el owner recordó al inquilino por WhatsApp directo, no queda registrado.
> Es aceptable para beta — queremos precisamente medir el uso del sistema.

---

### M4 — % de inquilinos que suben comprobante sin ayuda

**Qué mide:** del total de comprobantes subidos, cuántos fueron subidos por el propio inquilino.

**Definición:**
- Total: `ActivityLog.action = "proof.uploaded"` en el workspace
- Tenant self-service: mismo filtro + `actorType = "tenant"`

**Scope:** workspace.

**Retorna:**
```
totalProofs: N comprobantes subidos
tenantProofs: X subidos por inquilino
rate: X/N × 100 (%)
```

**Source:** ActivityLog — action + actorType.

---

### M5 — Tiempo promedio del ciclo (fricción real)

**Qué mide:** cuántos días tarda en promedio desde que se crea una obligation hasta que queda verificada.

**Definición:**
- Sample: obligations con `status = "verified"` Y `paidAt != null`
- Métrica: promedio de `(paidAt - createdAt)` en días
- También: cuántas están en `proof_uploaded` (comprobante subido, owner no verificó aún — fricción pendiente)

**Scope:** workspace.

**Retorna:**
```
avgDays: número | null (null si no hay sample)
sampleSize: N obligations en el cálculo
pendingVerification: X obligations en proof_uploaded (owner no verificó)
```

**Source:** Prisma — Obligation campos `paidAt`, `createdAt`, `status`.

---

## Propuesta mínima de implementación

### Archivos a crear

| Archivo | Qué hace |
|---|---|
| `lib/services/validation-metrics.ts` | 5 funciones puras de query, tipadas, sin side effects |
| `app/dashboard/[workspaceId]/metricas/page.tsx` | Server component — renderiza las 5 métricas como cards |

### Archivo a modificar

| Archivo | Qué cambia |
|---|---|
| `app/dashboard/[workspaceId]/page.tsx` | Agrega link sutil "Ver métricas de beta →" apuntando a `/metricas` |

### Qué NO se toca
- Schema Prisma — sin cambios
- ActivityLog — solo lectura
- Dashboard principal — solo se agrega el link
- Ninguna ruta de API write
- Agentes (WhatsApp / owner)
- Cualquier otra feature

### Diseño de `validation-metrics.ts`

```typescript
export interface OnboardingRate      { total: number; complete: number; rate: number }
export interface WhatsAppActivity    { activeWeeks: number; lastActivityAt: string | null }
export interface CompleteCycles      { verifiedTotal: number; completeCycles: number; rate: number }
export interface TenantSelfService   { totalProofs: number; tenantProofs: number; rate: number }
export interface CycleTime           { avgDays: number | null; sampleSize: number; pendingVerification: number }

export async function getOnboardingRate(ownerId: string): Promise<OnboardingRate>
export async function getOwnerWhatsAppActivity(ownerId: string): Promise<WhatsAppActivity>
export async function getCompleteCycles(ownerId: string, workspaceId: string): Promise<CompleteCycles>
export async function getTenantSelfServiceRate(ownerId: string, workspaceId: string): Promise<TenantSelfService>
export async function getAverageCycleTime(ownerId: string, workspaceId: string): Promise<CycleTime>
```

### Diseño de la página `/metricas`

Server component puro. Sin client-side JS.
Layout de 5 cards con:
- nombre de la métrica
- valor principal destacado
- contexto de interpretación (qué significa el número)
- datos secundarios de soporte

No hay gráficos. No hay tablas pesadas. Solo números con contexto.

Acceso: mismo guard de ownership que el dashboard principal (`auth()` + validar workspace).

---

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| ActivityLog vacío en beta temprana | M3, M4, M5 muestran `0` o `null` | Mostrar "Sin datos suficientes aún" en lugar de N/A o error |
| `paidAt` puede ser null en obligations verificadas via `transitionObligationStatus` | M5 muestra sample pequeño | Documentar la limitación; aceptable en beta |
| M2 cruza workspaces — puede ser confuso | Owner ve su actividad agregada | Aclarar en la UI que M2 es cross-workspace |
| Reminder enviado fuera del sistema no se cuenta | M3 subestima ciclos reales | Documentar limitación conocida en la UI |

---

## Qué queda fuera a propósito

- Exportar métricas a CSV
- Alertas o notificaciones basadas en métricas
- Comparación histórica / semana a semana
- Métricas por tenant individual
- Dashboard de métricas agregado para el founder (cross-owner)
- Integración con analytics externos (Mixpanel, PostHog, etc.)
