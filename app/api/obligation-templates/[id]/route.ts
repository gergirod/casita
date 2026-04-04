import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { toPrismaDecimal } from "@/lib/obligations";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  amount:          z.number().positive().optional(),
  currency:        z.enum(["ARS", "USD"]).optional(),
  dueDay:          z.number().int().min(1).max(31).optional(),
  providerSlug:    z.string().nullable().optional(),
  billingPeriod:   z.enum(["monthly", "bimonthly", "quarterly"]).optional(),
  ingestionMode:   z.enum(["manual", "auto_email"]).optional(),
  reminderDays:    z.number().int().min(0).max(30).optional(),
  reminderChannel: z.enum(["email", "whatsapp", "both"]).optional(),
  isActive:        z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  /* ownership check */
  const existing = await prisma.obligationTemplate.findFirst({
    where: {
      id,
      unit: { property: { workspace: { ownerId: auth.user.id } } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
  }

  const {
    amount,
    currency,
    dueDay,
    providerSlug,
    billingPeriod,
    ingestionMode,
    reminderDays,
    reminderChannel,
    isActive,
  } = parsed.data;

  const updated = await prisma.obligationTemplate.update({
    where: { id },
    data: {
      ...(amount          !== undefined && { amount: toPrismaDecimal(amount) }),
      ...(currency        !== undefined && { currency }),
      ...(dueDay          !== undefined && { dueDay }),
      ...(providerSlug    !== undefined && { providerSlug }),
      ...(billingPeriod   !== undefined && { billingPeriod }),
      ...(ingestionMode   !== undefined && { ingestionMode }),
      ...(reminderDays    !== undefined && { reminderDays }),
      ...(reminderChannel !== undefined && { reminderChannel }),
      ...(isActive        !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ template: updated });
}
