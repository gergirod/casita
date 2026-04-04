import { prisma } from "@/lib/prisma";

export type PhoneRoute =
  | { type: "owner"; ownerId: string; phone: string }
  | { type: "tenant"; phone: string }
  | { type: "unknown"; phone: string };

const norm = (s: string) => s.replace(/\D/g, "");

export async function routeByPhone(rawPhone: string): Promise<PhoneRoute> {
  const digits = norm(rawPhone);
  const last10 = digits.slice(-10);

  const ownerWs = await prisma.workspace.findFirst({
    where: {
      ownerPhone: { not: null },
      OR: [
        { ownerPhone: { contains: digits } },
        { ownerPhone: { contains: `+${digits}` } },
        ...(last10 ? [{ ownerPhone: { contains: last10 } }] : []),
      ],
    },
    select: { ownerId: true, ownerPhone: true },
  });

  if (ownerWs) {
    const wsDigits = norm(ownerWs.ownerPhone ?? "");
    if (wsDigits === digits || wsDigits.endsWith(last10)) {
      return { type: "owner", ownerId: ownerWs.ownerId, phone: digits };
    }
  }

  const contact = await prisma.tenantContact.findFirst({
    where: {
      whatsapp: { not: null },
      OR: [
        { whatsapp: { contains: digits } },
        { whatsapp: { contains: `+${digits}` } },
        ...(last10 ? [{ whatsapp: { contains: last10 } }] : []),
      ],
    },
    select: { whatsapp: true },
  });

  if (contact) {
    const cDigits = norm(contact.whatsapp ?? "");
    if (cDigits === digits || cDigits.endsWith(last10)) {
      return { type: "tenant", phone: digits };
    }
  }

  return { type: "unknown", phone: digits };
}
