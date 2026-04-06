import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMachineOwner } from "@/lib/machine-auth";
import { registerTenant } from "@/lib/services/rentals";

const schema = z.object({
  workspaceId: z.string().min(1),
  tenantName: z.string().min(1),
  tenantEmail: z.string().email().optional(),
  tenantWhatsapp: z.string().optional(),
  leaseEndDate: z.string().optional(),
});

/**
 * POST /api/v1/tenants
 *
 * Dale action: register_tenant (HITL — Dale requires confirmation before calling this)
 * Registers a new tenant for an existing workspace.
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

  const result = await registerTenant({ ownerId, ...parsed.data });

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 422;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ unitId: result.data.unitId }, { status: 201 });
}
