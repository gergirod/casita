import { prisma } from "@/lib/prisma";
import type { ObligationStatus, ClaimStatus } from "@prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Return types ────────────────────────────────────────────────
//
// All query functions return typed plain objects (not ServiceResult<T>).
// Empty arrays mean "nothing found" — the agent wrapper decides the message.

export interface WorkspaceOverview {
  id: string;
  nombre: string;
  inquilino: string | null;
  pendientes: number;
  vencidas: number;
  porVerificar: number;
  obligaciones: Array<{
    titulo: string;
    estado: string;
    monto: string;
    vencimiento: string;
  }>;
}

export interface ObligationSummary {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  monto: string;
  vencimiento: string;
  tieneComprobante: boolean;
  tieneFactura: boolean;
  linkPago: string | null;
}

export interface TenantInfo {
  nombre: string;
  email: string | null;
  whatsapp: string | null;
  portal: string;
  bienvenidaEnviada: boolean;
}

export interface ProofItem {
  id: string;
  titulo: string;
  monto: string;
  inquilino: string | undefined;
  casita: string;
  proofUrl: string | null;
  subidoEl: string | undefined;
}

export interface ClaimSummary {
  id: string;
  casita: string;
  unidad: string;
  inquilino: string;
  descripcion: string;
  estado: string;
  fecha: string;
}

export interface ReminderItem {
  id: string;
  envio: string;
  canal: string;
  obligacion: string;
  mensaje: string;
}

// ─── getOwnerOverview ────────────────────────────────────────────
//
// Full status summary across all workspaces owned by ownerId.
// Ownership is implicit — ownerId is the filter.

export async function getOwnerOverview(ownerId: string): Promise<WorkspaceOverview[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId },
    include: {
      properties: {
        include: {
          units: {
            where: { isActive: true },
            include: {
              tenantContact: { select: { fullName: true } },
              obligations: {
                where: {
                  status: { in: ["pending", "overdue", "upcoming", "reminded", "proof_uploaded"] },
                },
                select: { status: true, amount: true, currency: true, title: true, dueDate: true },
              },
            },
          },
        },
      },
    },
  });

  return workspaces.map((ws) => {
    const unit = ws.properties[0]?.units[0];
    const obs = unit?.obligations ?? [];
    return {
      id: ws.id,
      nombre: ws.name,
      inquilino: unit?.tenantContact?.fullName ?? null,
      pendientes: obs.filter((o) => ["pending", "upcoming", "reminded"].includes(o.status)).length,
      vencidas: obs.filter((o) => o.status === "overdue").length,
      porVerificar: obs.filter((o) => o.status === "proof_uploaded").length,
      obligaciones: obs.map((o) => ({
        titulo: o.title,
        estado: o.status,
        monto: `${o.currency} ${o.amount}`,
        vencimiento: o.dueDate.toISOString().slice(0, 10),
      })),
    };
  });
}

// ─── getOwnerObligations ─────────────────────────────────────────
//
// Obligations for a specific workspace, with optional status filter.
// Ownership is validated via workspace → ownerId in the Prisma where clause.

const STATUS_FILTER_MAP: Record<string, ObligationStatus[]> = {
  pending: ["pending", "upcoming", "reminded"],
  overdue: ["overdue"],
  proof_uploaded: ["proof_uploaded"],
};

const ALL_OBLIGATION_STATUSES: ObligationStatus[] = [
  "pending", "overdue", "upcoming", "reminded", "proof_uploaded", "verified",
];

export async function getOwnerObligations(
  ownerId: string,
  workspaceId: string,
  filter?: string
): Promise<ObligationSummary[]> {
  const statuses = (filter && STATUS_FILTER_MAP[filter]) ? STATUS_FILTER_MAP[filter] : ALL_OBLIGATION_STATUSES;

  const obligations = await prisma.obligation.findMany({
    where: {
      unit: { property: { workspaceId, workspace: { ownerId } } },
      status: { in: statuses },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true, title: true, type: true, status: true,
      amount: true, currency: true, dueDate: true,
      proofUrl: true, originalBillUrl: true, paymentLinkUrl: true,
    },
  });

  return obligations.map((o) => ({
    id: o.id,
    titulo: o.title,
    tipo: o.type,
    estado: o.status,
    monto: `${o.currency} ${o.amount}`,
    vencimiento: o.dueDate.toISOString().slice(0, 10),
    tieneComprobante: !!o.proofUrl,
    tieneFactura: !!o.originalBillUrl,
    linkPago: o.paymentLinkUrl,
  }));
}

// ─── getTenantInfo ───────────────────────────────────────────────
//
// Returns contact info for the active tenant in a workspace.
// Returns null if no active unit or no registered tenant contact.
// Ownership validated via workspace → ownerId in the Prisma where clause.

export async function getTenantInfo(
  ownerId: string,
  workspaceId: string
): Promise<TenantInfo | null> {
  const unit = await prisma.unit.findFirst({
    where: {
      property: { workspaceId, workspace: { ownerId } },
      isActive: true,
    },
    include: { tenantContact: true },
  });

  if (!unit?.tenantContact) return null;

  const contact = unit.tenantContact;
  return {
    nombre: contact.fullName,
    email: contact.email,
    whatsapp: contact.whatsapp,
    portal: `${APP_URL}/t/${unit.tenantToken}`,
    bienvenidaEnviada: !!contact.welcomeSentAt,
  };
}

// ─── getPendingProofs ────────────────────────────────────────────
//
// Returns obligations in proof_uploaded state awaiting owner review.
// Optional workspaceId narrows to a single workspace; omitting it
// returns pending proofs across all workspaces owned by ownerId.

export async function getPendingProofs(
  ownerId: string,
  workspaceId?: string
): Promise<ProofItem[]> {
  const where = workspaceId
    ? { unit: { property: { workspace: { id: workspaceId, ownerId } } }, status: "proof_uploaded" as const }
    : { unit: { property: { workspace: { ownerId } } }, status: "proof_uploaded" as const };

  const proofs = await prisma.obligation.findMany({
    where,
    include: {
      unit: {
        include: {
          tenantContact: { select: { fullName: true } },
          property: { select: { workspace: { select: { name: true } } } },
        },
      },
    },
    orderBy: { proofUploadedAt: "desc" },
  });

  return proofs.map((p) => ({
    id: p.id,
    titulo: p.title,
    monto: `${p.currency} ${p.amount}`,
    inquilino: p.unit.tenantContact?.fullName,
    casita: p.unit.property.workspace.name,
    proofUrl: p.proofUrl,
    subidoEl: p.proofUploadedAt?.toISOString().slice(0, 10),
  }));
}

// ─── getOpenClaims ───────────────────────────────────────────────
//
// Returns open/in_progress claims for a workspace, newest first.
// Optional unitId narrows to a specific unit.
// Optional statusFilter overrides the default open/in_progress filter.
// Ownership validated via workspace → ownerId in the Prisma where clause.

const VALID_CLAIM_STATUSES: ClaimStatus[] = ["open", "in_progress", "resolved"];

export async function getOpenClaims(
  ownerId: string,
  workspaceId: string,
  unitId?: string,
  statusFilter?: string
): Promise<ClaimSummary[]> {
  const statuses: ClaimStatus[] =
    statusFilter && (VALID_CLAIM_STATUSES as string[]).includes(statusFilter)
      ? [statusFilter as ClaimStatus]
      : ["open", "in_progress"];

  // Build the unit filter explicitly to preserve Prisma's include type inference
  const unitWhere = unitId
    ? { id: unitId, property: { workspaceId, workspace: { ownerId } } }
    : { property: { workspaceId, workspace: { ownerId } } };

  const claims = await prisma.claim.findMany({
    where: { unit: unitWhere, status: { in: statuses } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      unit: {
        select: {
          identifier: true,
          property: { select: { name: true } },
          tenantContact: { select: { fullName: true } },
        },
      },
    },
  });

  return claims.map((c) => ({
    id: c.id,
    casita: c.unit.property.name,
    unidad: c.unit.identifier,
    inquilino: c.unit.tenantContact?.fullName ?? "Sin inquilino",
    descripcion: c.description,
    estado: c.status,
    fecha: c.createdAt.toISOString().slice(0, 10),
  }));
}

// ─── listPendingReminders ────────────────────────────────────────
//
// Returns pending scheduled reminders for a workspace, sorted by sendAt.
// Ownership validated via workspace → ownerId in the Prisma where clause.

export async function listPendingReminders(
  ownerId: string,
  workspaceId: string
): Promise<ReminderItem[]> {
  const reminders = await prisma.scheduledReminder.findMany({
    where: {
      workspaceId,
      workspace: { ownerId },
      status: "pending",
    },
    orderBy: { sendAt: "asc" },
  });

  return reminders.map((r) => ({
    id: r.id,
    envio: r.sendAt.toLocaleDateString("es-AR", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }),
    canal: r.channel,
    obligacion: r.obligationId ?? "general",
    mensaje: r.message ?? "(default)",
  }));
}
