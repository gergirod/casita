import { NextRequest, NextResponse } from "next/server";
import { ObligationType } from "@prisma/client";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { createManualObligation } from "@/lib/services/obligations";

const manualObligationSchema = z.object({
  unitId: z.string().min(1),
  type: z.enum([
    ObligationType.expensas,
    ObligationType.electricity,
    ObligationType.gas,
    ObligationType.water,
    ObligationType.internet,
    ObligationType.custom
  ]),
  title: z.string().min(2),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
  notes: z.string().optional()
});

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = manualObligationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dueDate = new Date(parsed.data.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Fecha de vencimiento invalida" }, { status: 400 });
  }

  const result = await createManualObligation({
    ownerId: auth.user.id,
    unitId: parsed.data.unitId,
    type: parsed.data.type,
    title: parsed.data.title,
    amount: parsed.data.amount,
    dueDate,
    notes: parsed.data.notes,
    channel: "dashboard",
  });

  if (!result.ok) {
    const status = result.code === "forbidden" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ obligation: { id: result.data.obligationId, title: result.data.title } }, { status: 201 });
}
