import { NextRequest, NextResponse } from "next/server";
import { buildMicrosoftAuthUrl, isMicrosoftOAuthConfigured } from "@/lib/microsoft-oauth";
import { getOwnerFromRequest } from "@/lib/api-auth";

/**
 * GET /api/auth/microsoft-email/start
 *
 * Initiates the Microsoft OAuth2 flow.
 * Accepts `ownerId` query param (from bot link) or reads from session (from dashboard).
 * Email connection is account-level, not per workspace.
 */
export async function GET(req: NextRequest) {
  if (!isMicrosoftOAuthConfigured()) {
    return NextResponse.json({ error: "Microsoft OAuth not configured" }, { status: 500 });
  }

  let ownerId = req.nextUrl.searchParams.get("ownerId");

  if (!ownerId) {
    const auth = await getOwnerFromRequest();
    if (auth.response) {
      return NextResponse.json({ error: "ownerId is required" }, { status: 400 });
    }
    ownerId = auth.user.id;
  }

  const authUrl = buildMicrosoftAuthUrl(ownerId);
  return NextResponse.redirect(authUrl);
}
