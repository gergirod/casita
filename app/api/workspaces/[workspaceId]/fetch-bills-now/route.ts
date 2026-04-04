import { NextResponse } from "next/server";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { fetchBillsForWorkspace } from "@/lib/mail-fetcher";

export async function POST(
  _request: Request,
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

  const result = await fetchBillsForWorkspace(workspaceId);
  return NextResponse.json({ ok: true, ...result });
}
