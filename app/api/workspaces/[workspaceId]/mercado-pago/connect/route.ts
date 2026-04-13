import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

const schema = z.object({
  accessToken: z.string().min(10),
  publicKey: z.string().optional(),
});

/**
 * POST /api/workspaces/[workspaceId]/mercado-pago/connect
 *
 * Stores the owner's MP access token (encrypted) and enables MP for the workspace.
 * Called from the dashboard settings or bot "conectar mercado pago" command.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { workspaceId } = await context.params;

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: auth.user.id },
    select: { id: true },
  });
  if (!ws) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { accessToken, publicKey } = parsed.data;

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
  const mpUser = await verifyRes.json() as { id: number; email: string };

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      mpEnabled: true,
      mpAccessTokenEncrypted: encrypt(accessToken),
      mpPublicKey: publicKey ?? null,
      mpUserId: String(mpUser.id),
    },
  });

  return NextResponse.json({ ok: true, mpUserId: mpUser.id, email: mpUser.email });
}

/**
 * DELETE /api/workspaces/[workspaceId]/mercado-pago/connect
 * Desconecta Mercado Pago del workspace.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { workspaceId } = await context.params;

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: auth.user.id },
    select: { id: true },
  });
  if (!ws) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      mpEnabled: false,
      mpAccessTokenEncrypted: null,
      mpPublicKey: null,
      mpUserId: null,
    },
  });

  return NextResponse.json({ ok: true });
}
