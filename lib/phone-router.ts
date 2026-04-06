import { prisma } from "@/lib/prisma";

export type PhoneRoute =
  | { type: "owner"; ownerId: string; phone: string }
  | { type: "tenant"; phone: string }
  | { type: "unknown"; phone: string };

const norm = (s: string) => s.replace(/\D/g, "");

export async function routeByPhone(rawPhone: string): Promise<PhoneRoute> {
  const digits = norm(rawPhone);
  const last10 = digits.slice(-10);

  // Owner lookup is now account-level via OwnerProfile — one phone per owner,
  // independent of how many workspaces they have.
  const ownerProfile = await prisma.ownerProfile.findFirst({
    where: {
      phone: { not: null },
      whatsappEnabled: true,
      OR: [
        { phone: { contains: digits } },
        { phone: { contains: `+${digits}` } },
        ...(last10 ? [{ phone: { contains: last10 } }] : []),
      ],
    },
    select: { ownerId: true, phone: true },
  });

  if (ownerProfile) {
    const profileDigits = norm(ownerProfile.phone ?? "");
    if (profileDigits === digits || profileDigits.endsWith(last10)) {
      return { type: "owner", ownerId: ownerProfile.ownerId, phone: digits };
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
