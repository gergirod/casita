# 02 — Advisor Pilot

## Goal
Add an executor + advisor pattern only where higher-order reasoning improves outcomes.

## Good candidate flows
- ambiguous owner requests with multiple possible actions
- support/backoffice triage
- conflict-heavy decisions
- multi-step owner planning requests
- future negotiation/dispute preparation (not implementation yet)

## Bad candidate flows
- tenant asks what they owe
- tenant uploads proof
- owner verifies obvious payment
- reminder sending
- cron jobs
- any flow already governed cleanly by services and state machine

## Decision policy
The executor should call advisor only when one or more are true:
- low confidence in intent resolution
- multiple valid next actions with trade-offs
- high-risk owner-facing guidance
- complex support diagnosis
- request spans multiple workspaces / obligations / claims

## Advisor responsibilities
- propose plan
- identify risks
- suggest stop / escalate
- recommend next deterministic action

## Advisor must NOT
- call tools directly
- mutate state directly
- generate final user-facing answer without executor wrapping
- bypass service validations

## First implementation target
Add advisor gating only inside owner-agent for a small set of complex intents.

## Acceptance
- simple flows stay advisor-free
- complex flows optionally use advisor
- fallback remains safe if advisor unavailable
- logs capture when advisor was used and why
