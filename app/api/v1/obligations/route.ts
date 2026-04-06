import { NextRequest, NextResponse } from "next/server";
import { getMachineOwner } from "@/lib/machine-auth";
import { getOwnerObligations } from "@/lib/services/owner-queries";

/**
 * GET /api/v1/obligations?workspaceId=xxx&filter=pending
 *
 * Dale action: get_obligations
 * Returns obligations for a workspace. Optional filter: all | pending | overdue | proof_uploaded
 */
export async function GET(req: NextRequest) {
  const ownerId = getMachineOwner(req);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required", code: "invalid_input" }, { status: 400 });
  }

  try {
    const obligations = await getOwnerObligations(ownerId, workspaceId, filter);
    return NextResponse.json({ obligations });
  } catch (err) {
    console.error("[v1/obligations] Error:", err);
    return NextResponse.json({ error: "Internal error", code: "internal_error" }, { status: 500 });
  }
}
