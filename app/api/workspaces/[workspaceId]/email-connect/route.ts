import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";
import { testImapConnection } from "@/lib/mail-fetcher";

const schema = z.object({
  emailProvider: z.enum(["gmail", "outlook", "yahoo", "imap"]),
  emailAddress:  z.string().email(),
  password:      z.string().min(1),       /* app password — se cifra antes de guardar */
  imapHost:      z.string().optional(),   /* solo para "imap" custom */
  imapPort:      z.number().int().optional(),
  testOnly:      z.boolean().optional(),  /* true → solo testea, no guarda */
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { workspaceId } = await context.params;

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: auth.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body   = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { emailProvider, emailAddress, password, imapHost, imapPort, testOnly } = parsed.data;

  /* Test IMAP connection first */
  const encryptedPassword = encrypt(password);
  const testResult = await testImapConnection({
    emailProvider,
    emailAddress,
    emailEncryptedPassword: encryptedPassword,
    imapHost: imapHost ?? null,
    imapPort: imapPort ?? null,
  });

  if (!testResult.ok) {
    return NextResponse.json(
      { error: `No se pudo conectar: ${testResult.error}` },
      { status: 422 }
    );
  }

  if (testOnly) {
    return NextResponse.json({ ok: true, message: "Conexión exitosa" });
  }

  /* Save encrypted credentials */
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      emailProvider,
      emailAddress,
      emailEncryptedPassword: encryptedPassword,
      imapHost: imapHost ?? null,
      imapPort: imapPort ?? null,
      emailConnectedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { workspaceId } = await context.params;

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: auth.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      emailProvider: null, emailAddress: null,
      emailEncryptedPassword: null, emailRefreshToken: null,
      imapHost: null, imapPort: null, emailConnectedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
