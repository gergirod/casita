import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/tenant/[token]/note
 *
 * Called by n8n when a tenant sends a text message (complaint, question, etc.)
 * Saves it as a custom obligation (sourceType: "n8n") so it appears
 * in the owner's dashboard as a pending item to review.
 *
 * Body: { text: string, category?: "reclamo" | "consulta" | "otro" }
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
    include: { tenantContact: { select: { fullName: true } } },
  });
  if (!unit) return NextResponse.json({ error: "Token inválido" }, { status: 404 });

  const { text, category = "otro" } = await req.json() as {
    text: string;
    category?: "reclamo" | "consulta" | "otro";
  };

  if (!text?.trim()) {
    return NextResponse.json({ error: "text requerido" }, { status: 400 });
  }

  const CATEGORY_LABEL: Record<string, string> = {
    reclamo: "🔧 Reclamo",
    consulta: "❓ Consulta",
    otro: "💬 Mensaje",
  };
  const safeCategory = category in CATEGORY_LABEL ? category : "otro";

  const tenantName = unit.tenantContact?.fullName ?? "Inquilino";
  const title = `${CATEGORY_LABEL[safeCategory]} de ${tenantName}`;

  /* Save as a custom obligation so it appears in the dashboard */
  const note = await prisma.obligation.create({
    data: {
      unitId:     unit.id,
      type:       "custom",
      sourceType: "n8n",
      title,
      notes:      text.trim(),
      amount:     0,
      currency:   "ARS",
      dueDate:    new Date(),
      status:     "pending",
    },
  });

  return NextResponse.json({ ok: true, noteId: note.id, title });
}
