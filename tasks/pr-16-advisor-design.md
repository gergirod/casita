# PR-16 — Advisor + Learning Loop: Análisis y Diseño

_Fecha: abril 2026_
_Tipo: análisis y diseño — sin implementación_

---

## Objetivo

Preparar el terreno para los PRs 17–20 del Hermes Advisor Spec Pack.
Este documento define:
1. Qué flujos del owner-agent son candidatos para el advisor
2. Qué eventos disparan una retrospectiva
3. El esquema de memoria operacional
4. El formato de draft artifacts

No se escribe código en este PR. Todo lo que sigue es diseño revisable.

---

## 1. Candidatos para el patrón Executor + Advisor

### 1a. Flujos que NO usan advisor (determinísticos, simples)

Estos flujos ya están bien resueltos por el owner-agent y sus servicios.
Agregar advisor los haría más lentos y caros sin beneficio.

| Tool | Razón |
|------|-------|
| `get_overview` | Query pura, sin ambigüedad |
| `get_obligations` | Query con filtro, sin trade-offs |
| `get_tenant_info` | Query de datos |
| `get_pending_proofs` | Query de datos |
| `verify_payment` | Transición de estado determinística |
| `update_status` | Transición de estado explícita |
| `send_reminder` | Intent claro, canal claro |
| `schedule_reminder` | Intent claro, fecha explícita |
| `cancel_reminder` | Operación simple y reversible |
| `send_welcome` | Notificación directa |
| `upload_bill` | Upload de archivo con tipo dado |
| `fetch_bills_from_email` | Búsqueda estructurada |
| `list_recent_emails` | Lista de emails, sin decisión |
| `process_specific_email` | Extracción de datos de un email específico |
| `check_setup` | Checklist de prerequisitos |
| `check_email_status` | Query de estado de conexión |
| `connect_email_oauth` | Genera link OAuth |
| `save_custom_sender` | Guarda un patrón dado por el owner |
| `get_field_requirements` | Retorna spec de campos |
| `list_reminders` | Query de recordatorios pendientes |
| Cron jobs | Flujos batch sin interacción |
| Webhooks entrantes | Flujos automáticos sin ambigüedad |

---

### 1b. Flujos candidatos para Advisor

El advisor se llama **solo si el executor detecta uno o más de estos criterios**:
- bajo confidence en la intención del owner
- múltiples acciones válidas con trade-offs
- acción de alto riesgo o irreversible
- request que abarca múltiples casitas u obligaciones
- diagnosis de soporte compleja

| Tool | Por qué es candidato | Criterio disparador |
|------|---------------------|---------------------|
| `delete_casita` | Irreversible, destruye historial completo | Siempre → advisor revisa antes de confirmar |
| `end_rental` | Alto impacto: desactiva unidad, afecta templates y obligaciones futuras | Siempre → advisor verifica estado de obligaciones pendientes |
| `update_rent` | Puede ser ambiguo: ¿este mes? ¿todos los meses? ¿hay obligaciones vencidas asociadas? | Si hay obligaciones no verificadas al momento del cambio |
| `update_claim` → resolved | Triage de soporte: ¿se resolvió bien? ¿hay contexto adicional? | Si el claim lleva más de 3 días open o tiene notas complejas |
| Mensaje ambiguo con múltiples casitas | El owner no especifica cuál casita y tiene varias | Cuando hay 2+ workspaces activos y la intención no es clara |

### Comportamiento del Advisor

El advisor recibe:
- El mensaje original del owner
- El intent detectado por el executor
- El contexto operacional (workspaces, obligaciones relevantes)

El advisor **devuelve**:
- `plan`: qué hacer
- `risks`: riesgos identificados
- `recommendation`: acción concreta para el executor
- `stop`: booleano — si es true, el executor no ejecuta y le explica al owner por qué

El advisor **NO puede**:
- Llamar tools directamente
- Mutar estado
- Generar la respuesta final sin que el executor la envuelva
- Bypassear validaciones de servicios

---

## 2. Triggers de retrospectiva

La retrospectiva corre **después** de ciertos eventos, de forma asíncrona.
No bloquea la respuesta al owner.

| Evento | Tipo de artifact esperado | Condición |
|--------|--------------------------|-----------|
| `delete_casita` con éxito | `playbook_candidate` | Siempre |
| `end_rental` con éxito | `playbook_candidate` | Si había obligaciones pendientes al cierre |
| `update_claim` → resolved | `playbook_candidate` | Si el claim duró más de 1 día |
| `update_obligation` después de una obligación autogenerada | `memory_candidate` | Si es el segundo mes consecutivo con la misma corrección |
| `process_specific_email` exitoso después de `list_recent_emails` | `memory_candidate` | El remitente real difiere del patrón guardado |
| Flujo con 3+ rounds de tool calls | `memory_candidate` | Señal de intent confuso → candidato a playbook |
| `verify_payment` después de `proof_uploaded` con delay > 5 días | `memory_candidate` | Patrón de owner lento para verificar |

La retrospectiva **no corre en**:
- Queries simples
- Flujos cron
- Cualquier flujo que no involucre una decisión del owner

---

## 3. Esquema de memoria operacional

### Capa 1 — Session memory (ya existe)

`loadChatHistory(phone, MAX_HISTORY)` — 12 mensajes.
No tocar. Responsabilidad: contexto de conversación inmediata.

---

### Capa 2 — Workspace operational memory (nueva)

Hechos y patrones ligados a un owner o workspace específico.
Se persiste en una tabla nueva de Prisma.

```prisma
model OperationalMemory {
  id          String   @id @default(cuid())
  ownerId     String
  workspaceId String?
  key         String
  value       String   @db.Text
  confidence  Float    @default(1.0)
  source      String   // "retrospective" | "advisor" | "manual"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner     OwnerProfile @relation(fields: [ownerId], references: [ownerId])
  workspace Workspace?   @relation(fields: [workspaceId], references: [id])

  @@unique([ownerId, workspaceId, key])
  @@index([ownerId])
}
```

**Ejemplos de entries:**

| key | value | scope |
|-----|-------|-------|
| `preferred_expensas_sender` | `"simplesolutions.com.ar"` | workspace |
| `owner_verifies_late` | `"true"` | owner |
| `common_correction_pattern` | `"due_date siempre se corrige a 15"` | workspace |
| `claim_type_history` | `"3x filtración, 1x puerta"` | workspace |

La memoria **influye en prompts solo cuando**:
- Está explícitamente consultada por el executor
- Tiene confidence >= 0.7
- Es del scope correcto (workspace o owner)

La memoria **NO influye en**:
- Flujos determinísticos (no se inyecta en tools simples)
- Transiciones de estado machine
- Cron jobs

---

### Capa 3 — Draft artifacts (nueva)

Candidatos generados por retrospectivas. Requieren revisión humana antes de activarse.

```prisma
model DraftArtifact {
  id            String   @id @default(cuid())
  type          DraftArtifactType
  title         String
  sourceEvent   String   // ej: "end_rental:workspace_abc"
  scope         String   // "workspace" | "global"
  workspaceId   String?
  ownerId       String?
  rationale     String   @db.Text
  confidence    Float
  proposedUsage String   @db.Text
  safetyNotes   String?  @db.Text
  content       String   @db.Text  // JSON estructurado o texto plano
  reviewStatus  DraftReviewStatus @default(draft)
  createdAt     DateTime @default(now())
  reviewedAt    DateTime?
  reviewedBy    String?

  workspace Workspace? @relation(fields: [workspaceId], references: [id])
}

enum DraftArtifactType {
  memory_candidate
  playbook_candidate
  skill_candidate
}

enum DraftReviewStatus {
  draft
  approved
  rejected
  revised
}
```

---

## 4. Formato de Draft Artifacts

Todos los artifacts se generan como JSON estructurado en el campo `content`.

### memory_candidate

```json
{
  "fact": "El owner corrige el due_date de expensas al día 15 todos los meses.",
  "context": "Workspace Casita Belgrano — template expensas ID tmpl_xxx",
  "suggested_action": "Actualizar el dueDay del template a 15 sin esperar corrección mensual.",
  "evidence": ["update_obligation:obl_aaa", "update_obligation:obl_bbb"]
}
```

### playbook_candidate

```json
{
  "trigger": "end_rental con obligaciones pendientes",
  "steps": [
    "Verificar si hay obligaciones no verificadas antes de cerrar.",
    "Preguntarle al owner qué hace con las pendientes: cancelar, mantener, verificar.",
    "Ejecutar el cierre solo después de confirmar la decisión."
  ],
  "template_message": "Antes de cerrar el alquiler, fijate que tenés X obligaciones sin verificar. ¿Las cancelamos o las dejás como están?",
  "evidence": ["end_rental:workspace_xyz"]
}
```

### skill_candidate

```json
{
  "capability": "pre_closure_audit",
  "description": "Auditoría automática antes de cerrar un alquiler: revisa obligaciones pendientes, recordatorios activos y comprobantes sin verificar.",
  "inputs": ["workspaceId"],
  "outputs": ["audit_report", "recommended_actions"],
  "dependencies": ["get_obligations", "list_reminders", "get_pending_proofs"],
  "safety": "Solo sugiere, no ejecuta acciones automáticamente."
}
```

---

## 5. Estructura de archivos propuesta

```
lib/
  advisor/
    advisor-client.ts      # llama a OpenAI como advisor (sin tools)
    advisor-gate.ts        # decide si un flow necesita advisor
    retrospective.ts       # corre retrospectivas post-evento
    memory.ts              # lee/escribe OperationalMemory
ops/
  memory-candidates/       # (opcional: archivos locales para review manual)
  playbook-candidates/
skills/
  drafts/
prisma/
  migrations/
    ...add_operational_memory/
    ...add_draft_artifact/
```

---

## 6. Reglas que aplican a todos los PRs siguientes

- Ningún draft se activa en producción sin revisión humana
- El advisor no llama tools
- El executor siempre es el punto de control
- Los servicios son la única fuente de mutación de estado
- La retrospectiva es asíncrona y no bloquea respuestas
- La memoria solo influye en prompts cuando está explícitamente consultada
- Ningún flujo determinístico se refactoriza a menos que el PR lo requiera explícitamente

---

## 7. Lo que NO se hace en este PR

- No se implementa el advisor client
- No se modifican los servicios existentes
- No se agrega ninguna tabla de Prisma todavía
- No se modifica `owner-agent.ts`
- No se crea ningún archivo en `lib/advisor/`

Todo eso es PR-17 en adelante.
