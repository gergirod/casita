import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ObligationType } from "@prisma/client";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { toPrismaDecimal } from "@/lib/obligations";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  workspaceName:    z.string().min(1),
  propertyName:     z.string().min(1),
  propertyAddress:  z.string().optional(),
  unitIdentifier:   z.string().min(1),
  tenant: z.object({
    fullName: z.string().min(1),
    email:    z.string().email().optional().or(z.literal("")),
    whatsapp: z.string().optional(),
  }).optional(),
  obligation: z.object({
    type:          z.nativeEnum(ObligationType),
    currency:      z.enum(["ARS", "USD"]),
    amount:        z.number().positive(),
    dueDay:        z.number().int().min(1).max(31),
    providerSlug:  z.string().optional(),
    paymentMethod: z.enum(["cbu", "mp_link"]).optional().nullable(),
    paymentCbu:    z.string().optional().nullable(),
    paymentName:   z.string().optional().nullable(),
    paymentMpLink: z.string().optional().nullable(),
  }).optional(),
  sampleData: z.boolean().optional(),
});

const OBLIGATION_LABELS: Record<ObligationType, string> = {
  rent:        "Alquiler",
  expensas:    "Expensas",
  electricity: "Electricidad",
  gas:         "Gas",
  water:       "Agua",
  internet:    "Internet",
  custom:      "Cargo",
};

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workspaceName, propertyName, propertyAddress, unitIdentifier, tenant, obligation, sampleData } = parsed.data;

  /* Everything in a single transaction */
  const result = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { ownerId: auth.user.id, name: workspaceName },
    });

    const property = await tx.property.create({
      data: { workspaceId: workspace.id, name: propertyName, address: propertyAddress || null },
    });

    const unit = await tx.unit.create({
      data: { propertyId: property.id, identifier: unitIdentifier },
    });

    if (tenant?.fullName) {
      await tx.tenantContact.create({
        data: {
          unitId:   unit.id,
          fullName: tenant.fullName,
          email:    tenant.email || null,
          whatsapp: tenant.whatsapp || null,
        },
      });
    }

    if (obligation) {
      const title = `${OBLIGATION_LABELS[obligation.type]} ${unitIdentifier}`;
      await tx.obligationTemplate.create({
        data: {
          unitId:        unit.id,
          type:          obligation.type,
          title,
          amount:        toPrismaDecimal(obligation.amount),
          currency:      obligation.currency,
          dueDay:        obligation.dueDay,
          providerSlug:  obligation.providerSlug ?? null,
          paymentMethod: obligation.paymentMethod ?? null,
          paymentCbu:    obligation.paymentCbu ?? null,
          paymentName:   obligation.paymentName ?? null,
          paymentMpLink: obligation.paymentMpLink ?? null,
        },
      });
    }

    if (sampleData) {
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;

      await tx.obligation.createMany({
        data: [
          {
            unitId: unit.id,
            type: ObligationType.expensas,
            sourceType: "manual",
            title: `Expensas ${unitIdentifier}`,
            amount: toPrismaDecimal(85000),
            dueDate: new Date(now.getTime() - 3 * oneDay),
            status: "overdue",
            currency: "ARS",
            notes: "Dato de ejemplo",
          },
          {
            unitId: unit.id,
            type: ObligationType.internet,
            sourceType: "manual",
            title: `Internet ${unitIdentifier}`,
            amount: toPrismaDecimal(32000),
            dueDate: new Date(now.getTime() + 2 * oneDay),
            status: "pending",
            currency: "ARS",
            notes: "Dato de ejemplo",
          },
          {
            unitId: unit.id,
            type: obligation?.type ?? ObligationType.rent,
            sourceType: "manual",
            title: `Pago verificado ${unitIdentifier}`,
            amount: toPrismaDecimal(120000),
            dueDate: new Date(now.getTime() - 8 * oneDay),
            status: "verified",
            currency: obligation?.currency ?? "ARS",
            notes: "Dato de ejemplo",
          },
        ],
      });
    }

    return { workspaceId: workspace.id, unitId: unit.id };
  });

  return NextResponse.json(result, { status: 201 });
}
