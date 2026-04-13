# Hermes + Advisor Pack for Casita

This pack is a **spec-driven development starter** for adding two controlled capabilities to Casita **without rewriting the MVP core**:

1. **Advisor pilot** for complex owner/backoffice decisions
2. **Learning loop + layered memory + skill drafts** inspired by Hermes

## Principle

Keep Casita's current architecture intact:
- services execute
- state machines control transitions
- ActivityLog records what happened
- WhatsApp is the operational interface
- web is mission control

Add intelligence **around** the core, not **inside** the critical deterministic paths.

## What this pack is for

Use this pack to guide Cursor through:
- analysis
- design
- controlled implementation
- acceptance checks

## Suggested order

1. `docs/ai/cursor_master_prompt.md`
2. `specs/00_decision_summary.md`
3. `specs/01_target_architecture.md`
4. `specs/02_advisor_pilot.md`
5. `specs/03_learning_loop_memory.md`
6. `specs/04_skill_drafts.md`
7. `specs/05_pr_sequence.md`
8. `.cursor/rules/`
