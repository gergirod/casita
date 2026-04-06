import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  enabled: z.boolean(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { workspaceId } = await context.params;
  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: auth.user.id },
    select: { id: true },
  });
  if (!ws) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // whatsappEnabled is account-level — stored in OwnerProfile, not per workspace.
  await prisma.ownerProfile.upsert({
    where: { ownerId: auth.user.id },
    create: { ownerId: auth.user.id, whatsappEnabled: parsed.data.enabled },
    update: { whatsappEnabled: parsed.data.enabled },
  });

  return NextResponse.json({ ok: true });
}
