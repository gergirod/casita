/**
 * Claims state machine — pure unit tests.
 *
 * Run with:
 *   npx tsx lib/services/__tests__/claims.test.ts
 *
 * No test framework needed — uses Node.js built-in assert.
 * All functions tested here are pure (no DB, no side effects).
 */

import assert from "node:assert/strict";
import {
  isValidClaimTransition,
  getAllowedClaimTransitions,
} from "../claims.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// ─── getAllowedClaimTransitions — structure ───────────────────────

console.log("\n[getAllowedClaimTransitions — transition table shape]");

test("open has exactly 2 allowed transitions", () => {
  const allowed = getAllowedClaimTransitions("open");
  assert.equal(allowed.length, 2, `Expected 2, got ${allowed.length}: ${allowed}`);
});

test("open allows in_progress and resolved", () => {
  const allowed = getAllowedClaimTransitions("open");
  assert.ok(allowed.includes("in_progress"), "missing in_progress");
  assert.ok(allowed.includes("resolved"), "missing resolved");
});

test("in_progress has exactly 1 allowed transition", () => {
  const allowed = getAllowedClaimTransitions("in_progress");
  assert.equal(allowed.length, 1);
});

test("in_progress only allows resolved", () => {
  assert.deepEqual(getAllowedClaimTransitions("in_progress"), ["resolved"]);
});

test("resolved has 0 allowed transitions (terminal)", () => {
  assert.deepEqual(getAllowedClaimTransitions("resolved"), []);
});

test("unknown status returns [] (safe fallback)", () => {
  assert.deepEqual(getAllowedClaimTransitions("nonexistent"), []);
});

// ─── isValidClaimTransition — valid paths ────────────────────────

console.log("\n[isValidClaimTransition — valid transitions]");

test("open → in_progress is valid", () =>
  assert.ok(isValidClaimTransition("open", "in_progress")));

test("open → resolved is valid (direct close)", () =>
  assert.ok(isValidClaimTransition("open", "resolved")));

test("in_progress → resolved is valid", () =>
  assert.ok(isValidClaimTransition("in_progress", "resolved")));

// ─── isValidClaimTransition — invalid paths ──────────────────────

console.log("\n[isValidClaimTransition — invalid / blocked transitions]");

test("resolved → open is INVALID (terminal)", () =>
  assert.ok(!isValidClaimTransition("resolved", "open")));

test("resolved → in_progress is INVALID (terminal)", () =>
  assert.ok(!isValidClaimTransition("resolved", "in_progress")));

test("in_progress → open is INVALID (no rollback)", () =>
  assert.ok(!isValidClaimTransition("in_progress", "open")));

test("open → open self-transition is INVALID", () =>
  assert.ok(!isValidClaimTransition("open", "open")));

test("in_progress → in_progress self-transition is INVALID", () =>
  assert.ok(!isValidClaimTransition("in_progress", "in_progress")));

test("unknown_status → resolved is INVALID (unknown from)", () =>
  assert.ok(!isValidClaimTransition("unknown_status", "resolved")));

test("open → unknown_target is INVALID", () =>
  assert.ok(!isValidClaimTransition("open", "unknown_target")));

// ─── Summary ─────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
