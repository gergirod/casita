import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const updatePropertySchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  notes: z.string().optional()
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { propertyId } = await context.params;
  const body = await request.json();
  const parsed = updatePropertySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.property.findFirst({
    where: { id: propertyId, workspace: { ownerId: auth.user.id } }
  });

  if (!existing) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  const property = await prisma.property.update({
    where: { id: propertyId },
    data: parsed.data
  });

  return NextResponse.json({ property });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { propertyId } = await context.params;
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, workspace: { ownerId: auth.user.id } }
  });

  if (!existing) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  await prisma.property.delete({ where: { id: propertyId } });
  return NextResponse.json({ ok: true });
}
