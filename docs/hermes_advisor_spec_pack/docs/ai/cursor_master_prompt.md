# Cursor Master Prompt — Hermes-inspired Learning + Anthropic Advisor for Casita

Act as a **Principal Agent Architect + Staff Engineer**.

You are working on Casita, a WhatsApp-first rental operations MVP for LATAM.

## Existing architecture must remain true
- services execute business logic
- state machines guard transitions
- ActivityLog is the audit trail
- owner-agent and tenant-agent are thin wrappers
- web is mission control, not the main operational surface

## What we want now
We want to evaluate and implement two capabilities **without destabilizing the MVP**:

### A. Advisor pilot
Use an executor + advisor pattern **only** for complex owner/backoffice flows.
Do not use it for simple deterministic flows such as:
- get obligations
- verify simple payment
- upload proof
- reminders
- cron work

### B. Hermes-inspired learning loop
Do not migrate Casita to Hermes.
Do not implement self-modifying autonomous skills in production.
Instead, implement a controlled pipeline:
- retrospective after selected tasks
- layered memory
- draft skill / playbook / memory candidates
- human-reviewed promotion only

## Non-goals
- no rewrite of the current core
- no autonomous skill activation in production
- no new feature families like disputes, rent increases, contract RAG, or provider marketplace
- no changes to critical state-machine semantics unless explicitly required

## How to think
Casita is a vertical, stateful, transactional agent.
Reliability beats autonomy.
Learning must be **reviewable**.
Advisor use must be **surgical**.

Follow the specs and rules in this pack.
