import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const updateWorkspaceSchema = z.object({
  name:          z.string().min(2).optional(),
  locale:        z.string().optional(),
  currency:      z.string().optional(),
  timezone:      z.string().optional(),
  n8nWebhookUrl: z.string().url().nullable().optional(),
  n8nSecret:     z.string().nullable().optional(),
  ownerPhone:    z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { workspaceId } = await context.params;
  const body = await request.json();
  const parsed = updateWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: auth.user.id },
    select: { id: true }
  });

  if (!existing) {
    return NextResponse.json({ error: "Espacio de trabajo no encontrado" }, { status: 404 });
  }

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: parsed.data
  });

  return NextResponse.json({ workspace });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { workspaceId } = await context.params;

  const existing = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: auth.user.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Casita no encontrada" }, { status: 404 });
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });
  return NextResponse.json({ ok: true });
}
