import { NextResponse } from "next/server";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/owner/email
 * Disconnects the owner's email connection at account level.
 */
export async function DELETE() {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  await prisma.ownerProfile.upsert({
    where: { ownerId: auth.user.id },
    create: { ownerId: auth.user.id },
    update: {
      emailProvider: null,
      emailAddress: null,
      emailEncryptedPassword: null,
      emailRefreshToken: null,
      imapHost: null,
      imapPort: null,
      emailConnectedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
