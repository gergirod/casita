import { NextRequest, NextResponse } from "next/server";
import { requireOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { extractBillData } from "@/lib/bill-extractor";
import { sendBillNotificationEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ obligationId: string }> }
) {
  const owner = await requireOwnerFromRequest();
  if (!owner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { obligationId } = await params;

  const obligation = await prisma.obligation.findFirst({
    where: {
      id: obligationId,
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

  if (!obligation) {
    return NextResponse.json({ error: "Obligación no encontrada" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  /* Upload file */
  const ext = (file as File).name?.split(".").pop() ?? "pdf";
  const storagePath = `${obligation.unitId}/${obligationId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadFileToBucket({
    bucket: STORAGE_BUCKETS.originalBills,
    path: storagePath,
    file: buffer,
    contentType: file.type || "application/pdf",
  });

  const originalBillUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

  /* Extract data with Gemini */
  let extractedAmount: number | null = null;
  let extractedDueDate: Date | null = null;
  let extractedPeriod: string | null = null;
  let newAmount = obligation.amount;

  try {
    const extraction = await extractBillData(buffer, file.type || "application/pdf");
    extractedAmount = extraction.totalAmount;
    extractedPeriod = extraction.period;
    if (extraction.dueDate) {
      extractedDueDate = new Date(extraction.dueDate);
    }
    if (extraction.totalAmount != null) {
      newAmount = extraction.totalAmount as unknown as typeof obligation.amount;
    }
  } catch {
    /* Extraction failed — keep original amount, still attach the bill */
  }

  /* Update obligation */
  const updated = await prisma.obligation.update({
    where: { id: obligationId },
    data: {
      originalBillUrl,
      extractionSource: "gemini",
      ...(extractedAmount != null && { extractedAmount, amount: extractedAmount }),
      ...(extractedDueDate && { extractedDueDate }),
      ...(extractedPeriod && { extractedPeriod }),
    },
  });

  /* Notify tenant by email */
  const contact = obligation.unit.tenantContact;
  if (contact?.email) {
    void sendBillNotificationEmail({
      to: contact.email,
      tenantName: contact.fullName,
      title: obligation.title,
      amount: updated.amount.toString(),
      dueDate: updated.dueDate.toISOString(),
      tenantToken: obligation.unit.tenantToken,
      propertyName: obligation.unit.property.name,
      unitIdentifier: obligation.unit.identifier,
      originalBillUrl,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    originalBillUrl,
    amount: updated.amount.toString(),
    extractedAmount,
    extractedPeriod,
  });
}
