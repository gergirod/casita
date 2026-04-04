import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const unitSchema = z.object({
  propertyId: z.string().min(1),
  identifier: z.string().min(1),
  isActive: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = unitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: { id: parsed.data.propertyId, workspace: { ownerId: auth.user.id } }
  });

  if (!property) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  const unit = await prisma.unit.create({
    data: {
      propertyId: parsed.data.propertyId,
      identifier: parsed.data.identifier,
      isActive: parsed.data.isActive ?? true
    }
  });

  return NextResponse.json({ unit }, { status: 201 });
}
