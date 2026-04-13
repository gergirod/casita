import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

/**
 * GET /api/auth/mercado-pago/callback
 * Exchanges the MP authorization code for an access token and stores it at owner level.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirectBase = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:3000";
  const settingsUrl = `${redirectBase}/dashboard/settings`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?mp_error=${error ?? "cancelled"}`);
  }

  // Decode state to get ownerId
  let ownerId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    ownerId = decoded.ownerId;
    if (!ownerId) throw new Error("no ownerId");
  } catch {
    return NextResponse.redirect(`${settingsUrl}?mp_error=invalid_state`);
  }

  const appId = process.env.MP_APP_ID;
  // In Mercado Pago OAuth, the client_secret is the app owner's access token
  const clientSecret = process.env.MP_ACCESS_TOKEN;
  const redirectUri = `${redirectBase}/api/auth/mercado-pago/callback`;

  if (!appId || !clientSecret) {
    return NextResponse.redirect(`${settingsUrl}?mp_error=not_configured`);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: appId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("[mp-oauth] token exchange failed", tokenRes.status, body);
    const errMsg = encodeURIComponent(body.slice(0, 200));
    return NextResponse.redirect(`${settingsUrl}?mp_error=token_exchange_failed&detail=${errMsg}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    user_id: number;
    refresh_token?: string;
  };

  await prisma.ownerProfile.upsert({
    where: { ownerId },
    create: {
      ownerId,
      mpAccessTokenEncrypted: encrypt(tokenData.access_token),
      mpUserId: String(tokenData.user_id),
      mpConnectedAt: new Date(),
    },
    update: {
      mpAccessTokenEncrypted: encrypt(tokenData.access_token),
      mpUserId: String(tokenData.user_id),
      mpConnectedAt: new Date(),
    },
  });

  return NextResponse.redirect(`${settingsUrl}?mp_connected=1`);
}
