import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tenant-by-phone?number=+5491124720369
 *
 * Called by n8n when a WhatsApp message arrives.
 * Twilio sends the number as "whatsapp:+5491124720369" — we strip the prefix.
 *
 * Returns the tenant's token, name, property, and active obligations
 * so the n8n/OpenAI agent has full context to respond intelligently.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-casita-secret");
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("number") ?? "";
  const normalizedIncoming = normalizePhone(raw);

  if (!normalizedIncoming) {
    return NextResponse.json({ error: "number requerido" }, { status: 400 });
  }

  const fallbackLast10 = normalizedIncoming.slice(-10);
  const contacts = await prisma.tenantContact.findMany({
    where: {
      whatsapp: { not: null },
      OR: [
        { whatsapp: { contains: normalizedIncoming } },
        { whatsapp: { contains: `+${normalizedIncoming}` } },
        ...(fallbackLast10 ? [{ whatsapp: { contains: fallbackLast10 } }] : []),
      ],
    },
    include: {
      unit: {
        include: {
          property: { select: { name: true, address: true } },
          obligations: {
            where: { status: { in: ["pending", "overdue", "upcoming", "reminded"] } },
            orderBy: { dueDate: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              amount: true,
              currency: true,
              dueDate: true,
              originalBillUrl: true,
            },
          },
        },
      },
    },
  });

  const contact =
    contacts.find((c) => normalizePhone(c.whatsapp ?? "") === normalizedIncoming) ??
    contacts.find((c) => normalizePhone(c.whatsapp ?? "").endsWith(fallbackLast10));

  if (!contact) {
    return NextResponse.json({ error: "Número no registrado en Casita" }, { status: 404 });
  }

  const unit = contact.unit;

  return NextResponse.json({
    found: true,
    tenant: {
      name:     contact.fullName,
      whatsapp: contact.whatsapp,
      email:    contact.email,
    },
    unit: {
      id:         unit.id,
      token:      unit.tenantToken,
      property:   unit.property.name,
      address:    unit.property.address ?? null,
      identifier: unit.identifier !== "principal" ? unit.identifier : null,
    },
    obligations: unit.obligations.map((o) => ({
      id:       o.id,
      title:    o.title,
      type:     o.type,
      status:   o.status,
      amount:   o.amount.toString(),
      currency: o.currency,
      dueDate:  o.dueDate.toISOString().slice(0, 10),
      hasBill:  !!o.originalBillUrl,
    })),
  });
}

function normalizePhone(input: string) {
  const plain = input.replace(/^whatsapp:/i, "").trim();
  let digits = plain.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}
