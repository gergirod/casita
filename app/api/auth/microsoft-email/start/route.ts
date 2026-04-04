import { NextRequest, NextResponse } from "next/server";
import { buildMicrosoftAuthUrl, isMicrosoftOAuthConfigured } from "@/lib/microsoft-oauth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!isMicrosoftOAuthConfigured()) {
    return NextResponse.json({ error: "Microsoft OAuth not configured" }, { status: 500 });
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

  const authUrl = buildMicrosoftAuthUrl(workspaceId);
  return NextResponse.redirect(authUrl);
}
