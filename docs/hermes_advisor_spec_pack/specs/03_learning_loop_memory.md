# 03 — Learning Loop + Memory

## Goal
Create a controlled learning loop inspired by Hermes without autonomous production mutation.

## Layered memory model

### Layer 1 — session/task memory
Short-lived context for the current conversation or workflow.

### Layer 2 — workspace operational memory
Facts and patterns tied to a workspace, owner, or tenant, for example:
- preferred payment method
- common support issues
- common confusion points
- recurring manual corrections

### Layer 3 — reusable operational memory
Cross-workspace patterns that can become:
- support playbooks
- response templates
- skill drafts
- checklists

## Retrospective trigger candidates
Run retrospective after selected events only:
- cycle completed successfully
- support case resolved
- proof/payment loop failed then recovered
- owner confusion resolved
- repeated manual intervention pattern

## Retrospective output
A retrospective should output structured candidates, not free prose:
- `memory_candidate`
- `playbook_candidate`
- `skill_candidate`
- `no_learned_artifact`

## Important rule
Retrospective output is draft material only.
Nothing auto-activates in production.
