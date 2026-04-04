import { NextRequest, NextResponse } from "next/server";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { invalidateContractCache } from "@/lib/contract-reader";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { unitId } = await params;

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      property: { workspace: { ownerId: auth.user.id } },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${unitId}/contrato-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadFileToBucket({
    bucket: STORAGE_BUCKETS.contracts,
    path,
    file: buffer,
    contentType: file.type || "application/pdf",
  });

  const contractUrl = getPublicUrl(STORAGE_BUCKETS.contracts, path);

  const [updated] = await prisma.$transaction([
    prisma.unit.update({
      where: { id: unitId },
      data: { contractUrl, contractText: null },
    }),
    prisma.contractHistory.create({
      data: { unitId, url: contractUrl },
    }),
  ]);

  return NextResponse.json({ contractUrl: updated.contractUrl }, { status: 200 });
}
