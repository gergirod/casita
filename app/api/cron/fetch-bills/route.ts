/*
  Cron semanal (configurable en vercel.json).
  Para cada owner con email conectado:
    1. Busca todos sus workspaces
    2. Para cada workspace con templates auto_email, conecta IMAP y busca facturas
    3. Extrae datos con Gemini, crea/actualiza obligaciones, notifica al inquilino
*/

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchBillsForWorkspace } from "@/lib/mail-fetcher";

export const maxDuration = 300; /* Vercel Pro max */

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /* Find all owners with email connected (account-level config) */
  const profiles = await prisma.ownerProfile.findMany({
    where: { emailAddress: { not: null } },
    select: { ownerId: true },
  });

  /* Get all workspaces for those owners */
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: { in: profiles.map((p) => p.ownerId) } },
    select: { id: true, name: true },
  });

  const results: {
    workspaceId: string;
    name: string;
    processed: number;
    skipped: number;
    errors: string[];
  }[] = [];

  for (const ws of workspaces) {
    try {
      const result = await fetchBillsForWorkspace(ws.id);
      results.push({ workspaceId: ws.id, name: ws.name, ...result });
    } catch (err) {
      results.push({
        workspaceId: ws.id,
        name:        ws.name,
        processed:   0,
        skipped:     0,
        errors:      [err instanceof Error ? err.message : "error desconocido"],
      });
    }
  }

  return NextResponse.json({ ok: true, ran: new Date().toISOString(), results });
}
