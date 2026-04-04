/*
  POST /api/webhooks/n8n-bill
  ───────────────────────────
  n8n llama a este endpoint cuando detecta un email de factura en el buzón del owner.
  Corre cada mes según el schedule que el owner configure en n8n.

  Payload (JSON):
  {
    "secret":       "<WEBHOOK_SECRET>",
    "providerSlug": "edenor",
    "from":         "factura@edenor.com",
    "subject":      "Tu factura de Edenor",
    "emailDate":    "2025-04-01T10:00:00Z",
    "pdfBase64":    "<base64 del PDF>",
    "mimeType":     "application/pdf"
  }

  Flujo:
  1. Busca todas las ObligationTemplates con ese providerSlug
  2. Sube el PDF a Storage y extrae datos con Gemini
  3. Crea/actualiza la Obligation del mes (idempotente)
  4. Notifica al inquilino por email O WhatsApp según reminderChannel del template
*/

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { extractBillData, isExtractionConfigured } from "@/lib/bill-extractor";
import { getInitialStatusFromDueDate } from "@/lib/obligations";
import { sendBillNotificationEmail } from "@/lib/email";
import { sendWhatsApp, buildReminderMessage } from "@/lib/whatsapp";

function isoYearMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret && body.secret !== expectedSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { providerSlug, from, subject, emailDate, pdfBase64, mimeType = "application/pdf" } = body;

  if (!providerSlug || typeof providerSlug !== "string") {
    return NextResponse.json({ error: "providerSlug requerido" }, { status: 400 });
  }
  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return NextResponse.json({ error: "pdfBase64 requerido" }, { status: 400 });
  }

  /* ── Templates con este proveedor ────────────────────────── */
  const templates = await prisma.obligationTemplate.findMany({
    where: { providerSlug, isActive: true },
    include: {
      unit: {
        include: {
          tenantContact: { select: { fullName: true, email: true, whatsapp: true } },
          property:      { select: { name: true } },
        },
      },
    },
  });

  if (templates.length === 0) {
    return NextResponse.json({
      ok: true,
      message: `No hay templates con providerSlug="${providerSlug}"`,
      created: 0,
    });
  }

  /* ── PDF → Storage + Gemini ──────────────────────────────── */
  const buffer   = Buffer.from(pdfBase64, "base64");
  const filename = `n8n-${providerSlug}-${Date.now()}.pdf`;

  let extracted: Awaited<ReturnType<typeof extractBillData>> | null = null;
  if (isExtractionConfigured()) {
    extracted = await extractBillData(buffer, mimeType).catch(() => null);
  }

  const referenceDate = emailDate ? new Date(emailDate) : new Date();
  const dueMonth      = isoYearMonth(referenceDate);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const results: { unitId: string; obligationId: string; notified: string }[] = [];

  for (const template of templates) {
    const unit = template.unit;

    /* Upload */
    const storagePath = `${unit.id}/${filename}`;
    await uploadFileToBucket({
      bucket:      STORAGE_BUCKETS.originalBills,
      path:        storagePath,
      file:        buffer,
      contentType: mimeType,
    });
    const billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

    /* Monto y vencimiento */
    const dueDate = extracted?.dueDate
      ? new Date(extracted.dueDate)
      : new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), template.dueDay));
    const amount  = extracted?.totalAmount ?? Number(template.amount);
    const status  = getInitialStatusFromDueDate(dueDate);

    /* Upsert obligation */
    const obligation = await prisma.obligation.upsert({
      where:  { templateId_dueMonth: { templateId: template.id, dueMonth } },
      update: {
        amount, dueDate, originalBillUrl: billUrl, status,
        ...(extracted && {
          extractionSource: "n8n",
          extractedAmount:  extracted.totalAmount ?? undefined,
          extractedDueDate: extracted.dueDate ? new Date(extracted.dueDate) : undefined,
          extractedPeriod:  extracted.period ?? undefined,
        }),
      },
      create: {
        unitId:         unit.id,
        templateId:     template.id,
        type:           template.type,
        sourceType:     "n8n",
        title:          template.title,
        amount, dueDate, dueMonth,
        currency:       template.currency,
        status,
        originalBillUrl: billUrl,
        notes: `Recibido vía n8n | From: ${from ?? "—"} | Subject: ${subject ?? "—"}`,
        ...(extracted && {
          extractionSource: "n8n",
          extractedAmount:  extracted.totalAmount ?? undefined,
          extractedDueDate: extracted.dueDate ? new Date(extracted.dueDate) : undefined,
          extractedPeriod:  extracted.period ?? undefined,
        }),
      },
    });

    /* ── Notificar inquilino según canal configurado ─────────── */
    const contact         = unit.tenantContact;
    const reminderChannel = template.reminderChannel; /* "email" | "whatsapp" | "both" */
    const portalUrl       = `${appUrl}/t/${unit.tenantToken}`;
    let   notified        = "none";

    const wantsEmail    = contact?.email    && (reminderChannel === "email"    || reminderChannel === "both");
    const wantsWhatsApp = contact?.whatsapp && (reminderChannel === "whatsapp" || reminderChannel === "both");

    if (wantsEmail) {
      void sendBillNotificationEmail({
        to:              contact.email!,
        tenantName:      contact.fullName,
        title:           template.title,
        amount:          amount.toFixed(2),
        dueDate:         dueDate.toISOString(),
        tenantToken:     unit.tenantToken,
        propertyName:    unit.property.name,
        unitIdentifier:  unit.identifier,
        originalBillUrl: billUrl,
      }).catch(() => {});
      notified = "email";
    }

    if (wantsWhatsApp) {
      void sendWhatsApp({
        to:   contact.whatsapp!,
        body: buildReminderMessage({
          tenantName:      contact.fullName,
          title:           template.title,
          amount:          amount.toString(),
          currency:        template.currency,
          dueDate:         dueDate.toISOString(),
          daysUntilDue:    Math.ceil((dueDate.getTime() - Date.now()) / 864e5),
          propertyName:    unit.property.name,
          unitIdentifier:  unit.identifier,
          portalUrl,
        }),
      }).catch(() => {});
      notified = notified === "email" ? "both" : "whatsapp";
    }

    results.push({ unitId: unit.id, obligationId: obligation.id, notified });
  }

  return NextResponse.json({ ok: true, created: results.length, results });
}
