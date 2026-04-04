import { NextRequest, NextResponse } from "next/server";
import { ObligationType } from "@prisma/client";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { toPrismaDecimal } from "@/lib/obligations";
import { prisma } from "@/lib/prisma";

const OBLIGATION_LABELS: Record<ObligationType, string> = {
  rent: "Alquiler",
  expensas: "Expensas",
  electricity: "Electricidad",
  gas: "Gas",
  water: "Agua",
  internet: "Internet",
  custom: "Cargo",
};

const schema = z.object({
  unitId:       z.string().min(1),
  type:         z.nativeEnum(ObligationType).default(ObligationType.rent),
  currency:     z.enum(["ARS", "USD"]).default("ARS"),
  amount:       z.number().min(0),
  dueDay:       z.number().int().min(1).max(31),
  providerSlug:    z.string().optional(),
  ingestionMode:   z.enum(["manual", "auto_email"]).optional(),
  billingPeriod:   z.enum(["monthly", "bimonthly", "quarterly"]).optional(),
  reminderDays:    z.number().int().min(0).max(30).optional(),
  reminderChannel: z.enum(["email", "whatsapp", "both"]).optional(),
  remindBefore:    z.boolean().optional(),
  remindOnDue:     z.boolean().optional(),
  remindOverdue:   z.boolean().optional(),
  paymentMethod:   z.enum(["cbu", "mp_link"]).optional().nullable(),
  paymentCbu:      z.string().optional().nullable(),
  paymentName:     z.string().optional().nullable(),
  paymentMpLink:   z.string().url().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    unitId,
    type,
    currency,
    amount,
    dueDay,
    providerSlug,
    ingestionMode,
    billingPeriod,
    reminderDays,
    reminderChannel,
    remindBefore,
    remindOnDue,
    remindOverdue,
    paymentMethod,
    paymentCbu,
    paymentName,
    paymentMpLink,
  } = parsed.data;

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      property: { workspace: { ownerId: auth.user.id } },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const title = `${OBLIGATION_LABELS[type]} ${unit.identifier}`;

  const extra = {
    ...(providerSlug    !== undefined && { providerSlug }),
    ...(ingestionMode   !== undefined && { ingestionMode }),
    ...(billingPeriod   !== undefined && { billingPeriod }),
    ...(reminderDays    !== undefined && { reminderDays }),
    ...(reminderChannel !== undefined && { reminderChannel }),
    ...(remindBefore    !== undefined && { remindBefore }),
    ...(remindOnDue     !== undefined && { remindOnDue }),
    ...(remindOverdue   !== undefined && { remindOverdue }),
    ...(paymentMethod   !== undefined && { paymentMethod }),
    ...(paymentCbu      !== undefined && { paymentCbu }),
    ...(paymentName     !== undefined && { paymentName }),
    ...(paymentMpLink   !== undefined && { paymentMpLink }),
  };

  const template = await prisma.obligationTemplate.upsert({
    where: { unitId_type: { unitId, type } },
    update: { title, amount: toPrismaDecimal(amount), currency, dueDay, isActive: true, ...extra },
    create: { unitId, type, title, amount: toPrismaDecimal(amount), currency, dueDay, isActive: true, ...extra },
  });

  return NextResponse.json({ template }, { status: 201 });
}
