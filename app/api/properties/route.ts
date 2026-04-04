import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const propertySchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(2),
  address: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = propertySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: parsed.data.workspaceId, ownerId: auth.user.id }
  });

  if (!workspace) {
    return NextResponse.json({ error: "Espacio de trabajo no encontrado" }, { status: 404 });
  }

  const property = await prisma.property.create({
    data: parsed.data
  });

  return NextResponse.json({ property }, { status: 201 });
}
