import { NextRequest, NextResponse } from "next/server";
import { requireOwnerFromRequest } from "@/lib/api-auth";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { extractBillData, isExtractionConfigured } from "@/lib/bill-extractor";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(req: NextRequest) {
  const owner = await requireOwnerFromRequest();
  if (!owner) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const mimeType = file.type || "application/pdf";
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Formato no soportado. Usá PDF, JPG, PNG o WEBP." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext    = (file as File).name?.split(".").pop() ?? "pdf";

  /* Upload to temp storage so the URL can be reused in the final /upload call */
  const storagePath = `temp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await uploadFileToBucket({
    bucket: STORAGE_BUCKETS.originalBills,
    path: storagePath,
    file: buffer,
    contentType: mimeType,
  });
  const billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

  if (!isExtractionConfigured()) {
    return NextResponse.json({
      billUrl,
      extracted: null,
      geminiAvailable: false,
    });
  }

  const extracted = await extractBillData(buffer, mimeType);

  return NextResponse.json({
    billUrl,
    extracted,
    geminiAvailable: true,
  });
}
