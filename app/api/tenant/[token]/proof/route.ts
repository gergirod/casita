import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markProofReceived } from "@/lib/services/obligations";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const unit = await prisma.unit.findUnique({
    where: { tenantToken: token },
    include: {
      property: {
        select: {
          name: true,
          workspace: { select: { id: true, ownerId: true } },
        },
      },
      tenantContact: { select: { id: true, fullName: true } },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
  }

  const formData = await req.formData();
  const obligationId = formData.get("obligationId");
  const file = formData.get("file");

  if (!obligationId || typeof obligationId !== "string") {
    return NextResponse.json({ error: "obligationId requerido" }, { status: 400 });
  }
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";

  const result = await markProofReceived({
    unitId: unit.id,
    obligationId,
    fileBuffer: buffer,
    mimeType,
    workspaceId: unit.property.workspace.id,
    actorType: "tenant",
    actorId: unit.tenantContact?.id ?? unit.id,
    channel: "api",
    ownerNotification: {
      ownerId: unit.property.workspace.ownerId,
      tenantName: unit.tenantContact?.fullName ?? null,
      propertyName: unit.property.name,
      unitIdentifier: unit.identifier,
    },
  });

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, proofUrl: result.data.proofUrl });
}
