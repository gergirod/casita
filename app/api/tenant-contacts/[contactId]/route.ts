import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const updateTenantContactSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  whatsapp: z.string().optional()
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contactId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { contactId } = await context.params;
  const body = await request.json();
  const parsed = updateTenantContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.tenantContact.findFirst({
    where: { id: contactId, unit: { property: { workspace: { ownerId: auth.user.id } } } }
  });

  if (!existing) {
    return NextResponse.json({ error: "Contacto de inquilino no encontrado" }, { status: 404 });
  }

  const contact = await prisma.tenantContact.update({
    where: { id: contactId },
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email || null,
      whatsapp: parsed.data.whatsapp || null
    }
  });

  return NextResponse.json({ contact });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ contactId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { contactId } = await context.params;
  const existing = await prisma.tenantContact.findFirst({
    where: { id: contactId, unit: { property: { workspace: { ownerId: auth.user.id } } } }
  });

  if (!existing) {
    return NextResponse.json({ error: "Contacto de inquilino no encontrado" }, { status: 404 });
  }

  await prisma.tenantContact.delete({ where: { id: contactId } });
  return NextResponse.json({ ok: true });
}
