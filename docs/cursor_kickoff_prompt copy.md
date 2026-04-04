# Cursor Kickoff Prompt — Start Executing

Quiero que trabajes siguiendo estrictamente:
- `specs/`
- `.cursor/rules/`
- `docs/ai/cursor_master_prompt.md` o `cursor_master_prompt.md`

## Tu tarea ahora
1. Confirmá que las reglas de `.cursor/rules/` fueron leídas.
2. Leé todos los archivos de `specs/`.
3. Creá `docs/spec_gap_analysis.md`.
4. Creá `docs/spec_implementation_plan.md`.
5. Proponé el contenido exacto de PR-01 sin tocar todavía features nuevas.
6. Ejecutá PR-01 con foco en:
   - cleanup
   - seguridad
   - renombre de archivos confusos
   - borrar código muerto
7. Después de PR-01, mostrá el diff conceptual y seguí con PR-02.

## Restricciones
- No agregues features fuera del wedge V1.
- No reescribas todo de golpe.
- No dupliques lógica entre web y WhatsApp.
- No dejes estado crítico dentro del prompt.
- No metas Prisma directo en skills si existe o puede existir un service.

## Definition of success
El repo debe empezar a converger hacia:
- `lib/services/*`
- `lib/workflows/*`
- `ActivityLog`
- dashboard como control tower
- WhatsApp como interfaz operativa principal
