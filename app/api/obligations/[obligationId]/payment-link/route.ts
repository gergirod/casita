import { NextRequest, NextResponse } from "next/server";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildExternalReference, createMercadoPagoPaymentLink } from "@/lib/mercado-pago";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ obligationId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { obligationId } = await context.params;

  const obligation = await prisma.obligation.findFirst({
    where: {
      id: obligationId,
      unit: { property: { workspace: { ownerId: auth.user.id } } },
    },
    include: {
      unit: {
        include: {
          tenantContact: true,
          property: {
            include: {
              workspace: {
                select: {
                  id: true,
                  mpEnabled: true,
                  mpAccessTokenEncrypted: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!obligation) return NextResponse.json({ error: "Obligación no encontrada" }, { status: 404 });

  const ws = obligation.unit.property.workspace;
  if (!ws.mpEnabled || !ws.mpAccessTokenEncrypted) {
    return NextResponse.json({ error: "Mercado Pago no está habilitado en esta casita" }, { status: 422 });
  }

  const externalReference = buildExternalReference(obligation.id);
  const link = await createMercadoPagoPaymentLink(
    {
      enabled: ws.mpEnabled,
      accessTokenEncrypted: ws.mpAccessTokenEncrypted,
    },
    {
      obligationId: obligation.id,
      title: obligation.title,
      amount: Number(obligation.amount),
      externalReference,
      payerEmail: obligation.unit.tenantContact?.email ?? null,
    }
  );

  if (!link.ok) return NextResponse.json({ error: link.error }, { status: 422 });

  await prisma.obligation.update({
    where: { id: obligation.id },
    data: {
      paymentProvider: "mercado_pago",
      paymentExternalRef: externalReference,
      paymentLinkUrl: link.checkoutUrl,
    },
  });

  return NextResponse.json({ ok: true, paymentLinkUrl: link.checkoutUrl });
}
