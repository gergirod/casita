/**
 * Reminders service — pure helper unit tests.
 *
 * Run with:
 *   npx tsx lib/services/__tests__/reminders.test.ts
 *
 * No test framework needed — uses Node.js built-in assert.
 * Only selectReminderEmailType is tested here because sendReminderToTenant,
 * scheduleReminder, and cancelReminder all require Prisma + email + WhatsApp
 * (integration territory).
 */

import assert from "node:assert/strict";
import { selectReminderEmailType } from "../reminders.js";

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

// ─── selectReminderEmailType ──────────────────────────────────────
//
// Boundary table:
//   daysUntilDue ≤ 0  → "overdue"
//   daysUntilDue = 1  → "today"
//   daysUntilDue ≥ 2  → "soon"

console.log("\n[selectReminderEmailType — overdue boundary]");

test("daysUntilDue = -30 → overdue", () =>
  assert.equal(selectReminderEmailType(-30), "overdue"));

test("daysUntilDue = -1 → overdue", () =>
  assert.equal(selectReminderEmailType(-1), "overdue"));

test("daysUntilDue = 0 (exact due date) → overdue", () =>
  assert.equal(selectReminderEmailType(0), "overdue"));

console.log("\n[selectReminderEmailType — today boundary]");

test("daysUntilDue = 1 (due within 24h) → today", () =>
  assert.equal(selectReminderEmailType(1), "today"));

console.log("\n[selectReminderEmailType — soon boundary]");

test("daysUntilDue = 2 → soon", () =>
  assert.equal(selectReminderEmailType(2), "soon"));

test("daysUntilDue = 7 → soon", () =>
  assert.equal(selectReminderEmailType(7), "soon"));

test("daysUntilDue = 30 → soon", () =>
  assert.equal(selectReminderEmailType(30), "soon"));

// ─── Return type exhaustiveness ───────────────────────────────────

console.log("\n[selectReminderEmailType — return type completeness]");

test("return values are always one of the three expected strings", () => {
  const valid = new Set(["overdue", "today", "soon"]);
  const inputs = [-10, -1, 0, 1, 2, 5, 14, 30, 90];
  for (const d of inputs) {
    const result = selectReminderEmailType(d);
    assert.ok(valid.has(result), `Unexpected return "${result}" for daysUntilDue=${d}`);
  }
});

// ─── Summary ─────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
