import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendDueSoonEmail,
  sendDueTodayEmail,
  sendOverdueEmail,
} from "@/lib/email";
import { sendWhatsApp, buildReminderMessage } from "@/lib/whatsapp";

/**
 * GET /api/cron/process-reminders
 *
 * Cron que corre cada 15 minutos y envía los recordatorios programados
 * cuya hora de envío ya pasó.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const due = await prisma.scheduledReminder.findMany({
    where: { status: "pending", sendAt: { lte: now } },
    include: {
      workspace: {
        select: {
          name: true,
          ownerId: true,
          properties: {
            select: {
              name: true,
              units: {
                where: { isActive: true },
                select: {
                  id: true,
                  identifier: true,
                  tenantToken: true,
                  tenantContact: true,
                  obligations: {
                    select: { id: true, title: true, amount: true, currency: true, dueDate: true, status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let sent = 0;
  const errors: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const reminder of due) {
    const unit = reminder.workspace.properties[0]?.units[0];
    if (!unit?.tenantContact) {
      await prisma.scheduledReminder.update({ where: { id: reminder.id }, data: { status: "sent", sentAt: now } });
      continue;
    }

    const contact = unit.tenantContact;
    const obligation = reminder.obligationId
      ? unit.obligations.find((o) => o.id === reminder.obligationId)
      : unit.obligations.find((o) => ["pending", "upcoming", "reminded"].includes(o.status));

    if (!obligation) {
      await prisma.scheduledReminder.update({ where: { id: reminder.id }, data: { status: "sent", sentAt: now } });
      continue;
    }

    const daysUntilDue = Math.round((obligation.dueDate.getTime() - now.getTime()) / 864e5);
    const channels: string[] = [];
    const wantsEmail = reminder.channel === "email" || reminder.channel === "both";
    const wantsWa = reminder.channel === "whatsapp" || reminder.channel === "both";
    const propertyName = reminder.workspace.properties[0]?.name ?? reminder.workspace.name;

    if (wantsEmail && contact.email) {
      try {
        const emailArgs = {
          to: contact.email, tenantName: contact.fullName, title: obligation.title,
          amount: obligation.amount.toString(), dueDate: obligation.dueDate.toISOString(),
          tenantToken: unit.tenantToken, propertyName, unitIdentifier: unit.identifier,
        };
        if (daysUntilDue <= 0) await sendOverdueEmail(emailArgs);
        else if (daysUntilDue <= 1) await sendDueTodayEmail(emailArgs);
        else await sendDueSoonEmail(emailArgs);
        channels.push("email");
      } catch { /* non-blocking */ }
    }

    const ownerProfile = await prisma.ownerProfile.findUnique({
      where: { ownerId: reminder.workspace.ownerId },
      select: { whatsappEnabled: true },
    });
    const whatsappEnabled = ownerProfile?.whatsappEnabled ?? false;

    if (wantsWa && contact.whatsapp && whatsappEnabled) {
      try {
        const body = reminder.message ?? buildReminderMessage({
          tenantName: contact.fullName, title: obligation.title, amount: obligation.amount.toString(),
          currency: obligation.currency, dueDate: obligation.dueDate.toISOString(), daysUntilDue,
          propertyName, unitIdentifier: unit.identifier,
          portalUrl: `${appUrl}/t/${unit.tenantToken}`,
        });
        await sendWhatsApp({ to: contact.whatsapp, body });
        channels.push("whatsapp");
      } catch { /* non-blocking */ }
    }

    await prisma.scheduledReminder.update({
      where: { id: reminder.id },
      data: { status: "sent", sentAt: now },
    });

    if (channels.length > 0) sent++;
    else errors.push(`${reminder.id}: no channel available`);
  }

  return NextResponse.json({ ok: true, processed: due.length, sent, errors });
}
