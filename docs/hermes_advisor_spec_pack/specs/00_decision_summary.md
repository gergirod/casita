# 00 — Decision Summary

## Decision

### We will NOT
- adopt Hermes as the base runtime for Casita
- add autonomous self-installing skills to production
- replace the current service/state-machine architecture
- use advisor for simple operational flows

### We WILL
- pilot an executor + advisor pattern for hard owner/backoffice decisions
- add a Hermes-inspired retrospective loop after selected tasks
- add layered operational memory
- generate **draft** skill / playbook / memory candidates for human review

## Why
Casita is not a general autonomous coding agent.
It is a vertical operational system where payment, claims, reminders, and status changes must stay deterministic.

The current bottleneck is not model capability alone. It is:
- context reuse
- support playbooks
- ambiguous owner requests
- operational learning across cycles

## Success criteria
1. Better handling of ambiguous owner requests
2. Better reuse of operational lessons
3. No regression in deterministic flows
4. No hidden self-modification in production
5. Clear human review loop for learned artifacts
