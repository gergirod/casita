/**
 * Obligation State Machine — pure unit tests.
 *
 * Run with:
 *   npx tsx lib/services/__tests__/obligation-state-machine.test.ts
 *
 * No test framework needed — uses Node.js built-in assert.
 * All functions tested here are pure (no DB, no side effects).
 */

import assert from "node:assert/strict";
import {
  isValidOwnerTransition,
  getAllowedOwnerTransitions,
  canMarkReminded,
  canMarkOverdue,
  canExternalVerify,
  isKnownStatus,
  OWNER_TRANSITIONS,
  type ObligationStatus,
} from "../obligation-state-machine.js";

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

// ─── isValidOwnerTransition ─────────────────────────────────────

console.log("\n[isValidOwnerTransition]");

test("upcoming → pending is valid", () =>
  assert.ok(isValidOwnerTransition("upcoming", "pending")));

test("upcoming → overdue is valid", () =>
  assert.ok(isValidOwnerTransition("upcoming", "overdue")));

test("upcoming → verified is valid", () =>
  assert.ok(isValidOwnerTransition("upcoming", "verified")));

test("pending → reminded is valid", () =>
  assert.ok(isValidOwnerTransition("pending", "reminded")));

test("pending → cancelled is valid", () =>
  assert.ok(isValidOwnerTransition("pending", "cancelled")));

test("reminded → pending (undo) is valid", () =>
  assert.ok(isValidOwnerTransition("reminded", "pending")));

test("proof_uploaded → verified is valid", () =>
  assert.ok(isValidOwnerTransition("proof_uploaded", "verified")));

test("proof_uploaded → pending (owner rejected proof) is valid", () =>
  assert.ok(isValidOwnerTransition("proof_uploaded", "pending")));

test("proof_uploaded → cancelled is valid", () =>
  assert.ok(isValidOwnerTransition("proof_uploaded", "cancelled")));

test("overdue → verified is valid", () =>
  assert.ok(isValidOwnerTransition("overdue", "verified")));

test("overdue → pending (reactivate) is valid", () =>
  assert.ok(isValidOwnerTransition("overdue", "pending")));

test("cancelled → pending (reopen manual) is valid", () =>
  assert.ok(isValidOwnerTransition("cancelled", "pending")));

// Terminal: verified
test("verified → pending is INVALID (terminal)", () =>
  assert.ok(!isValidOwnerTransition("verified", "pending")));

test("verified → cancelled is INVALID (terminal)", () =>
  assert.ok(!isValidOwnerTransition("verified", "cancelled")));

test("verified → overdue is INVALID (terminal)", () =>
  assert.ok(!isValidOwnerTransition("verified", "overdue")));

test("verified → upcoming is INVALID (terminal)", () =>
  assert.ok(!isValidOwnerTransition("verified", "upcoming")));

// Terminal-ish: cancelled (only one exit)
test("cancelled → verified is INVALID", () =>
  assert.ok(!isValidOwnerTransition("cancelled", "verified")));

test("cancelled → overdue is INVALID", () =>
  assert.ok(!isValidOwnerTransition("cancelled", "overdue")));

test("cancelled → reminded is INVALID", () =>
  assert.ok(!isValidOwnerTransition("cancelled", "reminded")));

// Same-state self-transition
test("pending → pending self-transition is INVALID", () =>
  assert.ok(!isValidOwnerTransition("pending", "pending")));

// ─── getAllowedOwnerTransitions ──────────────────────────────────

console.log("\n[getAllowedOwnerTransitions]");

test("verified has no allowed transitions (terminal)", () => {
  const allowed = getAllowedOwnerTransitions("verified");
  assert.deepEqual(allowed, []);
});

test("cancelled has only [pending] as allowed transition", () => {
  const allowed = getAllowedOwnerTransitions("cancelled");
  assert.deepEqual(allowed, ["pending"]);
});

test("proof_uploaded allows [verified, cancelled, pending]", () => {
  const allowed = getAllowedOwnerTransitions("proof_uploaded");
  assert.deepEqual(allowed, ["verified", "cancelled", "pending"]);
});

test("upcoming has 5 allowed transitions", () => {
  const allowed = getAllowedOwnerTransitions("upcoming");
  assert.equal(allowed.length, 5);
});

// ─── canMarkReminded ─────────────────────────────────────────────

console.log("\n[canMarkReminded — cron]");

test("upcoming can be marked reminded", () =>
  assert.ok(canMarkReminded("upcoming")));

test("pending can be marked reminded", () =>
  assert.ok(canMarkReminded("pending")));

test("reminded can be marked reminded (idempotent re-send)", () =>
  assert.ok(canMarkReminded("reminded")));

test("proof_uploaded cannot be marked reminded", () =>
  assert.ok(!canMarkReminded("proof_uploaded")));

test("verified cannot be marked reminded", () =>
  assert.ok(!canMarkReminded("verified")));

test("cancelled cannot be marked reminded", () =>
  assert.ok(!canMarkReminded("cancelled")));

test("overdue cannot be marked reminded", () =>
  assert.ok(!canMarkReminded("overdue")));

// ─── canMarkOverdue ──────────────────────────────────────────────

console.log("\n[canMarkOverdue — cron]");

test("upcoming can be marked overdue", () =>
  assert.ok(canMarkOverdue("upcoming")));

test("pending can be marked overdue", () =>
  assert.ok(canMarkOverdue("pending")));

test("reminded can be marked overdue", () =>
  assert.ok(canMarkOverdue("reminded")));

test("proof_uploaded CANNOT be marked overdue (protected)", () =>
  assert.ok(!canMarkOverdue("proof_uploaded")));

test("verified CANNOT be marked overdue (terminal)", () =>
  assert.ok(!canMarkOverdue("verified")));

test("cancelled CANNOT be marked overdue", () =>
  assert.ok(!canMarkOverdue("cancelled")));

test("overdue CANNOT be marked overdue (already there)", () =>
  assert.ok(!canMarkOverdue("overdue")));

// ─── canExternalVerify ───────────────────────────────────────────

console.log("\n[canExternalVerify — MP webhook]");

test("pending can be externally verified", () =>
  assert.ok(canExternalVerify("pending")));

test("proof_uploaded can be externally verified", () =>
  assert.ok(canExternalVerify("proof_uploaded")));

test("overdue can be externally verified", () =>
  assert.ok(canExternalVerify("overdue")));

test("verified CANNOT be externally verified (already done)", () =>
  assert.ok(!canExternalVerify("verified")));

test("cancelled CANNOT be externally verified", () =>
  assert.ok(!canExternalVerify("cancelled")));

// ─── isKnownStatus ───────────────────────────────────────────────

console.log("\n[isKnownStatus]");

const knownStatuses: ObligationStatus[] = [
  "upcoming", "pending", "reminded", "proof_uploaded",
  "overdue", "verified", "cancelled",
];

for (const s of knownStatuses) {
  test(`"${s}" is a known status`, () => assert.ok(isKnownStatus(s)));
}

test('"paid" is NOT a known status', () => assert.ok(!isKnownStatus("paid")));
test('"active" is NOT a known status', () => assert.ok(!isKnownStatus("active")));
test('"" is NOT a known status', () => assert.ok(!isKnownStatus("")));

// ─── Completeness check ──────────────────────────────────────────

console.log("\n[Completeness]");

test("all states appear as keys in OWNER_TRANSITIONS", () => {
  for (const s of knownStatuses) {
    assert.ok(s in OWNER_TRANSITIONS, `"${s}" missing from OWNER_TRANSITIONS`);
  }
});

test("all transition targets are known states", () => {
  for (const [from, targets] of Object.entries(OWNER_TRANSITIONS)) {
    for (const to of targets) {
      assert.ok(
        isKnownStatus(to),
        `Unknown target "${to}" in transitions from "${from}"`
      );
    }
  }
});

// ─── Summary ─────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
