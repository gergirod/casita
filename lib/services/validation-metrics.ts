/**
 * Validation metrics for Casita closed beta.
 *
 * All functions are pure queries — no writes, no side effects.
 * Data sources: ActivityLog, Obligation, Unit, TenantContact, ObligationTemplate.
 * No new schema required.
 */

import { prisma } from "@/lib/prisma";

// ─── Return types ────────────────────────────────────────────────────────────

export interface OnboardingRate {
  /** Total active units owned by this owner (cross-workspace) */
  total: number;
  /** Units with tenant registered + at least 1 active template + at least 1 obligation */
  complete: number;
  /** complete / total × 100 (0 if total = 0) */
  rate: number;
}

export interface WhatsAppActivity {
  /** How many of the last 4 ISO weeks had at least 1 owner action via WhatsApp */
  activeWeeks: number;
  /** ISO date string of the most recent owner WhatsApp action, or null */
  lastActivityAt: string | null;
}

export interface CompleteCycles {
  /** Total verified obligations in the workspace */
  verifiedTotal: number;
  /**
   * Obligations with status=verified that also have both a reminder.sent
   * and a proof.uploaded event in ActivityLog — full traceable cycle.
   */
  completeCycles: number;
  /** completeCycles / verifiedTotal × 100 (0 if verifiedTotal = 0) */
  rate: number;
}

export interface TenantSelfService {
  /** Total proof.uploaded events in the workspace */
  totalProofs: number;
  /** proof.uploaded events where actorType = "tenant" */
  tenantProofs: number;
  /** tenantProofs / totalProofs × 100 (0 if totalProofs = 0) */
  rate: number;
}

export interface CycleTime {
  /** Average days from obligation.createdAt to paidAt, over last 90 days. null if no sample. */
  avgDays: number | null;
  /** How many obligations were used to compute avgDays */
  sampleSize: number;
  /** Obligations currently in proof_uploaded (comprobante subido, not yet verified by owner) */
  pendingVerification: number;
}

// ─── M1 — Onboarding completion rate ────────────────────────────────────────

/**
 * Scope: cross-workspace, per owner.
 * A unit is "complete" if it has a tenant contact, at least 1 active template,
 * and at least 1 obligation created.
 */
export async function getOnboardingRate(ownerId: string): Promise<OnboardingRate> {
  const units = await prisma.unit.findMany({
    where: {
      isActive: true,
      property: { workspace: { ownerId } },
    },
    select: {
      id: true,
      tenantContact: { select: { id: true } },
      obligationTemplates: {
        where: { isActive: true },
        select: { id: true },
        take: 1,
      },
      obligations: {
        select: { id: true },
        take: 1,
      },
    },
  });

  const total = units.length;
  const complete = units.filter(
    (u) =>
      u.tenantContact !== null &&
      u.obligationTemplates.length > 0 &&
      u.obligations.length > 0
  ).length;

  return {
    total,
    complete,
    rate: total === 0 ? 0 : Math.round((complete / total) * 100),
  };
}

// ─── M2 — Owner active on WhatsApp ≥1x/week ──────────────────────────────────

/**
 * Scope: cross-workspace, per owner. Window: last 4 ISO weeks (28 days).
 * "Active" = at least 1 ActivityLog with actorType=owner AND channel=whatsapp.
 * actorId (phone) is used only for row matching — never returned.
 */
export async function getOwnerWhatsAppActivity(
  ownerId: string
): Promise<WhatsAppActivity> {
  const since = new Date();
  since.setDate(since.getDate() - 28);

  const rows = await prisma.activityLog.findMany({
    where: {
      actorType: "owner",
      channel:   "whatsapp",
      createdAt: { gte: since },
      workspace: { ownerId },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (rows.length === 0) {
    return { activeWeeks: 0, lastActivityAt: null };
  }

  // Group by ISO week number (year + week)
  const weekKeys = new Set(
    rows.map((r) => {
      const d = r.createdAt;
      // ISO week: Monday-based, using getDay trick
      const dayOfWeek = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      return `${monday.getUTCFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    })
  );

  return {
    activeWeeks:    Math.min(weekKeys.size, 4),
    lastActivityAt: rows[0].createdAt.toISOString(),
  };
}

// ─── M3 — Complete traceable cycles ──────────────────────────────────────────

/**
 * Scope: per workspace.
 * A complete cycle = obligation.status=verified that also has:
 *   - at least 1 ActivityLog(action=reminder.sent, entityId=obligationId)
 *   - at least 1 ActivityLog(action=proof.uploaded, entityId=obligationId)
 *
 * Limitation: cycles where the owner reminded via direct WhatsApp/call (outside
 * the system) won't appear in ActivityLog and won't be counted. This is intentional —
 * we want to measure system usage, not total human effort.
 */
export async function getCompleteCycles(
  ownerId:     string,
  workspaceId: string
): Promise<CompleteCycles> {
  // Ownership guard — silent empty if mismatch
  const owned = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId },
    select: { id: true },
  });
  if (!owned) return { verifiedTotal: 0, completeCycles: 0, rate: 0 };

  // All verified obligations in this workspace (last 6 months to keep query fast)
  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const verifiedIds = await prisma.obligation.findMany({
    where: {
      unitId: {
        in: await unitIdsForWorkspace(workspaceId),
      },
      status:    "verified",
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  const verifiedTotal = verifiedIds.length;
  if (verifiedTotal === 0) return { verifiedTotal: 0, completeCycles: 0, rate: 0 };

  const ids = verifiedIds.map((o) => o.id);

  // Find obligation IDs that have both events logged
  const [reminderRows, proofRows] = await Promise.all([
    prisma.activityLog.findMany({
      where: { action: "reminder.sent", entityId: { in: ids } },
      select: { entityId: true },
      distinct: ["entityId"],
    }),
    prisma.activityLog.findMany({
      where: { action: "proof.uploaded", entityId: { in: ids } },
      select: { entityId: true },
      distinct: ["entityId"],
    }),
  ]);

  const withReminder = new Set(reminderRows.map((r) => r.entityId));
  const withProof    = new Set(proofRows.map((r) => r.entityId));

  const completeCycles = ids.filter(
    (id) => withReminder.has(id) && withProof.has(id)
  ).length;

  return {
    verifiedTotal,
    completeCycles,
    rate: Math.round((completeCycles / verifiedTotal) * 100),
  };
}

// ─── M4 — Tenant self-service rate ───────────────────────────────────────────

/**
 * Scope: per workspace.
 * Of all proof.uploaded events, what % were initiated by the tenant.
 */
export async function getTenantSelfServiceRate(
  ownerId:     string,
  workspaceId: string
): Promise<TenantSelfService> {
  const owned = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId },
    select: { id: true },
  });
  if (!owned) return { totalProofs: 0, tenantProofs: 0, rate: 0 };

  const [totalProofs, tenantProofs] = await Promise.all([
    prisma.activityLog.count({
      where: { workspaceId, action: "proof.uploaded" },
    }),
    prisma.activityLog.count({
      where: { workspaceId, action: "proof.uploaded", actorType: "tenant" },
    }),
  ]);

  return {
    totalProofs,
    tenantProofs,
    rate: totalProofs === 0 ? 0 : Math.round((tenantProofs / totalProofs) * 100),
  };
}

// ─── M5 — Average cycle time ─────────────────────────────────────────────────

/**
 * Scope: per workspace. Window: last 90 days.
 * Avg days from obligation.createdAt to paidAt, for verified obligations with paidAt set.
 * Also returns pendingVerification: obligations currently awaiting owner verification.
 *
 * Limitation: obligations verified via external webhook (MercadoPago) may not have
 * paidAt populated depending on the flow. sampleSize makes this explicit in the UI.
 */
export async function getAverageCycleTime(
  ownerId:     string,
  workspaceId: string
): Promise<CycleTime> {
  const owned = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId },
    select: { id: true },
  });
  if (!owned) return { avgDays: null, sampleSize: 0, pendingVerification: 0 };

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const unitIds = await unitIdsForWorkspace(workspaceId);

  const [verified, pendingVerification] = await Promise.all([
    prisma.obligation.findMany({
      where: {
        unitId:    { in: unitIds },
        status:    "verified",
        paidAt:    { not: null },
        createdAt: { gte: since },
      },
      select: { createdAt: true, paidAt: true },
    }),
    prisma.obligation.count({
      where: { unitId: { in: unitIds }, status: "proof_uploaded" },
    }),
  ]);

  const sampleSize = verified.length;
  if (sampleSize === 0) {
    return { avgDays: null, sampleSize: 0, pendingVerification };
  }

  const totalMs = verified.reduce((sum, o) => {
    const ms = o.paidAt!.getTime() - o.createdAt.getTime();
    return sum + ms;
  }, 0);

  const avgDays = Math.round((totalMs / sampleSize / (1000 * 60 * 60 * 24)) * 10) / 10;

  return { avgDays, sampleSize, pendingVerification };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function unitIdsForWorkspace(workspaceId: string): Promise<string[]> {
  const properties = await prisma.property.findMany({
    where: { workspaceId },
    select: {
      units: { select: { id: true } },
    },
  });
  return properties.flatMap((p) => p.units.map((u) => u.id));
}
