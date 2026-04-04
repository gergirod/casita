import { NextRequest, NextResponse } from "next/server";
import { requireOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/units/[unitId]/end-rental
 *
 * Ends the current rental: marks the unit as inactive and sets leaseEndDate to today.
 * All history (obligations, bills, contract) is preserved on the unit.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const owner = await requireOwnerFromRequest();
  if (!owner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { unitId } = await params;

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { workspace: { ownerId: owner.id } } },
  });

  if (!unit) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!unit.isActive) return NextResponse.json({ error: "El alquiler ya está terminado" }, { status: 400 });

  const today = new Date();

  await prisma.$transaction([
    /* Deactivate the unit */
    prisma.unit.update({
      where: { id: unitId },
      data: { isActive: false, leaseEndDate: today },
    }),
    /* Deactivate all its obligation templates */
    prisma.obligationTemplate.updateMany({
      where: { unitId },
      data: { isActive: false },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
