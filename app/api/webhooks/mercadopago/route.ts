import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentByExternalRef } from "@/lib/services/obligations";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

type MpWebhook = {
  action?: string;
  type?: string;
  data?: { id?: string | number };
  status?: string;
  external_reference?: string;
};

export async function POST(req: NextRequest) {
  // Secret check — MP can send a shared secret in x-signature or as query param
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incomingSecret =
      req.headers.get("x-signature") ??
      req.nextUrl.searchParams.get("secret") ??
      null;
    if (incomingSecret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = (await req.json().catch(() => ({}))) as MpWebhook;

  // Fast path: webhook includes approved status + external_reference.
  // We validate and resolve the obligation before marking as verified.
  if (payload.status === "approved" && payload.external_reference) {
    const paymentId = payload.data?.id ? String(payload.data.id) : undefined;

    const result = await verifyPaymentByExternalRef({
      externalReference: payload.external_reference,
      paymentId,
    });

    if (!result.ok) {
      // Log the failure but return 200 to avoid MP retry storms
      console.warn("[mercadopago-webhook] verifyPaymentByExternalRef failed:", result.error);
      return NextResponse.json({
        ok: false,
        via: "payload",
        error: result.error,
        code: result.code,
      });
    }

    // Notify owner via WhatsApp on first verification (non-blocking)
    if (!result.data.wasAlreadyVerified) {
      void notifyOwnerPaymentReceived(result.data.obligationId);
    }

    return NextResponse.json({
      ok: true,
      via: "payload",
      obligationId: result.data.obligationId,
      wasAlreadyVerified: result.data.wasAlreadyVerified,
    });
  }

// ─── Owner notification ──────────────────────────────────────────

async function notifyOwnerPaymentReceived(obligationId: string): Promise<void> {
  try {
    const ob = await prisma.obligation.findUnique({
      where: { id: obligationId },
      select: {
        title: true,
        amount: true,
        currency: true,
        unit: {
          select: {
            property: {
              select: {
                workspace: { select: { ownerId: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!ob) return;

    const ownerId = ob.unit.property.workspace.ownerId;
    const ownerProfile = await prisma.ownerProfile.findUnique({
      where: { ownerId },
      select: { phone: true },
    });
    if (!ownerProfile?.phone) return;

    const amt = ob.currency === "USD"
      ? `U$D ${Number(ob.amount).toLocaleString("es-AR")}`
      : `$ ${Number(ob.amount).toLocaleString("es-AR")}`;

    await sendWhatsApp({
      to: ownerProfile.phone,
      body: `✅ *Pago recibido por Mercado Pago*\n\n*${ob.title}* — ${amt}\nCasita: *${ob.unit.property.workspace.name}*\n\nYa está verificado automáticamente.`,
    });
  } catch (err) {
    console.error("[mercadopago-webhook] owner notification failed:", err);
  }
}

  // Common payload from MP: only type/action/data.id — no external_reference.
  // Acknowledge and wait for retry or manual reconciliation.
  return NextResponse.json({
    ok: true,
    received: true,
    note: "Webhook recibido. Si Mercado Pago no envía external_reference en payload, configurar notificaciones detalladas o usar reconciliación por API.",
    action: payload.action ?? null,
    type: payload.type ?? null,
    dataId: payload.data?.id ? String(payload.data.id) : null,
  });
}
