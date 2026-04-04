import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDueSoonEmail, sendDueTodayEmail, sendOverdueEmail } from "@/lib/email";
import { markObligationReminded, markObligationOverdue } from "@/lib/services/obligations";

/**
 * GET /api/cron/send-reminders
 *
 * Runs daily via Vercel Cron (see vercel.json).
 *
 * Step 1 — Generate rent obligations for the current month.
 *   For every active rent template, find-or-create the obligation for this month.
 *   Idempotent: safe to run every day (only creates if missing).
 *
 * Step 2 — Send reminders.
 *   For each pending obligation, checks the template's reminderDays setting:
 *   - daysUntilDue == reminderDays  → "vence en N días"
 *   - daysUntilDue == 0             → "vence hoy"
 *   - daysUntilDue < 0 (overdue)    → "vencida" (once, within 7 days)
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  /* ── Step 1: Generate rent obligations for this month ──────────── */
  const thisMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const rentTemplates = await prisma.obligationTemplate.findMany({
    where: { type: "rent", isActive: true, unit: { isActive: true } },
    select: { id: true, unitId: true, title: true, amount: true, currency: true, dueDay: true },
  });

  let rentCreated = 0;
  for (const t of rentTemplates) {
    const existing = await prisma.obligation.findFirst({
      where: { templateId: t.id, dueMonth: thisMonthStart },
    });
    if (!existing) {
      const dueDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), t.dueDay));
      await prisma.obligation.create({
        data: {
          unitId:     t.unitId,
          templateId: t.id,
          type:       "rent",
          sourceType: "manual",
          title:      t.title,
          amount:     t.amount,
          currency:   t.currency,
          dueDate,
          dueMonth:   thisMonthStart,
          status:     "pending",
        },
      });
      rentCreated++;
    }
  }

  console.log(`[send-reminders] rent obligations created this run: ${rentCreated}`);

  /* Load all active, non-paid obligations that have a due date and a tenant with email */
  const obligations = await prisma.obligation.findMany({
    where: {
      status: { in: ["pending", "upcoming", "overdue", "reminded"] },
      unit: {
        isActive: true,
        tenantContact: { email: { not: null } },
      },
      templateId: { not: null },
    },
    include: {
      template: {
        select: { reminderDays: true, reminderChannel: true, remindBefore: true, remindOnDue: true, remindOverdue: true },
      },
      unit: {
        include: {
          tenantContact: { select: { fullName: true, email: true } },
          property: { select: { name: true, workspaceId: true } },
        },
      },
    },
  });

  const results: Array<{ id: string; action: string; email: string }> = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const ob of obligations) {
    const contact = ob.unit.tenantContact;
    if (!contact?.email) continue;

    const dueDate = new Date(ob.dueDate);
    dueDate.setUTCHours(0, 0, 0, 0);
    const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const reminderDays  = ob.template?.reminderDays  ?? 3;
    const remindBefore  = ob.template?.remindBefore  ?? true;
    const remindOnDue   = ob.template?.remindOnDue   ?? true;
    const remindOverdue = ob.template?.remindOverdue ?? true;

    const emailInput = {
      to: contact.email,
      tenantName: contact.fullName,
      title: ob.title,
      amount: ob.amount.toString(),
      dueDate: ob.dueDate.toISOString(),
      tenantToken: ob.unit.tenantToken,
      propertyName: ob.unit.property.name,
      unitIdentifier: ob.unit.identifier,
    };

    const systemCtx = {
      obligationId: ob.id,
      workspaceId: ob.unit.property.workspaceId,
      unitId: ob.unitId,
    };

    try {
      if (remindBefore && daysUntilDue === reminderDays && reminderDays > 0) {
        /* Advance reminder: X days before due date */
        await sendDueSoonEmail({ ...emailInput, daysUntilDue: reminderDays });
        await markObligationReminded({ ...systemCtx, metadata: { event: `due_soon_${reminderDays}d`, email: contact.email } });
        results.push({ id: ob.id, action: `due_soon_${reminderDays}d`, email: contact.email });

      } else if (remindOnDue && daysUntilDue === 0) {
        /* Reminder on the due date */
        await sendDueTodayEmail(emailInput);
        await markObligationReminded({ ...systemCtx, metadata: { event: "due_today", email: contact.email } });
        results.push({ id: ob.id, action: "due_today", email: contact.email });

      } else if (daysUntilDue === -5 && ob.status !== "verified") {
        /* Overdue follow-up — 5 days after due date, only if not paid */
        if (remindOverdue) {
          await sendOverdueEmail(emailInput);
          results.push({ id: ob.id, action: "overdue_5d", email: contact.email });
        }
        await markObligationOverdue(systemCtx);

      } else if (daysUntilDue < 0 && ob.status === "pending") {
        /* Mark as overdue without sending (flag disabled or not the right day) */
        await markObligationOverdue(systemCtx);
      }
    } catch (err) {
      errors.push({ id: ob.id, error: String(err) });
    }
  }

  console.log(`[send-reminders] processed=${obligations.length} sent=${results.length} errors=${errors.length} rentCreated=${rentCreated}`);

  return NextResponse.json({
    ok: true,
    date: today.toISOString().slice(0, 10),
    rentObligationsCreated: rentCreated,
    sent: results.length,
    errors: errors.length,
    details: results,
  });
}
