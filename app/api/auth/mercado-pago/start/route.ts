import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

/**
 * GET /api/auth/mercado-pago/start
 * Redirects the owner to Mercado Pago's OAuth authorization page.
 */
export async function GET() {
  const owner = await requireOwner();

  const appId = process.env.MP_APP_ID;
  const redirectBase = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:3000";
  const redirectUri = `${redirectBase}/api/auth/mercado-pago/callback`;

  if (!appId) {
    return NextResponse.json({ error: "Mercado Pago no está configurado en el servidor." }, { status: 500 });
  }

  // state encodes the owner id to verify on callback
  const state = Buffer.from(JSON.stringify({ ownerId: owner.id })).toString("base64url");

  const authUrl = new URL("https://auth.mercadopago.com/authorization");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
