import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * GET /api/cron/owner-alerts
 *
 * Cron diario que revisa obligaciones y le avisa al owner por WhatsApp:
 * - 3 días antes del vencimiento: "Se acerca el vencimiento de X, querés que le mande recordatorio?"
 * - Día del vencimiento: "Hoy vence X y no recibimos pago todavía"
 * - 2 días después del vencimiento: "Pasó la fecha de X y no hay comprobante, qué hacemos?"
 *
 * El owner responde al bot y decide qué hacer.
 * NO envía nada directo al inquilino — todo pasa por el owner.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const workspaces = await prisma.workspace.findMany({
    where: { ownerPhone: { not: null }, whatsappEnabled: true },
    select: {
      id: true,
      name: true,
      ownerPhone: true,
      properties: {
        select: {
          units: {
            where: { isActive: true },
            select: {
              tenantContact: { select: { fullName: true } },
              obligations: {
                where: {
                  status: { in: ["pending", "upcoming", "reminded"] },
                },
                select: {
                  id: true,
                  title: true,
                  amount: true,
                  currency: true,
                  dueDate: true,
                  status: true,
                  proofUrl: true,
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

  for (const ws of workspaces) {
    if (!ws.ownerPhone) continue;

    const unit = ws.properties[0]?.units[0];
    if (!unit) continue;

    const tenant = unit.tenantContact?.fullName ?? "el inquilino";
    const alerts: string[] = [];

    for (const ob of unit.obligations) {
      const dueDate = new Date(ob.dueDate);
      dueDate.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 864e5);
      const amountStr = `${ob.currency} ${ob.amount}`;
      const hasProof = !!ob.proofUrl;

      if (diffDays === 3) {
        alerts.push(
          `📋 *${ob.title}* (${amountStr}) vence en 3 días (${fmtDate(dueDate)}).` +
          `\n¿Querés que le mande un recordatorio a ${tenant}?`
        );
      } else if (diffDays === 0 && !hasProof) {
        alerts.push(
          `⚠️ *${ob.title}* (${amountStr}) vence *hoy* y ${tenant} todavía no envió comprobante.` +
          `\n¿Le mando un recordatorio?`
        );
      } else if (diffDays === -2 && !hasProof) {
        alerts.push(
          `🔴 *${ob.title}* (${amountStr}) venció hace 2 días y no recibimos comprobante de ${tenant}.` +
          `\n¿Qué hacemos? Puedo mandarle un recordatorio o cancelar la obligación.`
        );
      }
    }

    if (alerts.length === 0) continue;

    const header = alerts.length === 1
      ? `Hola, tengo una novedad de *${ws.name}*:\n\n`
      : `Hola, tengo ${alerts.length} novedades de *${ws.name}*:\n\n`;

    const body = header + alerts.join("\n\n");

    try {
      await sendWhatsApp({ to: ws.ownerPhone, body });
      sent++;
    } catch (err) {
      errors.push(`${ws.name}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
