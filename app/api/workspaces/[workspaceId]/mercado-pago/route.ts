import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  paymentLink: z.string().url().optional().or(z.literal("")),
  enabled: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
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

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { paymentLink, enabled } = parsed.data;

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(paymentLink !== undefined && {
        mpPaymentLink: paymentLink || null,
        mpEnabled: !!paymentLink,
      }),
      ...(enabled !== undefined && !paymentLink && { mpEnabled: enabled }),
    },
  });

  return NextResponse.json({ ok: true });
}
