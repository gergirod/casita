import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const tenantContactSchema = z.object({
  unitId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  whatsapp: z.string().optional()
});

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = tenantContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const unit = await prisma.unit.findFirst({
    where: { id: parsed.data.unitId, property: { workspace: { ownerId: auth.user.id } } }
  });

  if (!unit) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const contact = await prisma.tenantContact.upsert({
    where: { unitId: parsed.data.unitId },
    update: {
      fullName: parsed.data.fullName,
      email: parsed.data.email || null,
      whatsapp: parsed.data.whatsapp || null
    },
    create: {
      unitId: parsed.data.unitId,
      fullName: parsed.data.fullName,
      email: parsed.data.email || null,
      whatsapp: parsed.data.whatsapp || null
    }
  });

  return NextResponse.json({ contact }, { status: 201 });
}
