import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  amount:  z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ obligationId: string }> }
) {
  const owner = await requireOwnerFromRequest();
  if (!owner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { obligationId } = await params;

  const existing = await prisma.obligation.findFirst({
    where: {
      id: obligationId,
      unit: { property: { workspace: { ownerId: owner.id } } },
    },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.obligation.update({
    where: { id: obligationId },
    data: {
      ...(parsed.data.amount  != null && { amount: parsed.data.amount }),
      ...(parsed.data.dueDate        && { dueDate: new Date(parsed.data.dueDate) }),
    },
  });

  return NextResponse.json({ ok: true, amount: updated.amount.toString(), dueDate: updated.dueDate.toISOString() });
}
