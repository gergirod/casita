import { prisma } from "@/lib/prisma";
import { sendDueSoonEmail, sendDueTodayEmail, sendOverdueEmail } from "@/lib/email";
import { sendWhatsApp, buildReminderMessage } from "@/lib/whatsapp";
import { logActivity, type ActivityChannel } from "@/lib/services/activity-log";
import type { ServiceResult } from "@/lib/services/obligations";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Pure function — no DB, no side effects.
 * Selects which email template to use based on days remaining until due.
 * Exported for independent unit testing.
 *
 *   daysUntilDue ≤ 0  → "overdue"   (past due)
 *   daysUntilDue = 1  → "today"     (due within 24 h)
 *   daysUntilDue ≥ 2  → "soon"      (approaching)
 */
export function selectReminderEmailType(
  daysUntilDue: number
): "overdue" | "today" | "soon" {
  if (daysUntilDue <= 0) return "overdue";
  if (daysUntilDue <= 1) return "today";
  return "soon";
}

// ─── sendReminderToTenant ────────────────────────────────────────
//
// Sends a payment reminder via email and/or WhatsApp according to channel
// availability and how many days remain until the obligation is due.
//
// Ownership is validated internally via the Prisma query.
// logActivity is fired non-blocking after a successful send.

export interface SendReminderInput {
  ownerId: string;
  obligationId: string;
  channel: ActivityChannel;
}

export async function sendReminderToTenant(
  input: SendReminderInput
): Promise<ServiceResult<{ channels: string[] }>> {
  const ob = await prisma.obligation.findFirst({
    where: {
      id: input.obligationId,
      unit: { property: { workspace: { ownerId: input.ownerId } } },
    },
    include: {
      unit: {
        include: {
          tenantContact: true,
          property: {
            select: {
              name: true,
              workspace: { select: { id: true, whatsappEnabled: true } },
            },
          },
        },
      },
    },
  });

  if (!ob) return { ok: false, error: "Obligación no encontrada.", code: "not_found" };

  const contact = ob.unit.tenantContact;
  if (!contact) return { ok: false, error: "No hay inquilino registrado.", code: "not_found" };

  const channels: string[] = [];
  const daysUntilDue = Math.round((ob.dueDate.getTime() - Date.now()) / 864e5);

  if (contact.email) {
    try {
      const emailArgs = {
        to: contact.email,
        tenantName: contact.fullName,
        title: ob.title,
        amount: ob.amount.toString(),
        dueDate: ob.dueDate.toISOString(),
        tenantToken: ob.unit.tenantToken,
        propertyName: ob.unit.property.name,
        unitIdentifier: ob.unit.identifier,
      };
      const emailType = selectReminderEmailType(daysUntilDue);
      if (emailType === "overdue") await sendOverdueEmail(emailArgs);
      else if (emailType === "today") await sendDueTodayEmail(emailArgs);
      else await sendDueSoonEmail(emailArgs);
      channels.push("email");
    } catch { /* non-blocking — channel failure never aborts the send */ }
  }

  if (contact.whatsapp && ob.unit.property.workspace.whatsappEnabled) {
    try {
      const body = buildReminderMessage({
        tenantName: contact.fullName,
        title: ob.title,
        amount: ob.amount.toString(),
        currency: ob.currency,
        dueDate: ob.dueDate.toISOString(),
        daysUntilDue,
        propertyName: ob.unit.property.name,
        unitIdentifier: ob.unit.identifier,
        portalUrl: `${APP_URL}/t/${ob.unit.tenantToken}`,
      });
      await sendWhatsApp({ to: contact.whatsapp, body });
      channels.push("whatsapp");
    } catch { /* non-blocking */ }
  }

  if (channels.length === 0) {
    return {
      ok: false,
      error: "No se pudo enviar (sin email ni WhatsApp configurado).",
      code: "invalid_input",
    };
  }

  void logActivity({
    workspaceId: ob.unit.property.workspace.id,
    unitId: ob.unit.id,
    actorType: "owner",
    actorId: input.ownerId,
    action: "reminder.sent",
    entityType: "obligation",
    entityId: input.obligationId,
    metadata: { channels },
    channel: input.channel,
  });

  return { ok: true, data: { channels } };
}

// ─── scheduleReminder ────────────────────────────────────────────
//
// Creates a scheduled reminder record.
// Validates workspace ownership and that the send date is in the future.
// The resolved workspaceId is passed in by the agent after its conversational
// context resolution (resolveWorkspaceId); ownership is re-validated here.

export interface ScheduleReminderInput {
  ownerId: string;
  workspaceId: string;
  obligationId?: string;
  sendAt: string;
  channel?: string;
  message?: string;
}

export async function scheduleReminder(
  input: ScheduleReminderInput
): Promise<ServiceResult<{ reminderId: string; sendAt: Date }>> {
  const ws = await prisma.workspace.findFirst({
    where: { id: input.workspaceId, ownerId: input.ownerId },
    select: { id: true },
  });
  if (!ws) return { ok: false, error: "Workspace no encontrado.", code: "not_found" };

  const sendDate = new Date(input.sendAt);
  if (isNaN(sendDate.getTime())) {
    return { ok: false, error: "Fecha inválida.", code: "invalid_input" };
  }
  if (sendDate.getTime() < Date.now()) {
    return { ok: false, error: "La fecha debe ser futura.", code: "invalid_input" };
  }

  const reminder = await prisma.scheduledReminder.create({
    data: {
      workspaceId: input.workspaceId,
      obligationId: input.obligationId ?? null,
      sendAt: sendDate,
      channel: input.channel ?? "both",
      message: input.message ?? null,
    },
  });

  return { ok: true, data: { reminderId: reminder.id, sendAt: reminder.sendAt } };
}

// ─── cancelReminder ──────────────────────────────────────────────
//
// Cancels a pending scheduled reminder.
// Ownership is validated by checking the reminder's workspace belongs to ownerId.

export interface CancelReminderInput {
  ownerId: string;
  reminderId: string;
}

export async function cancelReminder(
  input: CancelReminderInput
): Promise<ServiceResult<{ reminderId: string }>> {
  const reminder = await prisma.scheduledReminder.findFirst({
    where: { id: input.reminderId, workspace: { ownerId: input.ownerId }, status: "pending" },
  });

  if (!reminder) {
    return { ok: false, error: "Recordatorio no encontrado o ya enviado.", code: "not_found" };
  }

  await prisma.scheduledReminder.update({
    where: { id: input.reminderId },
    data: { status: "cancelled" },
  });

  return { ok: true, data: { reminderId: input.reminderId } };
}
