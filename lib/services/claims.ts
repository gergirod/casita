import { prisma } from "@/lib/prisma";
import { logActivity, ActivityChannel, ActivityActorType } from "@/lib/services/activity-log";
import { ServiceResult } from "@/lib/services/obligations";

// ─── Valid state transitions ─────────────────────────────────────
//
// Explicit transition table. Any transition not listed here is rejected.
// "resolved" is a terminal state — no transitions out.

const VALID_CLAIM_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: [],
};

/**
 * Pure predicate — no DB, no side effects.
 * Returns true if the transition from → to is permitted by the claim state machine.
 * Exported so it can be unit-tested independently of the DB-dependent updateClaimStatus.
 */
export function isValidClaimTransition(from: string, to: string): boolean {
  return (VALID_CLAIM_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Returns the list of allowed next statuses from a given claim status.
 * Returns [] for terminal states or unknown statuses.
 */
export function getAllowedClaimTransitions(from: string): string[] {
  return VALID_CLAIM_TRANSITIONS[from] ?? [];
}

// ─── createClaim ─────────────────────────────────────────────────
//
// Creates a new claim for a unit.
// No ownership check needed here — the caller is the tenant who owns
// the context (unitId comes from their authenticated session/token).

export interface CreateClaimInput {
  unitId: string;
  workspaceId: string;
  description: string;
  source: string;
  actorType: ActivityActorType;
  actorId: string;
  channel: ActivityChannel;
}

export async function createClaim(
  input: CreateClaimInput
): Promise<ServiceResult<{ claimId: string }>> {
  const claim = await prisma.claim.create({
    data: {
      unitId: input.unitId,
      description: input.description.trim(),
      source: input.source,
    },
  });

  void logActivity({
    workspaceId: input.workspaceId,
    unitId: input.unitId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: "claim.created",
    entityType: "claim",
    entityId: claim.id,
    metadata: { description: input.description.trim().slice(0, 200) },
    channel: input.channel,
  });

  return { ok: true, data: { claimId: claim.id } };
}

// ─── updateClaimStatus ───────────────────────────────────────────
//
// Updates the status of an existing claim.
// Validates:
//   1. Claim exists
//   2. Owner has permission (workspace ownership)
//   3. State transition is valid per VALID_CLAIM_TRANSITIONS

export interface UpdateClaimStatusInput {
  claimId: string;
  newStatus: string;
  ownerId: string;
  channel: ActivityChannel;
}

export async function updateClaimStatus(
  input: UpdateClaimStatusInput
): Promise<ServiceResult<{ claimId: string; status: string }>> {
  const claim = await prisma.claim.findUnique({
    where: { id: input.claimId },
    include: {
      unit: {
        select: {
          id: true,
          property: {
            select: { workspaceId: true, workspace: { select: { ownerId: true } } },
          },
        },
      },
    },
  });

  if (!claim) return { ok: false, error: "Reclamo no encontrado.", code: "not_found" };

  if (claim.unit.property.workspace.ownerId !== input.ownerId) {
    return { ok: false, error: "No tenés permiso para modificar este reclamo.", code: "forbidden" };
  }

  const allowed = VALID_CLAIM_TRANSITIONS[claim.status] ?? [];
  if (!allowed.includes(input.newStatus)) {
    const allowedLabel = allowed.length > 0 ? allowed.join(", ") : "ninguna";
    return {
      ok: false,
      error: `Transición inválida: '${claim.status}' → '${input.newStatus}'. Permitidas: ${allowedLabel}.`,
      code: "invalid_input",
    };
  }

  const updated = await prisma.claim.update({
    where: { id: input.claimId },
    data: {
      status: input.newStatus as "in_progress" | "resolved",
      resolvedAt: input.newStatus === "resolved" ? new Date() : null,
    },
  });

  void logActivity({
    workspaceId: claim.unit.property.workspaceId,
    unitId: claim.unit.id,
    actorType: "owner",
    actorId: input.ownerId,
    action: "claim.updated",
    entityType: "claim",
    entityId: input.claimId,
    metadata: { previousStatus: claim.status, newStatus: input.newStatus },
    channel: input.channel,
  });

  return { ok: true, data: { claimId: updated.id, status: updated.status } };
}
