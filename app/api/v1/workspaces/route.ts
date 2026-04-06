import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMachineOwner } from "@/lib/machine-auth";
import { createWorkspace } from "@/lib/services/rentals";

const schema = z.object({
  name: z.string().min(1),
  payment: z.object({
    method: z.enum(["cbu", "mp_link"]),
    cbu: z.string().optional(),
    holderName: z.string().optional(),
    mpLink: z.string().optional(),
  }),
  tenant: z.object({
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    whatsapp: z.string().optional(),
  }).optional(),
  rent: z.object({
    amount: z.number().positive(),
    currency: z.string().optional(),
    dueDay: z.number().int().min(1).max(31),
  }).optional(),
});

/**
 * POST /api/v1/workspaces
 *
 * Dale action: create_casita (HITL — Dale requires confirmation before calling this)
 * Creates a new workspace (casita) with optional tenant and rent template.
 */
export async function POST(req: NextRequest) {
  const ownerId = getMachineOwner(req);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", code: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createWorkspace({ ownerId, ...parsed.data });

  if (!result.ok) {
    const status = result.code === "missing_field" || result.code === "invalid_input" ? 400 : 422;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ workspaceId: result.data.workspaceId, unitId: result.data.unitId }, { status: 201 });
}
