import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

const schema = z.object({
  accessToken: z.string().min(10),
});

/**
 * POST /api/owner/mercado-pago/connect
 *
 * Stores the owner's MP access token at account level (applies to all casitas).
 * Mirrors how email connection works — one token for everything.
 */
export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { accessToken } = parsed.data;

  // Verify the token works before saving
  const verifyRes = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyRes.ok) {
    return NextResponse.json(
      { error: "Access token inválido. Verificá que copiaste el token correcto de Mercado Pago." },
      { status: 422 }
    );
  }
  const mpUser = (await verifyRes.json()) as { id: number; email: string };

  await prisma.ownerProfile.upsert({
    where: { ownerId: auth.user.id },
    create: {
      ownerId: auth.user.id,
      mpAccessTokenEncrypted: encrypt(accessToken),
      mpUserId: String(mpUser.id),
      mpConnectedAt: new Date(),
    },
    update: {
      mpAccessTokenEncrypted: encrypt(accessToken),
      mpUserId: String(mpUser.id),
      mpConnectedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, mpUserId: mpUser.id, email: mpUser.email });
}

/**
 * DELETE /api/owner/mercado-pago/connect
 * Desconecta Mercado Pago a nivel cuenta.
 */
export async function DELETE() {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  await prisma.ownerProfile.upsert({
    where: { ownerId: auth.user.id },
    create: { ownerId: auth.user.id },
    update: {
      mpAccessTokenEncrypted: null,
      mpUserId: null,
      mpConnectedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
