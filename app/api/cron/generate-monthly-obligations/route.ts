import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * GET /api/cron/generate-monthly-obligations
 *
 * Runs on the 1st of each month at 8am AR time (see vercel.json).
 * For every active ObligationTemplate, generates the obligation for the
 * current month if it doesn't already exist.
 *
 * After generating RENT obligations, notifies the owner by WhatsApp so
 * they can confirm or adjust the amount before the due date.
 *
 * dueDay comes from the template — it's configurable per casita, not always 1.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

  const templates = await prisma.obligationTemplate.findMany({
    where: { isActive: true },
    include: {
      unit: {
        include: {
          tenantContact: { select: { fullName: true } },
          property: {
            include: {
              workspace: {
                select: { id: true, name: true, ownerId: true },
              },
            },
          },
        },
      },
    },
  });

  // Build ownerProfile map keyed by ownerId to avoid N queries
  const ownerIds = [...new Set(templates.map(t => t.unit.property.workspace.ownerId))];
  const profiles = await prisma.ownerProfile.findMany({
    where: { ownerId: { in: ownerIds } },
    select: { ownerId: true, phone: true, whatsappEnabled: true },
  });
  const profileMap = new Map(profiles.map(p => [p.ownerId, p]));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const tpl of templates) {
    try {
      // Respect billing period
      if (tpl.billingPeriod === "bimonthly" && month % 2 !== 0) { skipped++; continue; }
      if (tpl.billingPeriod === "quarterly"  && month % 3 !== 0) { skipped++; continue; }

      // Skip if obligation already exists for this month
      const existing = await prisma.obligation.findFirst({
        where: { templateId: tpl.id, dueDate: { gte: monthStart, lte: monthEnd } },
        select: { id: true },
      });
      if (existing) { skipped++; continue; }

      // Clamp dueDay to last day of month (e.g. Feb 30 → Feb 28)
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const day     = Math.min(tpl.dueDay, daysInMonth);
      const dueDate = new Date(Date.UTC(year, month, day));

      await prisma.obligation.create({
        data: {
          unitId:          tpl.unitId,
          templateId:      tpl.id,
          type:            tpl.type,
          sourceType:      tpl.type === "rent" ? "recurring_rent" : "recurring",
          title:           tpl.title,
          amount:          tpl.amount,
          currency:        tpl.currency,
          dueDate,
          dueMonth:        monthStart,
          status:          "upcoming",
          paymentProvider: tpl.paymentMethod ?? null,
          paymentLinkUrl:  tpl.paymentMpLink ?? null,
        },
      });
      created++;

      // Notify owner by WhatsApp only for RENT — other types appear in the daily alerts
      const workspace = tpl.unit.property.workspace;
      const profile   = profileMap.get(workspace.ownerId);

      if (tpl.type === "rent" && profile?.phone && profile.whatsappEnabled) {
        const monthName = dueDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
        const amountFmt = `${tpl.currency} ${Number(tpl.amount).toLocaleString("es-AR")}`;
        const dueFmt    = dueDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
        const tenant    = tpl.unit.tenantContact?.fullName ?? "el inquilino";

        const msg =
          `🏠 *${workspace.name}* — generé el cobro de alquiler de *${monthName}*:\n\n` +
          `📋 *${tpl.title}*\n` +
          `💰 ${amountFmt} — vence el ${dueFmt}\n` +
          `👤 ${tenant}\n\n` +
          `¿El monto está bien o lo modificás?`;

        try {
          await sendWhatsApp({ to: profile.phone, body: msg });
        } catch (e) {
          errors.push(`WhatsApp ${workspace.name}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
    } catch (err) {
      errors.push(`Template ${tpl.id}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return NextResponse.json({ ok: true, created, skipped, errors });
}
