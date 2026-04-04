import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markProofReceived } from "@/lib/services/obligations";

/**
 * POST /api/tenant/[token]/proof-url
 *
 * Called by n8n after identifying a proof-of-payment image from WhatsApp.
 * Instead of a file upload, accepts a Twilio media URL + obligationId.
 * Downloads the file server-side and stores it in Supabase.
 *
 * Body: { obligationId: string, mediaUrl: string, contentType?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const secret = req.headers.get("x-casita-secret");
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;

  const unit = await prisma.unit.findUnique({
    where: { tenantToken: token },
    include: {
      property: {
        select: { name: true, workspace: { select: { id: true, ownerId: true } } },
      },
      tenantContact: { select: { id: true, fullName: true } },
    },
  });

  if (!unit) return NextResponse.json({ error: "Token inválido" }, { status: 404 });

  const { obligationId, mediaUrl, contentType } = await req.json() as {
    obligationId: string;
    mediaUrl: string;
    contentType?: string;
  };

  if (!obligationId || !mediaUrl) {
    return NextResponse.json({ error: "obligationId y mediaUrl son requeridos" }, { status: 400 });
  }

  if (!isAllowedTwilioMediaUrl(mediaUrl)) {
    return NextResponse.json({ error: "mediaUrl inválida (debe ser Twilio)" }, { status: 400 });
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ error: "Credenciales de Twilio faltantes" }, { status: 500 });
  }

  // Download from Twilio — channel-specific, stays in route
  const twilioAuth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const mediaRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${twilioAuth}` } });
  if (!mediaRes.ok) {
    return NextResponse.json({ error: "No se pudo descargar el archivo de Twilio" }, { status: 502 });
  }

  const mimeType = contentType ?? mediaRes.headers.get("content-type") ?? "image/jpeg";
  const fileBuffer = Buffer.from(await mediaRes.arrayBuffer());

  const result = await markProofReceived({
    unitId: unit.id,
    obligationId,
    fileBuffer,
    mimeType,
    workspaceId: unit.property.workspace.id,
    actorType: "tenant",
    actorId: unit.tenantContact?.id ?? unit.id,
    channel: "webhook",
    ownerNotification: {
      ownerId: unit.property.workspace.ownerId,
      tenantName: unit.tenantContact?.fullName ?? null,
      propertyName: unit.property.name,
      unitIdentifier: unit.identifier,
    },
  });

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, proofUrl: result.data.proofUrl });
}

function isAllowedTwilioMediaUrl(input: string) {
  try {
    const parsed = new URL(input);
    const host = parsed.hostname.toLowerCase();
    return host.endsWith("twilio.com") || host.endsWith("twiliocdn.com");
  } catch {
    return false;
  }
}
