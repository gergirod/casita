import { NextRequest, NextResponse } from "next/server";
import { getMachineOwner } from "@/lib/machine-auth";
import { getOwnerOverview } from "@/lib/services/owner-queries";

/**
 * GET /api/v1/overview
 *
 * Dale action: get_overview
 * Returns a summary of all workspaces for the owner: names, tenant, pending/overdue counts.
 */
export async function GET(req: NextRequest) {
  const ownerId = getMachineOwner(req);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  try {
    const workspaces = await getOwnerOverview(ownerId);
    return NextResponse.json({ workspaces });
  } catch (err) {
    console.error("[v1/overview] Error:", err);
    return NextResponse.json({ error: "Internal error", code: "internal_error" }, { status: 500 });
  }
}
