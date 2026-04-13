import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { getOwnerFromRequest } from "@/lib/api-auth";

/**
 * GET /api/auth/google-email/start
 *
 * Initiates the Google OAuth2 flow.
 * Accepts `ownerId` query param (from bot link) or reads from session (from dashboard).
 * Email connection is account-level, not per workspace.
 */
export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  /* Bot sends ?ownerId=xxx; dashboard uses session */
  let ownerId = req.nextUrl.searchParams.get("ownerId");

  if (!ownerId) {
    /* Try session auth (dashboard button) */
    const auth = await getOwnerFromRequest();
    if (auth.response) {
      return NextResponse.json({ error: "ownerId is required" }, { status: 400 });
    }
    ownerId = auth.user.id;
  }

  const authUrl = buildGoogleAuthUrl(ownerId);
  return NextResponse.redirect(authUrl);
}
