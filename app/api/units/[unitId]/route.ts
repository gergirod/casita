import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const updateUnitSchema = z.object({
  identifier: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  leaseEndDate: z.string().datetime().nullish(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ unitId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { unitId } = await context.params;
  const body = await request.json();
  const parsed = updateUnitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.unit.findFirst({
    where: { id: unitId, property: { workspace: { ownerId: auth.user.id } } }
  });

  if (!existing) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const unit = await prisma.unit.update({
    where: { id: unitId },
    data: parsed.data
  });

  return NextResponse.json({ unit });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ unitId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { unitId } = await context.params;
  const existing = await prisma.unit.findFirst({
    where: { id: unitId, property: { workspace: { ownerId: auth.user.id } } }
  });

  if (!existing) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  await prisma.unit.delete({ where: { id: unitId } });
  return NextResponse.json({ ok: true });
}
