import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/google-email/start?workspaceId=xxx
 *
 * Initiates the Google OAuth2 flow.
 * The owner clicks this link (sent via WhatsApp) and gets redirected to Google.
 */
export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const authUrl = buildGoogleAuthUrl(workspaceId);
  return NextResponse.redirect(authUrl);
}
