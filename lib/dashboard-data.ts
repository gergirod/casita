import { prisma } from "@/lib/prisma";

function serializeWorkspace(workspace: {
  id: string;
  ownerId: string;
  name: string;
  locale: string;
  currency: string;
  timezone: string;
  n8nWebhookUrl: string | null;
  n8nSecret:     string | null;
  mpEnabled:              boolean;
  mpPublicKey:            string | null;
  mpUserId:               string | null;
  mpAccessTokenEncrypted: string | null;
  mpPaymentLink:          string | null;
  createdAt: Date;
  updatedAt: Date;
  properties: Array<{
    id: string;
    workspaceId: string;
    name: string;
    address: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    units: Array<{
      id: string;
      propertyId: string;
      identifier: string;
      isActive: boolean;
      tenantToken: string;
      contractUrl: string | null;
      leaseEndDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
      tenantContact: {
        id: string;
        unitId: string;
        fullName: string;
        email: string | null;
        whatsapp: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      contractHistory: Array<{
        id: string;
        url: string;
        uploadedAt: Date;
      }>;
      obligationTemplates: Array<{
        id: string;
        type: string;
        title: string;
        dueDay: number;
        currency: string;
        amount: { toString(): string };
        providerSlug:    string | null;
        ingestionMode:   string;
        billingPeriod:   string;
        reminderDays:    number;
        reminderChannel: string;
        remindBefore:    boolean;
        remindOnDue:     boolean;
        remindOverdue:   boolean;
        paymentMethod:   string | null;
        paymentCbu:      string | null;
        paymentName:     string | null;
        paymentMpLink:   string | null;
      }>;
      obligations: Array<{
        id: string;
        templateId: string | null;
        title: string;
        type: string;
        sourceType: string;
        status: string;
        dueDate: Date;
        dueMonth: Date | null;
        amount: { toString(): string };
        originalBillUrl: string | null;
        proofUrl: string | null;
        proofUploadedAt: Date | null;
        paymentLinkUrl: string | null;
      }>;
    }>;
  }>;
},
// ownerPhone, whatsappEnabled, and email config are account-level (OwnerProfile), passed separately.
ownerProfile?: { phone: string | null; whatsappEnabled: boolean } | null,
) {
  return {
    id: workspace.id,
    ownerId: workspace.ownerId,
    name: workspace.name,
    locale: workspace.locale,
    currency: workspace.currency,
    timezone: workspace.timezone,
    mpEnabled: workspace.mpEnabled,
    mpPublicKey: workspace.mpPublicKey,
    mpUserId: workspace.mpUserId,
    mpPaymentLink: workspace.mpPaymentLink,
    whatsappEnabled: ownerProfile?.whatsappEnabled ?? false,
    ownerPhone: ownerProfile?.phone ?? null,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    properties: workspace.properties.map((property) => ({
      ...property,
      units: property.units.map((unit) => ({
        ...unit,
        obligationTemplates: unit.obligationTemplates.map((template) => ({
          id: template.id,
          type: template.type,
          title: template.title,
          dueDay: template.dueDay,
          currency: template.currency,
          amount: template.amount.toString(),
          providerSlug:    template.providerSlug,
          ingestionMode:   template.ingestionMode,
          billingPeriod:   template.billingPeriod,
          reminderDays:    template.reminderDays,
          reminderChannel: template.reminderChannel,
          remindBefore:    template.remindBefore,
          remindOnDue:     template.remindOnDue,
          remindOverdue:   template.remindOverdue,
          paymentMethod:   template.paymentMethod ?? null,
          paymentCbu:      template.paymentCbu ?? null,
          paymentName:     template.paymentName ?? null,
          paymentMpLink:   template.paymentMpLink ?? null,
        })),
        contractHistory: unit.contractHistory.map((c) => ({
          id: c.id,
          url: c.url,
          uploadedAt: c.uploadedAt.toISOString(),
        })),
        leaseEndDate: unit.leaseEndDate?.toISOString() ?? null,
        createdAt: unit.createdAt.toISOString(),
        obligations: unit.obligations.map((obligation) => ({
          id: obligation.id,
          templateId: obligation.templateId ?? null,
          title: obligation.title,
          type: obligation.type,
          sourceType: obligation.sourceType,
          status: obligation.status,
          dueDate: obligation.dueDate.toISOString(),
          dueMonth: obligation.dueMonth?.toISOString() ?? null,
          amount: obligation.amount.toString(),
          originalBillUrl: obligation.originalBillUrl ?? null,
          proofUrl: obligation.proofUrl ?? null,
          proofUploadedAt: obligation.proofUploadedAt?.toISOString() ?? null,
          paymentLinkUrl: obligation.paymentLinkUrl ?? null,
        }))
      }))
    }))
  };
}

function buildCounters(obligations: Array<{ status: string }>) {
  return {
    total: obligations.length,
    upcoming: obligations.filter((item) => item.status === "upcoming").length,
    pending: obligations.filter((item) => item.status === "pending").length,
    overdue: obligations.filter((item) => item.status === "overdue").length,
    proofUploaded: obligations.filter((item) => item.status === "proof_uploaded").length,
    verified: obligations.filter((item) => item.status === "verified").length,
  };
}

export async function getOwnerDashboardOverview(ownerId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId },
    include: {
      properties: {
        include: {
          units: {
            include: {
              obligations: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return workspaces.map((workspace) => {
    const units = workspace.properties.flatMap((property) => property.units);
    const obligations = units.flatMap((unit) => unit.obligations);
    const counters = buildCounters(obligations);

    return {
      id: workspace.id,
      name: workspace.name,
      currency: workspace.currency,
      propertiesCount: workspace.properties.length,
      unitsCount: units.length,
      counters
    };
  });
}

export async function getWorkspaceDetail(ownerId: string, workspaceId: string) {
  const workspaceFull = await prisma.workspace.findFirst({
    where: { ownerId, id: workspaceId },
    include: {
      properties: {
        include: {
          units: {
            include: {
              tenantContact: true,
              contractHistory: {
                orderBy: { uploadedAt: "desc" },
              },
              obligationTemplates: {
                where: { isActive: true },
                orderBy: { createdAt: "desc" },
              },
              obligations: {
                orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
              }
            },
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!workspaceFull) {
    return { workspace: null, counters: null, pastRentals: [], claims: [] };
  }

  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { ownerId },
    select: { phone: true, whatsappEnabled: true },
  });

  const obligations = workspaceFull.properties.flatMap((property) =>
    property.units.flatMap((unit) => unit.obligations)
  );

  const counters = buildCounters(obligations);
  const safeWorkspace = serializeWorkspace(workspaceFull, ownerProfile);

  /* Past rentals — inactive units, lightweight */
  const property = workspaceFull.properties[0];
  const pastRentals = property
    ? property.units
        .filter((u) => !u.isActive)
        .map((u) => ({
          id: u.id,
          tenantName: u.tenantContact?.fullName ?? "Sin nombre",
          leaseEndDate: u.leaseEndDate?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
          obligationsCount: u.obligations.length,
        }))
    : [];

  /* Claims for all units in this workspace */
  const unitIds = workspaceFull.properties.flatMap((p) => p.units.map((u) => u.id));
  const claimsRaw = unitIds.length > 0
    ? await prisma.claim.findMany({
        where: { unitId: { in: unitIds } },
        orderBy: { createdAt: "desc" },
        include: {
          unit: {
            select: {
              identifier: true,
              property: { select: { name: true } },
              tenantContact: { select: { fullName: true } },
            },
          },
        },
      })
    : [];

  const claims = claimsRaw.map((c) => ({
    id: c.id,
    description: c.description,
    status: c.status,
    source: c.source,
    createdAt: c.createdAt.toISOString(),
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    casita: c.unit.property.name,
    unit: c.unit.identifier,
    tenant: c.unit.tenantContact?.fullName ?? null,
  }));

  return { workspace: safeWorkspace, counters, pastRentals, claims };
}

// ─── Activity feed ───────────────────────────────────────────────

/**
 * Shape returned to the ActivityFeed component.
 * actorId is intentionally excluded — it may contain phone numbers or owner IDs.
 */
export interface ActivityItem {
  id:         string;
  action:     string;
  actorType:  string;
  entityType: string | null;
  entityId:   string | null;
  channel:    string | null;
  metadata:   Record<string, unknown>;
  createdAt:  string; // ISO string — formatting is done in the component
}

/**
 * Returns the most recent ActivityLog entries for a workspace.
 *
 * Ownership is validated before reading logs. If the workspace does not belong
 * to ownerId, an empty array is returned silently. This is a deliberate choice
 * for the dashboard read layer: we never leak activity across owners, and we
 * avoid throwing so the page still renders without the feed.
 */
export async function getRecentActivity(
  ownerId:     string,
  workspaceId: string,
  limit:       number = 20,
): Promise<ActivityItem[]> {
  // Ownership check — intentional silent empty on mismatch (see JSDoc above)
  const owned = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId },
    select: { id: true },
  });
  if (!owned) return [];

  const rows = await prisma.activityLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id:         true,
      action:     true,
      actorType:  true,
      entityType: true,
      entityId:   true,
      channel:    true,
      metadata:   true,
      createdAt:  true,
    },
  });

  return rows.map((r) => ({
    id:         r.id,
    action:     r.action,
    actorType:  r.actorType,
    entityType: r.entityType,
    entityId:   r.entityId,
    channel:    r.channel,
    metadata:   (r.metadata as Record<string, unknown>) ?? {},
    createdAt:  r.createdAt.toISOString(),
  }));
}
