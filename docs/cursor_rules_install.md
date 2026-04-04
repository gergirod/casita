# Cursor Rules Install Guide

## Dónde va cada cosa en el repo

### 1. Specs
Copiar esta carpeta:
- `specs/`

Destino recomendado:
- `<repo>/specs/`

### 2. Cursor rules
Copiar esta carpeta:
- `.cursor/rules/`

Destino exacto:
- `<repo>/.cursor/rules/`

### 3. Prompts de arranque
Copiar estos archivos en la raíz del repo o en `docs/ai/`:
- `cursor_master_prompt.md`
- `cursor_kickoff_prompt.md`

Destino recomendado:
- `<repo>/docs/ai/cursor_master_prompt.md`
- `<repo>/docs/ai/cursor_kickoff_prompt.md`

## Regla importante
Cursor no debe mover la lógica de negocio a prompts.
Los prompts viven en `docs/ai/` o `specs/`.
La lógica vive en:
- `lib/services/`
- `lib/workflows/`
- `lib/ai/`
- `lib/router/`
- `app/api/`

## Estructura objetivo mínima
```text
<repo>/
  .cursor/
    rules/
  specs/
  docs/
    ai/
  lib/
    services/
    workflows/
    ai/
    router/
```
