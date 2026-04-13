# 04 — Skill Drafts

## Goal
Use learned experience to propose reusable operational capabilities without autonomous activation.

## Draft artifact types

### A. Memory candidate
A durable fact or pattern worth storing.

### B. Playbook candidate
A procedure or SOP for handling a recurring operational scenario.

### C. Skill draft
A reusable, explicit capability proposal that could later become a formal skill.

## Storage proposal

```text
ops/
  memory-candidates/
  playbook-candidates/
skills/
  drafts/
```

## Required metadata for every draft
- title
- source event(s)
- workspace scope or global scope
- rationale
- confidence
- proposed usage
- safety notes
- review status

## Review states
- draft
- approved
- rejected
- revised

## Rule
No draft may alter runtime behavior until explicitly reviewed and promoted.
