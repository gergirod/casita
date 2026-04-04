/*
  Cron semanal (configurable en vercel.json).
  Para cada workspace con email conectado:
    1. Conecta por IMAP
    2. Busca emails de proveedores configurados
    3. Extrae datos con Gemini
    4. Crea/actualiza obligaciones
    5. Notifica al inquilino
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

  /* Find all workspaces with email connected */
  const workspaces = await prisma.workspace.findMany({
    where:  { emailAddress: { not: null }, emailEncryptedPassword: { not: null } },
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
