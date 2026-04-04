/**
 * Bills service — pure helper unit tests.
 *
 * Run with:
 *   npx tsx lib/services/__tests__/bills.test.ts
 *
 * No test framework needed — uses Node.js built-in assert.
 * Only mimeToExt and nextMonthLastDay are tested here because
 * ingestBill requires Supabase + OpenAI + Prisma (integration territory).
 */

import assert from "node:assert/strict";
import { mimeToExt, nextMonthLastDay } from "../bills.js";

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

// ─── mimeToExt ───────────────────────────────────────────────────

console.log("\n[mimeToExt]");

test('"application/pdf" → "pdf"', () =>
  assert.equal(mimeToExt("application/pdf"), "pdf"));

test('"image/png" → "png"', () =>
  assert.equal(mimeToExt("image/png"), "png"));

test('"image/jpeg" → "jpg"', () =>
  assert.equal(mimeToExt("image/jpeg"), "jpg"));

test('"image/jpg" → "jpg"', () =>
  assert.equal(mimeToExt("image/jpg"), "jpg"));

test('"text/plain" → "jpg" (fallback)', () =>
  assert.equal(mimeToExt("text/plain"), "jpg"));

test('"" → "jpg" (empty string fallback)', () =>
  assert.equal(mimeToExt(""), "jpg"));

test('"application/octet-stream" → "jpg" (unknown fallback)', () =>
  assert.equal(mimeToExt("application/octet-stream"), "jpg"));

test('"image/webp" → "jpg" (unsupported image fallback)', () =>
  assert.equal(mimeToExt("image/webp"), "jpg"));

// ─── nextMonthLastDay ─────────────────────────────────────────────

console.log("\n[nextMonthLastDay]");

test("returns a Date instance", () =>
  assert.ok(nextMonthLastDay() instanceof Date));

test("day is a valid end-of-month day (28, 29, 30, or 31)", () => {
  const d = nextMonthLastDay();
  const day = d.getDate();
  assert.ok([28, 29, 30, 31].includes(day), `Unexpected day: ${day}`);
});

test("result is always after today", () => {
  const d = nextMonthLastDay();
  assert.ok(d.getTime() > Date.now(), `Expected future date, got ${d.toISOString()}`);
});

test("month of result is exactly next calendar month", () => {
  const now = new Date();
  const d = nextMonthLastDay();
  // next month index: wraps from 11 (Dec) to 0 (Jan) of next year
  const expectedMonth = (now.getMonth() + 1) % 12;
  assert.equal(
    d.getMonth(),
    expectedMonth,
    `Expected month ${expectedMonth} (next month), got ${d.getMonth()}. ` +
    `Date: ${d.toISOString()}`
  );
});

test("year rolls over correctly when called in December", () => {
  // Simulate December by checking the year relationship
  const now = new Date();
  const d = nextMonthLastDay();
  if (now.getMonth() === 11) {
    // December → January of next year
    assert.equal(d.getFullYear(), now.getFullYear() + 1);
  } else {
    assert.equal(d.getFullYear(), now.getFullYear());
  }
});

test("result is the actual last day of next month (next day rolls to month+2)", () => {
  const d = nextMonthLastDay();
  const nextDay = new Date(d);
  nextDay.setDate(d.getDate() + 1);
  // Adding one day should move to the first of the following month
  assert.equal(nextDay.getDate(), 1, `Day after last-of-month should be 1, got ${nextDay.getDate()}`);
});

test("calling twice returns equivalent dates (deterministic within same day)", () => {
  const d1 = nextMonthLastDay();
  const d2 = nextMonthLastDay();
  assert.equal(d1.getMonth(), d2.getMonth());
  assert.equal(d1.getDate(), d2.getDate());
  assert.equal(d1.getFullYear(), d2.getFullYear());
});

// ─── Summary ─────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
