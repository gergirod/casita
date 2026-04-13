# 01 — Target Architecture

## Base architecture stays

```text
WhatsApp / Web / Cron / Webhooks
        -> Context resolution
        -> Thin agent wrappers
        -> Services
        -> State machines
        -> ActivityLog
```

## New intelligence layers

```text
                    +----------------------+
                    |  Advisor (complex)   |
                    |  planning / critique |
                    +----------+-----------+
                               ^
                               |
Executor (owner-agent) --------+
  |
  +--> normal services/state machine paths
  +--> post-task retrospective
            |
            +--> memory candidate
            +--> playbook candidate
            +--> skill draft
```

## Design constraints
- advisor never owns the final state mutation directly
- services remain the only place where business logic executes
- retrospective never changes production behavior directly
- generated artifacts land in draft folders first
