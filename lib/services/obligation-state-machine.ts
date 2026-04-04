/**
 * Obligation State Machine — pure module, zero external dependencies.
 *
 * Only this file knows the allowed transitions. All service functions
 * that change obligation status must go through `isValidOwnerTransition`
 * or the explicit system helpers.
 *
 * State overview:
 *
 *   upcoming       — created with a future due date
 *   pending        — due date arrived, not yet reminded
 *   reminded       — reminder sent to tenant
 *   proof_uploaded — tenant submitted a payment proof
 *   overdue        — past due date, no proof received
 *   verified       — owner confirmed payment (TERMINAL)
 *   cancelled      — obligation voided (TERMINAL for owner; reopenable to pending)
 *
 * Terminal states:
 *   verified  — no outgoing owner transitions
 *   cancelled — only one outgoing owner transition: "reopen manual" → pending
 */

export type ObligationStatus =
  | "upcoming"
  | "pending"
  | "reminded"
  | "proof_uploaded"
  | "overdue"
  | "verified"
  | "cancelled";

// ─── Owner transition table ──────────────────────────────────────
//
// Defines what an owner (human actor) is allowed to set on a given
// obligation. System/cron transitions are NOT in this table — they
// have their own stricter rules.

export const OWNER_TRANSITIONS: Record<ObligationStatus, ObligationStatus[]> = {
  upcoming:       ["pending", "reminded", "overdue", "cancelled", "verified"],
  pending:        ["upcoming", "reminded", "overdue", "cancelled", "verified"],
  reminded:       ["pending", "upcoming", "overdue", "cancelled", "verified"],
  proof_uploaded: ["verified", "cancelled", "pending"],  // pending = owner rejected proof
  overdue:        ["pending", "cancelled", "verified"],
  verified:       [],       // TERMINAL — no outgoing owner transitions
  cancelled:      ["pending"], // reopen manual — only valid exit from cancelled
};

// ─── System transition rules ─────────────────────────────────────
//
// Cron/system actors operate on a subset of active states only.
// They never touch terminal states or proof_uploaded.

/** States that the cron is allowed to mark as "reminded" */
export const CRON_REMIND_FROM: ObligationStatus[] = ["upcoming", "pending", "reminded"];

/** States that the cron is allowed to mark as "overdue" */
export const CRON_OVERDUE_FROM: ObligationStatus[] = ["upcoming", "pending", "reminded"];

/** States that an external payment system (MP webhook) can verify */
export const EXTERNAL_VERIFY_FROM: ObligationStatus[] = [
  "upcoming", "pending", "reminded", "proof_uploaded", "overdue",
];

// ─── Pure helpers ────────────────────────────────────────────────

/**
 * Returns true if an owner is allowed to move `from` → `to`.
 */
export function isValidOwnerTransition(
  from: ObligationStatus,
  to: ObligationStatus
): boolean {
  return OWNER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns the list of states an owner can transition to from `from`.
 */
export function getAllowedOwnerTransitions(from: ObligationStatus): ObligationStatus[] {
  return OWNER_TRANSITIONS[from] ?? [];
}

/**
 * Returns true if the cron is allowed to mark this obligation as reminded.
 */
export function canMarkReminded(currentStatus: ObligationStatus): boolean {
  return CRON_REMIND_FROM.includes(currentStatus);
}

/**
 * Returns true if the cron is allowed to mark this obligation as overdue.
 * proof_uploaded, verified, cancelled are protected.
 */
export function canMarkOverdue(currentStatus: ObligationStatus): boolean {
  return CRON_OVERDUE_FROM.includes(currentStatus);
}

/**
 * Returns true if an external payment system can mark this obligation as verified.
 */
export function canExternalVerify(currentStatus: ObligationStatus): boolean {
  return EXTERNAL_VERIFY_FROM.includes(currentStatus);
}

/**
 * Returns true if the given string is a known ObligationStatus value.
 */
export function isKnownStatus(value: string): value is ObligationStatus {
  return [
    "upcoming", "pending", "reminded",
    "proof_uploaded", "overdue", "verified", "cancelled",
  ].includes(value);
}
