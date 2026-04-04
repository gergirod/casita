import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import { sendWhatsApp, buildWelcomeMessage } from "@/lib/whatsapp";
import type { ServiceResult } from "@/lib/services/obligations";
import type { ActivityChannel } from "@/lib/services/activity-log";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── sendWelcomeToTenant ─────────────────────────────────────────
//
// Sends a welcome message to the current active tenant via email and/or
// WhatsApp, then marks welcomeSentAt on the contact record.
//
// Idempotent: returns a conflict result if the welcome was already sent.
// welcomeSentAt is only written when at least one channel succeeded.
//
// The caller (agent) resolves workspaceId from conversational context
// before calling this function. Ownership is re-validated internally.

export interface SendWelcomeInput {
  ownerId: string;
  workspaceId: string;
  channel: ActivityChannel;
}

export async function sendWelcomeToTenant(
  input: SendWelcomeInput
): Promise<ServiceResult<{ channels: string[] }>> {
  const unit = await prisma.unit.findFirst({
    where: {
      property: {
        workspaceId: input.workspaceId,
        workspace: { ownerId: input.ownerId },
      },
      isActive: true,
    },
    include: {
      tenantContact: true,
      property: { select: { name: true } },
      obligationTemplates: {
        where: { type: "rent", isActive: true },
        select: {
          paymentMethod: true,
          paymentCbu: true,
          paymentName: true,
          paymentMpLink: true,
        },
      },
    },
  });

  if (!unit) return { ok: false, error: "No hay unidad activa.", code: "not_found" };

  const contact = unit.tenantContact;
  if (!contact) return { ok: false, error: "No hay inquilino.", code: "not_found" };

  // Idempotency: already sent
  if (contact.welcomeSentAt) {
    return { ok: false, error: "La bienvenida ya fue enviada.", code: "conflict" };
  }

  const portalUrl = `${APP_URL}/t/${unit.tenantToken}`;
  const payInfo = unit.obligationTemplates[0] ?? {};
  const channels: string[] = [];

  if (contact.email) {
    try {
      await sendWelcomeEmail({
        to: contact.email,
        tenantName: contact.fullName,
        propertyName: unit.property.name,
        unitIdentifier: unit.identifier,
        tenantToken: unit.tenantToken,
        ...payInfo,
      });
      channels.push("email");
    } catch { /* non-blocking */ }
  }

  if (contact.whatsapp) {
    try {
      const body = buildWelcomeMessage({
        tenantName: contact.fullName,
        propertyName: unit.property.name,
        unitIdentifier: unit.identifier,
        portalUrl,
        ...payInfo,
      });
      await sendWhatsApp({ to: contact.whatsapp, body });
      channels.push("whatsapp");
    } catch { /* non-blocking */ }
  }

  // Only stamp welcomeSentAt if we successfully reached at least one channel
  if (channels.length > 0) {
    await prisma.tenantContact.update({
      where: { id: contact.id },
      data: { welcomeSentAt: new Date() },
    });
  }

  return { ok: true, data: { channels } };
}
