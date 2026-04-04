import { NextRequest, NextResponse } from "next/server";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import { sendWhatsApp, buildWelcomeMessage } from "@/lib/whatsapp";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { unitId } = await params;

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      property: { workspace: { ownerId: auth.user.id } },
    },
    include: {
      tenantContact: true,
      property: { select: { name: true } },
      obligationTemplates: {
        where: { type: "rent", isActive: true },
        select: { paymentMethod: true, paymentCbu: true, paymentName: true, paymentMpLink: true },
      },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const contact = unit.tenantContact;
  if (!contact?.email && !contact?.whatsapp) {
    return NextResponse.json({ error: "El inquilino no tiene email ni WhatsApp registrado" }, { status: 400 });
  }

  if (contact.welcomeSentAt) {
    return NextResponse.json({ error: "El mensaje de bienvenida ya fue enviado" }, { status: 409 });
  }

  const rentTemplate = unit.obligationTemplates[0] ?? null;
  const paymentArgs = {
    paymentMethod:  rentTemplate?.paymentMethod ?? null,
    paymentCbu:     rentTemplate?.paymentCbu ?? null,
    paymentName:    rentTemplate?.paymentName ?? null,
    paymentMpLink:  rentTemplate?.paymentMpLink ?? null,
  };

  const portalUrl = `${APP_URL}/t/${unit.tenantToken}`;
  const channels: string[] = [];

  /* ── Email ── */
  if (contact.email) {
    await sendWelcomeEmail({
      to: contact.email,
      tenantName: contact.fullName,
      propertyName: unit.property.name,
      unitIdentifier: unit.identifier,
      tenantToken: unit.tenantToken,
      ...paymentArgs,
    });
    channels.push("email");
  }

  /* ── WhatsApp (optional — skips silently if Twilio not configured) ── */
  if (contact.whatsapp) {
    const body = buildWelcomeMessage({
      tenantName:     contact.fullName,
      propertyName:   unit.property.name,
      unitIdentifier: unit.identifier,
      portalUrl,
      ...paymentArgs,
    });
    await sendWhatsApp({ to: contact.whatsapp, body });
    channels.push("whatsapp");
  }

  await prisma.tenantContact.update({
    where: { id: contact.id },
    data: { welcomeSentAt: new Date() },
  });

  return NextResponse.json({ ok: true, channels });
}
