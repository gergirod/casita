# PR-17 — Advisor Pilot (mínimo)

_Estado: diseño aprobado, pendiente de implementación_
_Depende de: PR-16 diseño (aprobado)_
_Fecha: abril 2026_

---

## Alcance

Implementar el patrón executor + advisor de forma **quirúrgica y mínima**, sin tocar
state machines, services, ni flujos determinísticos existentes.

Flows cubiertos en este PR:
1. `delete_casita`
2. `end_rental`
3. Mensaje ambiguo cuando el owner tiene 2+ casitas (pre-flight gate)

**NO entra en este PR:**
- `update_rent`
- `update_claim`
- Memoria operacional
- Tablas Prisma nuevas
- Retrospectiva
- Skill drafts

---

## Contrato del Advisor

### Input (`AdvisorInput`)

```typescript
type AdvisorInput = {
  intent: "delete_casita" | "end_rental" | "ambiguous_multi_workspace"
  ownerMessage: string                // mensaje original del owner
  workspaces: WorkspaceSummary[]      // todas las casitas del owner
  operationalContext: {
    targetWorkspaceId?: string        // si el executor ya resolvió cuál casita
    pendingObligationsCount?: number  // obligaciones no verificadas en la casita
    activeRemindersCount?: number     // recordatorios programados activos
    tenantName?: string               // inquilino actual si lo hay
    hasProofPending?: boolean         // hay comprobante sin verificar
  }
}
```

### Output (`AdvisorOutput`)

```typescript
type AdvisorOutput = {
  plan: string              // qué debería pasar según el advisor
  risks: string[]           // lista de riesgos identificados (puede ser [])
  recommendation: string    // acción concreta recomendada al executor
  stop: boolean             // si true: NO ejecutar, explicar al owner
  stopReason?: string       // razón para detener (obligatoria si stop: true)
  confidence: number        // 0.0–1.0
}
```

### Reglas del Advisor

El advisor:
- Recibe solo texto + contexto estructurado
- **NO llama tools**
- **NO muta estado**
- **NO genera la respuesta final** — solo informa al executor
- Puede recomendar stop o allowance
- Sus respuestas son input para el executor, no output directo al owner

El executor:
- Siempre retiene control
- Si `stop: true` → responde al owner con `stopReason` reformulado en tono Casita
- Si `stop: false` → puede proceder (con o sin mencionar el advice al owner)
- Siempre loguea el uso del advisor en `ActivityLog`

---

## Dónde se inserta el gate

### Gate A — Tool-level (delete_casita, end_rental)

Ubicación: **`handleToolCall` en `lib/owner-agent.ts`**, antes de despachar la tool.

```
handleToolCall("delete_casita", args, owner)
  ↓
advisorGate("delete_casita", args, owner)   ← NUEVO
  ↓ si stop: true
  return stopMessage al owner
  ↓ si stop: false
  deleteCasita(ownerId, wsId, confirmation)  ← existente, sin tocar
```

El gate recibe el nombre de la tool, los args ya parseados, y el owner context.
Llama al advisor client con el contexto operacional enriquecido.

### Gate B — Message-level (ambiguous multi-workspace)

Ubicación: **`handleOwnerMessage` en `lib/owner-agent.ts`**, antes del primer call a OpenAI.

Condición de disparo — **todas** deben cumplirse (heurística conservadora):
1. Owner tiene 2 o más workspaces activos
2. El mensaje supera 15 caracteres
3. El mensaje no contiene el nombre de ninguna casita (case-insensitive)
4. El mensaje contiene una acción sensible (regex de verbos: borrar, terminar, cerrar, cambiar, modificar, registrar, agregar, crear en sus formas conjugadas)
5. El historial reciente (últimos 4 turnos) no tiene tool calls activos — evita dispararse mid-wizard

Si se cumple: llamar al advisor con intent `ambiguous_multi_workspace`.
Gate B **NO escribe en ActivityLog** (no hay workspaceId). Solo console log estructurado.
Si el advisor recomienda stop → guardar el stopMessage como mensaje del asistente y retornar.
Si el advisor permite → continuar el flujo normal.

**Nota:** la heurística es conservadora por diseño. Solo filtra queries obvias ("resumen", "cuánto me deben") y mid-wizard responses. Refinable en PR-17b.

---

## Archivos a crear / modificar

### Crear: `lib/advisor/advisor-client.ts`

Función única:

```typescript
export async function callAdvisor(input: AdvisorInput): Promise<AdvisorOutput>
```

Implementación:
- Modelo: `gpt-4o` (mismo que el executor — puede revisarse a `gpt-4o-mini` en beta)
- Temperature: 0.2 (respuestas estables, no creativas)
- Max tokens: 800
- Sin tools — solo completion de texto
- System prompt: rol de "Principal Agent Architect revisando una acción de alto riesgo en Casita"
- User prompt: serialización JSON del `AdvisorInput`
- Response: parsear JSON del content de la respuesta
- Fallback: si el parsing falla o hay error → retornar `{ stop: false, plan: "n/a", risks: [], recommendation: "proceed", confidence: 0, _fallback: true }`

**El fallback siempre es `stop: false`.** Si el advisor no responde, el executor procede normalmente. El advisor no puede bloquear el sistema si él mismo falla.

### Crear: `lib/advisor/advisor-gate.ts`

Dos funciones:

```typescript
// Gate A: se llama antes de despachar una tool de alto riesgo
export async function toolAdvisorGate(
  toolName: "delete_casita" | "end_rental",
  args: Record<string, unknown>,
  ownerId: string,
  workspaces: WorkspaceSummary[],
  ownerMessage: string
): Promise<{ proceed: boolean; stopMessage?: string }>

// Gate B: se llama antes del primer LLM call
export async function messageAdvisorGate(
  ownerMessage: string,
  workspaces: WorkspaceSummary[],
  recentHistory: OpenAI.ChatCompletionMessageParam[]
): Promise<{ proceed: boolean; stopMessage?: string }>
```

Ambas funciones:
1. Verifican `ADVISOR_PILOT_ENABLED` — si false, retornan `{ proceed: true }` directamente
2. Construyen el `AdvisorInput`
3. Llaman `callAdvisor(input)`
4. Loguean el resultado en `ActivityLog` (ver sección Observabilidad)
5. Si `stop: true` → retornan `{ proceed: false, stopMessage: reformulatedMessage }`
6. Si `stop: false` → retornan `{ proceed: true }`

### Modificar: `lib/owner-agent.ts`

Cambios:
1. Importar `toolAdvisorGate` y `messageAdvisorGate`
2. En `handleOwnerMessage`: insertar Gate B antes del primer LLM call
3. En `handleToolCall`, cases `delete_casita` y `end_rental`: insertar Gate A antes de llamar a la función de implementación

Cambios fuera de estos puntos: **ninguno**.
No tocar system prompt, tool definitions, otros cases del dispatcher, ni la lógica de tool rounds.

---

## Feature flag

Variable de entorno: `ADVISOR_PILOT_ENABLED`

- `"true"` → el advisor se activa
- cualquier otro valor / ausente → el advisor se saltea silenciosamente

Se verifica en el gate, no en el cliente.
No hay UI para este flag en este PR.
Se documenta en `.env.local` como comentario.

---

## Observabilidad

No se crean tablas nuevas. Se usa `ActivityLog` que ya existe.

### Acciones de observabilidad

| Evento | Acción en ActivityLog | Console log |
|--------|-----------------------|-------------|
| Advisor permite la acción (Gate A) | `advisor.consulted` | `event: "advisor.consulted"` |
| Advisor recomienda stop (Gate A) | `advisor.stopped` | `event: "advisor.stopped"` |
| Advisor falla / timeout | — no ActivityLog — | `event: "advisor.failed"` |

**Gate B (ambiguous_multi_workspace) nunca escribe en `ActivityLog`** porque no hay `workspaceId` resuelto en ese momento. Solo usa console log estructurado.

### Gate A — ActivityLog (tiene workspaceId de los args):

```typescript
// advisor.consulted
await prisma.activityLog.create({
  data: {
    workspaceId,           // siempre disponible en delete_casita / end_rental
    actorType: "system",
    actorId: ownerId,
    action: "advisor.consulted",
    entityType: "advisor",
    channel: "whatsapp",
    metadata: { intent, confidence, risks, recommendation, durationMs, fallback },
  },
})

// advisor.stopped
await prisma.activityLog.create({
  data: {
    ...
    action: "advisor.stopped",
    metadata: { intent, stopReason, confidence, risks, durationMs },
  },
})
```

### Console log estructurado (todos los casos, Gate A y Gate B):

```typescript
// advisor.consulted
console.log(JSON.stringify({ level: "info", event: "advisor.consulted", intent, ownerId, confidence, risks: N, durationMs }))

// advisor.stopped
console.log(JSON.stringify({ level: "warn", event: "advisor.stopped", intent, ownerId, stopReason, durationMs }))

// advisor.failed (timeout / parse error)
console.log(JSON.stringify({ level: "error", event: "advisor.failed", intent, error, durationMs }))
```

---

## System prompt del Advisor

```
Sos un Principal Agent Architect revisando una acción en Casita, un sistema de gestión
de alquileres para propietarios LATAM.

Tu trabajo es revisar la acción que el executor está a punto de tomar y:
1. Identificar riesgos operacionales o consecuencias no obvias
2. Recomendar si proceder o pausar (stop)
3. Si pausás, dar una razón clara que el executor pueda traducir al owner

REGLAS ESTRICTAS:
- No tenés acceso a tools ni a bases de datos. Ragzonás solo sobre lo que te dan.
- No generás respuestas para el owner — solo para el executor.
- Si todo parece correcto, decís stop: false con risks: [].
- Si hay un riesgo claro, lo describís y podés recomendar stop: true.
- Nunca inventés riesgos que no están respaldados por el contexto dado.
- No sobreanalicés. Un "OK, proceder" es una respuesta válida.

Respondé SIEMPRE con JSON válido siguiendo exactamente este schema:
{
  "plan": "...",
  "risks": ["...", "..."],
  "recommendation": "...",
  "stop": false,
  "stopReason": null,
  "confidence": 0.9
}
```

---

## Riesgos de compatibilidad

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| El advisor agrega latencia en delete_casita y end_rental | Baja — son flows lentos por naturaleza | Timeout de 8s en callAdvisor; fallback = proceed |
| El advisor falla y bloquea la respuesta | Alta | Fallback siempre es `stop: false` + log |
| Gate B activa advisor en mensajes cortos del wizard | Media | Condición de longitud > 15 chars + chequeo de historial |
| Gate B produce falsos positivos con owner de 2+ casitas | Media | Heurística conservadora; refinamiento en PR-17b |
| ActivityLog.workspaceId es requerido para algunos flows | Baja | Gate B usa el primer workspace como fallback; Gate A ya resolvió el workspace |
| El advisor recomienda stop en delete_casita legítimo | Baja | Owner puede reenviar el mensaje; el advisor ve el mismo contexto la segunda vez |
| Costo de tokens por llamada extra al advisor | Bajo en piloto | Flag desactivado en producción hasta validar |

---

## Criterios de aceptación

- [ ] `ADVISOR_PILOT_ENABLED=false` → cero cambios en comportamiento respecto a hoy
- [ ] `delete_casita` con pending obligations → advisor retorna risks no vacíos
- [ ] `delete_casita` sin pending obligations → advisor retorna stop: false
- [ ] `end_rental` con pending proof → advisor retorna risks no vacíos
- [ ] Advisor falla (timeout/error) → el flujo continúa normalmente
- [ ] `ActivityLog` registra `advisor.allowed` y `advisor.stop` correctamente
- [ ] Vercel logs muestran el structured log en cada invocación
- [ ] Ningún test de flujos determinísticos regresa (si existen)
- [ ] El system prompt de owner-agent no cambia
- [ ] Ningún service ni state machine fue modificado

---

## Lo que NO entra en este PR

- Memoria operacional (PR-19)
- Retrospectiva (PR-18)
- Draft artifacts (PR-18)
- Tablas Prisma nuevas
- UI de revisión de artifacts (PR-20)
- update_rent, update_claim como flows con advisor
- Advisor en tenant-agent
- Advisor en cron jobs
