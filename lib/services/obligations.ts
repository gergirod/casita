import { ObligationType } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { toPrismaDecimal } from "@/lib/obligations";
import { parseExternalReference } from "@/lib/mercado-pago";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { sendProofUploadedEmail } from "@/lib/email";
import { logActivity, ActivityChannel, ActivityActorType } from "@/lib/services/activity-log";
import {
  isValidOwnerTransition,
  getAllowedOwnerTransitions,
  canMarkReminded,
  canMarkOverdue,
  canExternalVerify,
  isKnownStatus,
  type ObligationStatus,
} from "@/lib/services/obligation-state-machine";

// ─── Shared result type ─────────────────────────────────────────
//
// All service functions return a discriminated union so callers have
// a typed, predictable contract and never need to inspect strings or
// catch exceptions for business-level failures.

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: "not_found" | "forbidden" | "invalid_input" | "conflict" | "missing_field" };

// ─── verifyPayment ──────────────────────────────────────────────
//
// Marks an obligation as verified (owner confirms payment).
// Validates that the obligation belongs to the requesting owner.

export interface VerifyPaymentInput {
  ownerId: string;
  obligationId: string;
  channel: ActivityChannel;
}

export async function verifyPayment(
  input: VerifyPaymentInput
): Promise<ServiceResult<{ obligationId: string; title: string }>> {
  const ob = await prisma.obligation.findFirst({
    where: { id: input.obligationId, unit: { property: { workspace: { ownerId: input.ownerId } } } },
    include: { unit: { select: { id: true, property: { select: { workspaceId: true } } } } },
  });

  if (!ob) return { ok: false, error: "Obligación no encontrada.", code: "not_found" };

  await prisma.obligation.update({
    where: { id: input.obligationId },
    data: { status: "verified" },
  });

  void logActivity({
    workspaceId: ob.unit.property.workspaceId,
    unitId: ob.unitId,
    actorType: "owner",
    actorId: input.ownerId,
    action: "payment.verified",
    entityType: "obligation",
    entityId: input.obligationId,
    metadata: { title: ob.title, amount: Number(ob.amount) },
    channel: input.channel,
  });

  return { ok: true, data: { obligationId: ob.id, title: ob.title } };
}

// ─── createManualObligation ─────────────────────────────────────
//
// Creates a one-off manual obligation.
// Validates that unitId belongs to the requesting owner (via workspace).

export interface CreateManualObligationInput {
  ownerId: string;
  unitId: string;
  type: ObligationType;
  title: string;
  amount: number;
  dueDate: Date;
  currency?: string;
  notes?: string;
  channel: ActivityChannel;
}

export async function createManualObligation(
  input: CreateManualObligationInput
): Promise<ServiceResult<{ obligationId: string; title: string; amount: number }>> {
  const unit = await prisma.unit.findFirst({
    where: { id: input.unitId, property: { workspace: { ownerId: input.ownerId } } },
    select: { id: true, property: { select: { workspaceId: true } } },
  });

  if (!unit) return { ok: false, error: "Unidad no encontrada o sin permisos.", code: "forbidden" };

  const ob = await prisma.obligation.create({
    data: {
      unitId: input.unitId,
      type: input.type,
      sourceType: "manual",
      title: input.title,
      amount: toPrismaDecimal(input.amount),
      dueDate: input.dueDate,
      currency: input.currency ?? "ARS",
      status: "pending",
      notes: input.notes,
    },
  });

  void logActivity({
    workspaceId: unit.property.workspaceId,
    unitId: input.unitId,
    actorType: "owner",
    actorId: input.ownerId,
    action: "obligation.created",
    entityType: "obligation",
    entityId: ob.id,
    metadata: { title: ob.title, amount: input.amount, type: input.type },
    channel: input.channel,
  });

  return { ok: true, data: { obligationId: ob.id, title: ob.title, amount: input.amount } };
}

// ─── markProofReceived ──────────────────────────────────────────
//
// Records a payment proof: uploads file to storage, updates obligation
// status to proof_uploaded, logs the event, and notifies the owner.
//
// The caller is responsible for providing the already-downloaded file
// buffer — channel-specific download logic (Twilio, FormData) stays
// outside this service.
//
// Validates that obligationId belongs to unitId.

export interface MarkProofReceivedInput {
  unitId: string;
  obligationId: string;
  fileBuffer: Buffer;
  mimeType: string;
  workspaceId: string;
  actorType: ActivityActorType;
  actorId: string;
  channel: ActivityChannel;
  ownerNotification: {
    ownerId: string;
    tenantName: string | null;
    propertyName: string;
    unitIdentifier: string;
  };
}

export async function markProofReceived(
  input: MarkProofReceivedInput
): Promise<ServiceResult<{ proofUrl: string; obligationTitle: string }>> {
  const obligation = await prisma.obligation.findFirst({
    where: { id: input.obligationId, unitId: input.unitId },
  });

  if (!obligation) {
    return { ok: false, error: "Obligación no encontrada para esta unidad.", code: "not_found" };
  }

  if (obligation.status === "proof_uploaded" || obligation.status === "verified") {
    return {
      ok: false,
      error: `Esta obligación (${obligation.title}) ya tiene comprobante cargado.`,
      code: "conflict",
    };
  }

  const ext = input.mimeType.includes("pdf")
    ? "pdf"
    : input.mimeType.includes("png")
    ? "png"
    : "jpg";
  const storagePath = `${input.unitId}/${input.obligationId}/${Date.now()}.${ext}`;

  await uploadFileToBucket({
    bucket: STORAGE_BUCKETS.proofs,
    path: storagePath,
    file: input.fileBuffer,
    contentType: input.mimeType,
  });

  const proofUrl = getPublicUrl(STORAGE_BUCKETS.proofs, storagePath);

  await prisma.obligation.update({
    where: { id: input.obligationId },
    data: { status: "proof_uploaded", proofUrl, proofUploadedAt: new Date() },
  });

  void logActivity({
    workspaceId: input.workspaceId,
    unitId: input.unitId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: "proof.uploaded",
    entityType: "obligation",
    entityId: input.obligationId,
    metadata: { title: obligation.title, proofUrl },
    channel: input.channel,
  });

  void _notifyOwnerOfProof({
    ownerId: input.ownerNotification.ownerId,
    workspaceId: input.workspaceId,
    tenantName: input.ownerNotification.tenantName,
    title: obligation.title,
    amount: obligation.amount.toString(),
    dueDate: obligation.dueDate.toISOString(),
    propertyName: input.ownerNotification.propertyName,
    unitIdentifier: input.ownerNotification.unitIdentifier,
  });

  return { ok: true, data: { proofUrl, obligationTitle: obligation.title } };
}

// ─── Private helpers ─────────────────────────────────────────────

async function _notifyOwnerOfProof(params: {
  ownerId: string;
  workspaceId: string;
  tenantName: string | null;
  title: string;
  amount: string;
  dueDate: string;
  propertyName: string;
  unitIdentifier: string;
}) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase.auth.admin.getUserById(params.ownerId);
    const ownerEmail = data.user?.email;
    if (!ownerEmail) return;

    await sendProofUploadedEmail({ ownerEmail, ...params });
  } catch {
    // non-blocking
  }
}

// ─── transitionObligationStatus ──────────────────────────────────
//
// Owner-initiated status change. Enforces:
//   1. Ownership: obligation must belong to the requesting owner.
//   2. Valid transition: per OWNER_TRANSITIONS in obligation-state-machine.
//   3. Persists the new status.
//   4. Writes ActivityLog (fire-and-forget, never blocks).

export interface TransitionObligationStatusInput {
  ownerId: string;
  obligationId: string;
  newStatus: string;
  channel: ActivityChannel;
}

export async function transitionObligationStatus(
  input: TransitionObligationStatusInput
): Promise<ServiceResult<{ obligationId: string; previousStatus: string; newStatus: string; title: string }>> {
  if (!isKnownStatus(input.newStatus)) {
    return {
      ok: false,
      error: `Estado desconocido: '${input.newStatus}'.`,
      code: "invalid_input",
    };
  }

  const ob = await prisma.obligation.findFirst({
    where: { id: input.obligationId, unit: { property: { workspace: { ownerId: input.ownerId } } } },
    include: { unit: { select: { id: true, property: { select: { workspaceId: true } } } } },
  });

  if (!ob) {
    return { ok: false, error: "Obligación no encontrada.", code: "not_found" };
  }

  const previousStatus = ob.status as ObligationStatus;
  const targetStatus = input.newStatus as ObligationStatus;

  if (!isValidOwnerTransition(previousStatus, targetStatus)) {
    const allowed = getAllowedOwnerTransitions(previousStatus);
    const allowedLabel = allowed.length > 0 ? allowed.join(", ") : "ninguna";
    return {
      ok: false,
      error: `Transición inválida: '${previousStatus}' → '${targetStatus}'. Permitidas: ${allowedLabel}.`,
      code: "invalid_input",
    };
  }

  await prisma.obligation.update({
    where: { id: input.obligationId },
    data: { status: targetStatus },
  });

  void logActivity({
    workspaceId: ob.unit.property.workspaceId,
    unitId: ob.unitId,
    actorType: "owner",
    actorId: input.ownerId,
    action: "obligation.updated",
    entityType: "obligation",
    entityId: input.obligationId,
    metadata: { previousStatus, newStatus: targetStatus, title: ob.title },
    channel: input.channel,
  });

  return {
    ok: true,
    data: {
      obligationId: ob.id,
      previousStatus,
      newStatus: targetStatus,
      title: ob.title,
    },
  };
}

// ─── markObligationReminded ──────────────────────────────────────
//
// System/cron: marks an obligation as reminded after sending a reminder.
// Only valid from: upcoming, pending, reminded (see CRON_REMIND_FROM).
// Never touches proof_uploaded, verified, overdue, or cancelled.

export interface MarkObligationRemindedInput {
  obligationId: string;
  workspaceId: string;
  unitId: string;
  metadata?: { event?: string; email?: string };
}

export async function markObligationReminded(
  input: MarkObligationRemindedInput
): Promise<ServiceResult<{ obligationId: string }>> {
  const ob = await prisma.obligation.findUnique({
    where: { id: input.obligationId },
    select: { id: true, status: true },
  });

  if (!ob) {
    return { ok: false, error: "Obligación no encontrada.", code: "not_found" };
  }

  if (!canMarkReminded(ob.status as ObligationStatus)) {
    return {
      ok: false,
      error: `No se puede marcar como reminded desde '${ob.status}'.`,
      code: "invalid_input",
    };
  }

  await prisma.obligation.update({
    where: { id: input.obligationId },
    data: { status: "reminded" },
  });

  void logActivity({
    workspaceId: input.workspaceId,
    unitId: input.unitId,
    actorType: "cron",
    action: "reminder.sent",
    entityType: "obligation",
    entityId: input.obligationId,
    metadata: input.metadata,
    channel: "cron",
  });

  return { ok: true, data: { obligationId: ob.id } };
}

// ─── markObligationOverdue ───────────────────────────────────────
//
// System/cron: marks an obligation as overdue after the due date passes.
// Never touches proof_uploaded, verified, or cancelled.

export interface MarkObligationOverdueInput {
  obligationId: string;
  workspaceId: string;
  unitId: string;
}

export async function markObligationOverdue(
  input: MarkObligationOverdueInput
): Promise<ServiceResult<{ obligationId: string }>> {
  const ob = await prisma.obligation.findUnique({
    where: { id: input.obligationId },
    select: { id: true, status: true },
  });

  if (!ob) {
    return { ok: false, error: "Obligación no encontrada.", code: "not_found" };
  }

  if (!canMarkOverdue(ob.status as ObligationStatus)) {
    // Silent skip for idempotency — cron may run multiple times
    return { ok: false, error: `Estado '${ob.status}' protegido, no se marca como overdue.`, code: "invalid_input" };
  }

  await prisma.obligation.update({
    where: { id: input.obligationId },
    data: { status: "overdue" },
  });

  void logActivity({
    workspaceId: input.workspaceId,
    unitId: input.unitId,
    actorType: "cron",
    action: "obligation.updated",
    entityType: "obligation",
    entityId: input.obligationId,
    metadata: { previousStatus: ob.status, newStatus: "overdue" },
    channel: "cron",
  });

  return { ok: true, data: { obligationId: ob.id } };
}

// ─── verifyPaymentByExternalRef ──────────────────────────────────
//
// Trusted external system (MercadoPago webhook) marks an obligation as
// verified by resolving its ID from an external reference string.
//
// Validation:
//   1. Parses and resolves obligationId from externalReference.
//   2. Confirms the obligation exists and is in a verifiable state.
//   3. Persists: status → verified, paidAt, optional paymentId.
//   4. Writes ActivityLog (actorType: "system").
//
// No ownerId required — caller is a trusted webhook with its own
// authentication layer (secret header check in the route).

export interface VerifyPaymentByExternalRefInput {
  externalReference: string;
  paymentId?: string;
}

export async function verifyPaymentByExternalRef(
  input: VerifyPaymentByExternalRefInput
): Promise<ServiceResult<{ obligationId: string; wasAlreadyVerified: boolean }>> {
  const obligationId = parseExternalReference(input.externalReference);

  if (!obligationId) {
    return {
      ok: false,
      error: "external_reference inválido: no se pudo resolver el obligationId.",
      code: "invalid_input",
    };
  }

  const ob = await prisma.obligation.findUnique({
    where: { id: obligationId },
    include: { unit: { select: { id: true, property: { select: { workspaceId: true } } } } },
  });

  if (!ob) {
    return { ok: false, error: "Obligación no encontrada.", code: "not_found" };
  }

  // Idempotent: if already verified, return success without re-processing
  if (ob.status === "verified") {
    return { ok: true, data: { obligationId, wasAlreadyVerified: true } };
  }

  if (!canExternalVerify(ob.status as ObligationStatus)) {
    return {
      ok: false,
      error: `La obligación está en estado '${ob.status}' y no puede ser verificada externamente.`,
      code: "invalid_input",
    };
  }

  await prisma.$transaction([
    prisma.obligation.update({
      where: { id: obligationId },
      data: {
        status: "verified",
        paidAt: new Date(),
        ...(input.paymentId ? { paymentId: input.paymentId } : {}),
      },
    }),
    prisma.notificationLog.upsert({
      where: { obligationId_type: { obligationId, type: "payment_confirmed" } },
      update: {},
      create: { obligationId, type: "payment_confirmed", sentTo: "mercadopago" },
    }),
  ]);

  void logActivity({
    workspaceId: ob.unit.property.workspaceId,
    unitId: ob.unit.id,
    actorType: "system",
    action: "payment.verified",
    entityType: "obligation",
    entityId: obligationId,
    metadata: {
      source: "mercadopago",
      externalReference: input.externalReference,
      paymentId: input.paymentId ?? null,
    },
    channel: "webhook",
  });

  return { ok: true, data: { obligationId, wasAlreadyVerified: false } };
}

// ─── createRecurringObligation ───────────────────────────────────
//
// Creates an ObligationTemplate (recurring charge) for the given unit.
//
// The agent is responsible for resolving workspaceId and unitId from
// conversational context before calling this function.
// Ownership is re-validated here via the Prisma query.
//
// billingPeriod defaults to "monthly" for any unrecognised value.

export interface CreateRecurringObligationInput {
  ownerId: string;
  unitId: string;
  type: ObligationType;
  title: string;
  amount: number;
  dueDay: number;
  currency?: string;
  frequency?: string;
  channel: ActivityChannel;
}

export async function createRecurringObligation(
  input: CreateRecurringObligationInput
): Promise<ServiceResult<{ templateId: string; billingPeriod: string }>> {
  const unit = await prisma.unit.findFirst({
    where: { id: input.unitId, property: { workspace: { ownerId: input.ownerId } } },
    select: { id: true, property: { select: { workspaceId: true } } },
  });

  if (!unit) return { ok: false, error: "Unidad no encontrada o sin permisos.", code: "forbidden" };

  const billingPeriod =
    input.frequency && ["monthly", "bimonthly", "quarterly"].includes(input.frequency)
      ? input.frequency
      : "monthly";

  // upsert: if a template of the same type already exists for this unit, update it
  const template = await prisma.obligationTemplate.upsert({
    where: { unitId_type: { unitId: input.unitId, type: input.type } },
    create: {
      unitId: input.unitId,
      type: input.type,
      title: input.title,
      amount: toPrismaDecimal(input.amount),
      currency: input.currency ?? "ARS",
      dueDay: input.dueDay,
      ingestionMode: "manual",
      billingPeriod,
    },
    update: {
      title: input.title,
      amount: toPrismaDecimal(input.amount),
      currency: input.currency ?? "ARS",
      dueDay: input.dueDay,
      billingPeriod,
      isActive: true,
    },
  });

  void logActivity({
    workspaceId: unit.property.workspaceId,
    unitId: input.unitId,
    actorType: "owner",
    actorId: input.ownerId,
    action: "obligation.created",
    entityType: "obligation",
    entityId: template.id,
    metadata: { title: input.title, amount: input.amount, billingPeriod, recurring: true },
    channel: input.channel,
  });

  return { ok: true, data: { templateId: template.id, billingPeriod } };
}
