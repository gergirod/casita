# 05 — Suggested PR Sequence

## PR-16 — Analysis + design only
- identify candidate owner-agent flows for advisor use
- define retrospective triggers
- define memory schema / storage approach
- define draft artifact format

## PR-17 — Advisor pilot
- add advisor gating for selected owner-agent flows
- add logging around advisor usage
- add fallback when advisor unavailable

## PR-18 — Retrospective loop
- add post-task retrospective for selected workflows
- emit candidate artifacts into draft folders or draft tables

## PR-19 — Memory layer
- persist workspace operational memory
- add retrieval rules for when memory can influence prompts

## PR-20 — Review tooling / workflow
- create minimal review flow for approving or rejecting draft artifacts

## Rule across all PRs
- no autonomous production mutation
- no rewrite of existing core services/state-machine logic
- no feature sprawl
