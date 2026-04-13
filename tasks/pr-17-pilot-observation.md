# PR-17 Pilot Observation Guide

_Documento de evaluación del advisor pilot — no es implementación_
_Fecha: abril 2026_

---

## Contexto

El advisor está activo en 3 flows:
- `delete_casita`
- `end_rental`
- mensajes ambiguos con 2+ casitas (Gate B)

El flag `ADVISOR_PILOT_ENABLED=true` activa el piloto.
Todos los logs están en Vercel (structured JSON) y en `ActivityLog` (Gate A).

---

## 1. Métricas y logs a mirar

### En Vercel Logs (todos los gates)

Filtrar por `event` en el JSON estructurado:

| Evento | Qué mide |
|--------|----------|
| `advisor.consulted` | Cuántas veces el advisor fue invocado y permitió la acción |
| `advisor.stopped` | Cuántas veces el advisor recomendó pausar |
| `advisor.failed` | Cuántas veces el advisor falló o hizo timeout |

Campos clave a registrar por evento:
- `intent` — cuál de los 3 flows disparó el advisor
- `confidence` — qué tan seguro está el advisor de su recomendación
- `risks` — cantidad de riesgos identificados
- `durationMs` — latencia del advisor

### En ActivityLog (solo Gate A: delete_casita, end_rental)

Query útil para evaluar:
```sql
SELECT action, metadata, created_at
FROM "ActivityLog"
WHERE action IN ('advisor.consulted', 'advisor.stopped')
  AND entity_type = 'advisor'
ORDER BY created_at DESC;
```

Métricas a extraer de `metadata`:
- `confidence` promedio por intent
- `risks[]` más frecuentes
- ratio `advisor.stopped / advisor.consulted` por intent

### Tasa de invocación Gate B

Gate B no escribe en ActivityLog, así que la única fuente es Vercel.
Clave: ¿cuántas veces se dispara vs cuántas veces el owner tiene 2+ casitas?
Si se dispara en >30% de los mensajes con 2+ workspaces → Gate B demasiado amplio.
Si se dispara en <5% → puede ser que la heurística es demasiado conservadora, o los owners no envían mensajes ambiguos.

---

## 2. Cómo evaluar si el advisor aporta valor real

### Pregunta central: ¿el advisor dice algo que el executor no haría solo?

El advisor aporta valor si:
- `stop: true` + el owner luego **no** repite el pedido (señal: evitó un error)
- `stop: true` + el owner **reformula** el pedido con más contexto (señal: clarificó la intención)
- `risks[]` no vacíos + la acción era efectivamente riesgosa en ese contexto
- `confidence` alta + recomendación coherente con el contexto operacional

El advisor **no** aporta valor si:
- `stop: false` + `risks: []` + `recommendation: "proceed"` en todos los casos → es un no-op costoso
- `stop: true` con `stopReason` genérico o no relacionado con el contexto real
- `_fallback: true` frecuente → hay timeouts o errores silenciosos
- `confidence` siempre < 0.5 → el modelo no tiene suficiente contexto para opinar

### Sesión de revisión manual

Después de 10–20 invocaciones reales, revisar manualmente en ActivityLog:
1. ¿Los `risks[]` descriptos eran reales o inventados?
2. ¿Algún `stop: true` evitó algo que hubiera sido un problema?
3. ¿Algún `stop: true` era falso positivo (el owner sabía lo que hacía)?
4. ¿La `recommendation` era accionable o genérica?

No hay métrica automática para esto. Requiere ojo humano en esta fase.

---

## 3. Señales de decisión

### Mantenerlo (steady state)

- `advisor.stopped` aparece al menos 1 vez en 10–20 invocaciones
- El `stopReason` en esos casos describe un riesgo real y específico
- `_fallback` < 5% de las invocaciones
- `durationMs` promedio < 4000ms
- El owner que recibió un `stop` no queda trabado — puede reformular y seguir

### Recortarlo (reducir scope o deshabilitar)

- `_fallback` > 20% → el advisor es poco confiable bajo carga
- `durationMs` > 6000ms consistentemente → agrega latencia inaceptable en flows sensibles
- `stop: true` pero todos los `stopReason` son genéricos o no relacionados con el contexto dado
- Ningún `advisor.stopped` en 30+ invocaciones → el advisor nunca aporta nada
- El owner reporta confusión al recibir el stop message

### Ampliarlo (solo después de validar el piloto)

- `advisor.stopped` evitó errores reales en al menos 3 casos verificados manualmente
- `confidence` promedio > 0.75
- `durationMs` estable < 3000ms
- Gate B disparó en casos realmente ambiguos (verificado revisando los mensajes)
- El owner reformuló con éxito después de un stop en Gate B

Ampliar significaría agregar flows como `update_rent`, `update_claim` → resolved.
Esto sería PR-17b, no PR-18.

---

## 4. Ejemplos reales de outputs a capturar

Para que el advisor sea evaluable necesitamos capturar ejemplos concretos
con el contexto real que recibió. Los logs actuales capturan `risks.length` y `confidence`,
pero **no capturan el texto completo del output del advisor**.

Para esta fase del piloto, conviene loguear el output completo en al menos algunos casos.

### Casos que queremos capturar

**Caso 1 — delete_casita con obligaciones pendientes**
```json
{
  "intent": "delete_casita",
  "operationalContext": {
    "pendingObligationsCount": 2,
    "hasProofPending": true,
    "tenantName": "Juan Pérez"
  }
}
```
Output esperado: `stop: true` con `stopReason` mencionando las 2 obligaciones pendientes y el comprobante sin verificar.

**Caso 2 — delete_casita limpia**
```json
{
  "intent": "delete_casita",
  "operationalContext": {
    "pendingObligationsCount": 0,
    "hasProofPending": false,
    "tenantName": null
  }
}
```
Output esperado: `stop: false`, `risks: []`, `confidence` > 0.8.

**Caso 3 — end_rental con recordatorios activos**
```json
{
  "intent": "end_rental",
  "operationalContext": {
    "pendingObligationsCount": 1,
    "activeRemindersCount": 2,
    "tenantName": "María García"
  }
}
```
Output esperado: `stop: true` mencionando los recordatorios activos que quedarán huérfanos.

**Caso 4 — end_rental limpio**
```json
{
  "intent": "end_rental",
  "operationalContext": {
    "pendingObligationsCount": 0,
    "activeRemindersCount": 0,
    "hasProofPending": false
  }
}
```
Output esperado: `stop: false`, `risks: []`.

**Caso 5 — ambiguous_multi_workspace con verbo de acción**
```json
{
  "intent": "ambiguous_multi_workspace",
  "ownerMessage": "terminá el alquiler",
  "workspaces": [
    { "id": "ws1", "name": "Casita Belgrano", "tenant": "Juan" },
    { "id": "ws2", "name": "Depto Palermo", "tenant": "María" }
  ]
}
```
Output esperado: `stop: true` con stopReason pidiendo clarificación de cuál casita.

**Caso 6 — ambiguous con context suficiente (Gate B no debería haberlo interceptado)**
Si Gate B dispara en mensajes que NO son ambiguos, ese caso es un falso positivo y debe documentarse para ajustar el regex o las condiciones.

### Cómo capturar outputs completos (sin cambiar código ahora)

Por ahora, si necesitás ver el output completo del advisor en un caso específico:
1. Buscá en Vercel Logs el `event: "advisor.stopped"` con el contexto de la sesión
2. Revisá en ActivityLog el `metadata` del registro correspondiente
3. Si necesitás el full output, temporalmente podés agregar `fullOutput: output` en `logMeta` en advisor-gate.ts — pero no hacerlo en producción por default (costo de storage)

Alternativa: abrir un `DraftArtifact` manualmente con el output copiado del log, como candidate de revisión. Esto conecta naturalmente con PR-18.

---

## Criterio para avanzar a PR-18

PR-18 (retrospectiva + draft artifacts) tiene sentido arrancar cuando:

1. El piloto de PR-17 tuvo al menos **5–10 invocaciones reales** en algún ambiente
2. Al menos un `advisor.stopped` fue verificado como correcto manualmente
3. El `durationMs` promedio es aceptable (< 4s)
4. No hay `_fallback` frecuente (< 10%)

Si no se cumple ninguno de estos criterios, primero se evalúa si PR-17 necesita ajuste antes de agregar más capas.

---

## Próximos pasos después de este doc

1. Activar `ADVISOR_PILOT_ENABLED=true` en staging/preview
2. Ejecutar manualmente los 6 casos ejemplo de arriba
3. Revisar outputs en Vercel Logs y ActivityLog
4. Documentar resultados brevemente (5–10 líneas por caso)
5. Decidir: mantener / recortar / avanzar a PR-18
