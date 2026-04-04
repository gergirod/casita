# 02 — Architecture Overview

## Arquitectura objetivo
Casita debe converger a un **monolito modular, stateful y channel-agnostic**.

## Principio
WhatsApp es la interfaz operativa.
La web es el dashboard de control.
Ambos usan el mismo core.

## Diagrama
```text
WhatsApp / Web / Cron / Webhooks
            |
            v
   Identity + Context Layer
            |
            v
   Intent Classifier / Router
            |
            v
         Skill Layer
            |
            v
    Service / Action Layer
            |
            v
     State + Workflows
            |
            v
      ActivityLog / Audit
            |
            v
       Channel Response
```

## Qué significa cada capa
### Identity + Context
Resuelve:
- quién escribe
- qué rol tiene
- qué workspace/unit toca
- qué obligación o caso está activo

### Intent Classifier / Router
Resuelve:
- qué quiere hacer
- con qué confidence
- si hace falta pedir aclaración

### Skill Layer
Playbooks chicos y explícitos.
No deben contener lógica pesada de negocio.

### Service Layer
Fuente única de verdad.
Acá vive la lógica real:
- queries
- validaciones
- state transitions
- side effects
- logging

### State + Workflows
Cada caso importante debe tener estados explícitos.

### ActivityLog
Cada acción importante debe quedar registrada.

## Reglas
- No duplicar lógica entre web y WhatsApp
- No dejar lógica de negocio principal dentro del prompt
- No dejar state transitions repartidas por el repo
- No meter Prisma directo en 20 lugares si existe un service

## Por qué esta arquitectura
Permite:
- shipping rápido
- refactor incremental
- mejor testeo
- agregar nuevas skills sin romper todo
- escalar a más workflows como aumento de alquiler o disputa
