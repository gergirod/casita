import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const unit = await prisma.unit.findUnique({
    where: { tenantToken: token },
    include: {
      property: { select: { name: true, address: true } },
      tenantContact: { select: { fullName: true } },
      obligations: {
        where: {
          status: { in: ["pending", "overdue", "upcoming", "reminded"] },
        },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
  }

  return NextResponse.json({
    unit: {
      id: unit.id,
      identifier: unit.identifier,
      property: unit.property,
      tenantName: unit.tenantContact?.fullName ?? null,
      obligations: unit.obligations.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        status: o.status,
        amount: o.amount.toString(),
        dueDate: o.dueDate.toISOString(),
        paymentLinkUrl: o.paymentLinkUrl ?? null,
      })),
    },
  });
}
