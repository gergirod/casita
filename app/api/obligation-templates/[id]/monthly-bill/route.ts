import { NextRequest, NextResponse } from "next/server";
import { requireOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { extractBillData } from "@/lib/bill-extractor";

/**
 * POST /api/obligation-templates/[id]/monthly-bill
 *
 * Finds or creates the current month's Obligation for this template,
 * then attaches the uploaded bill and optionally extracts data via Gemini.
 * Also accepts `manualAmount` + `manualDueDate` for manual entry (no file).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerFromRequest();
  if (!owner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: templateId } = await params;

  const template = await prisma.obligationTemplate.findFirst({
    where: {
      id: templateId,
      unit: { property: { workspace: { ownerId: owner.id } } },
    },
    include: {
      unit: {
        include: {
          tenantContact: { select: { fullName: true, email: true } },
          property: { select: { name: true } },
        },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
  }

  /* Find or create the obligation for the current month */
  const now = new Date();
  const dueMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let obligation = await prisma.obligation.findFirst({
    where: { templateId, dueMonth },
  });

  if (!obligation) {
    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), template.dueDay));
    obligation = await prisma.obligation.create({
      data: {
        unitId: template.unitId,
        templateId,
        type: template.type,
        sourceType: "manual",
        title: template.title,
        amount: template.amount,
        currency: template.currency,
        dueDate,
        dueMonth,
        status: "pending",
      },
    });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const manualAmount = formData.get("manualAmount");
  const manualDueDateRaw = formData.get("manualDueDate");

  let originalBillUrl: string | null = null;
  let extractedAmount: number | null = null;
  let extractedPeriod: string | null = null;
  let extractedDueDate: Date | null = null;
  let newAmount = obligation.amount;

  if (file instanceof Blob && file.size > 0) {
    const ext = (file as File).name?.split(".").pop() ?? "pdf";
    const storagePath = `${template.unitId}/${templateId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    /* Upload file — if storage fails, still save the obligation with manual fallback */
    try {
      await uploadFileToBucket({
        bucket: STORAGE_BUCKETS.originalBills,
        path: storagePath,
        file: buffer,
        contentType: file.type || "application/pdf",
      });
      originalBillUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);
    } catch (uploadErr) {
      console.error("[monthly-bill] Storage upload failed:", uploadErr);
      return NextResponse.json(
        { error: "No se pudo guardar el archivo. Verificá que el bucket 'original-bills' exista en Supabase.", detail: String(uploadErr) },
        { status: 500 }
      );
    }

    /* Extract data with Gemini — optional, never blocks the flow */
    try {
      const extraction = await extractBillData(buffer, file.type || "application/pdf");
      extractedAmount = extraction.totalAmount;
      extractedPeriod = extraction.period ?? null;
      if (extraction.dueDate) extractedDueDate = new Date(extraction.dueDate);
      if (extraction.totalAmount != null) {
        newAmount = extraction.totalAmount as unknown as typeof obligation.amount;
      }
    } catch (geminiErr) {
      console.warn("[monthly-bill] Gemini extraction failed (non-fatal):", geminiErr);
    }
  } else if (manualAmount) {
    /* Manual entry without file */
    const parsed = Number(manualAmount);
    if (!isNaN(parsed) && parsed > 0) {
      newAmount = parsed as unknown as typeof obligation.amount;
    }
    if (manualDueDateRaw) {
      try { extractedDueDate = new Date(manualDueDateRaw.toString()); } catch { /* ignore */ }
    }
  } else {
    return NextResponse.json({ error: "Se requiere archivo o monto manual" }, { status: 400 });
  }

  /* Update obligation */
  const updated = await prisma.obligation.update({
    where: { id: obligation.id },
    data: {
      amount: newAmount,
      ...(originalBillUrl && { originalBillUrl, extractionSource: extractedAmount != null ? "gemini" : null }),
      ...(extractedAmount != null && { extractedAmount }),
      ...(extractedDueDate && { dueDate: extractedDueDate, extractedDueDate }),
      ...(extractedPeriod && { extractedPeriod }),
    },
  });

  /* Reminders are handled by the daily cron job (/api/cron/send-reminders)
     based on the template's reminderDays setting — no immediate notification here. */

  return NextResponse.json({
    ok: true,
    obligationId: updated.id,
    amount: updated.amount.toString(),
    dueDate: updated.dueDate.toISOString(),
    originalBillUrl,
    extractedAmount,
    extractedPeriod,
    extractedDueDate: extractedDueDate?.toISOString() ?? null,
  });
}
