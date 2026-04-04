import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerFromRequest } from "@/lib/api-auth";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { getInitialStatusFromDueDate } from "@/lib/obligations";
import { sendBillNotificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const owner = await requireOwnerFromRequest();
  if (!owner) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const unitId   = formData.get("unitId");
  const type     = formData.get("type");
  const title    = formData.get("title");
  const amount   = formData.get("amount");
  const dueDate  = formData.get("dueDate");
  const file     = formData.get("file");

  /* Optional fields from extraction flow */
  const existingBillUrl    = formData.get("existingBillUrl");   /* already uploaded in /extract */
  const extractionSource   = formData.get("extractionSource");  /* "gemini" */
  const extractedAmount    = formData.get("extractedAmount");
  const extractedDueDate   = formData.get("extractedDueDate");
  const extractedPeriod    = formData.get("extractedPeriod");

  if (
    !unitId || typeof unitId !== "string" ||
    !type   || typeof type !== "string" ||
    !title  || typeof title !== "string" ||
    !amount || typeof amount !== "string" ||
    !dueDate|| typeof dueDate !== "string"
  ) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      property: { workspace: { ownerId: owner.id } },
    },
    include: {
      property: { select: { name: true, workspace: { select: { id: true } } } },
      tenantContact: { select: { fullName: true, email: true } },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  /* Use pre-uploaded URL if provided; otherwise upload the file now */
  let originalBillUrl: string | null =
    typeof existingBillUrl === "string" && existingBillUrl ? existingBillUrl : null;

  if (!originalBillUrl && file && file instanceof Blob) {
    const ext         = (file as File).name?.split(".").pop() ?? "pdf";
    const storagePath = `${unitId}/${Date.now()}.${ext}`;
    const buffer      = Buffer.from(await file.arrayBuffer());
    await uploadFileToBucket({
      bucket: STORAGE_BUCKETS.originalBills,
      path: storagePath,
      file: buffer,
      contentType: file.type || "application/pdf",
    });
    originalBillUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);
  }

  const parsedDueDate = new Date(dueDate);
  const status = getInitialStatusFromDueDate(parsedDueDate);

  const obligation = await prisma.obligation.create({
    data: {
      unitId,
      type: type as never,
      sourceType: "manual",
      title,
      amount: parseFloat(amount),
      dueDate: parsedDueDate,
      status,
      originalBillUrl,
      ...(extractionSource && { extractionSource: String(extractionSource) }),
      ...(extractedAmount  && { extractedAmount: parseFloat(String(extractedAmount)) }),
      ...(extractedDueDate && { extractedDueDate: new Date(String(extractedDueDate)) }),
      ...(extractedPeriod  && { extractedPeriod: String(extractedPeriod) }),
    },
  });

  const contact = unit.tenantContact;
  if (contact?.email) {
    void sendBillNotificationEmail({
      to: contact.email,
      tenantName: contact.fullName,
      title,
      amount,
      dueDate: parsedDueDate.toISOString(),
      tenantToken: unit.tenantToken,
      propertyName: unit.property.name,
      unitIdentifier: unit.identifier,
      originalBillUrl: originalBillUrl ?? "#",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, obligationId: obligation.id });
}
