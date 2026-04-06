import { NextRequest, NextResponse } from "next/server";
import { getMachineOwner } from "@/lib/machine-auth";
import { verifyPayment } from "@/lib/services/obligations";

/**
 * POST /api/v1/obligations/:obligationId/verify
 *
 * Dale action: verify_payment (HITL — Dale requires confirmation before calling this)
 * Marks an obligation as verified (owner confirms payment received).
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ obligationId: string }> },
) {
  const ownerId = getMachineOwner(req);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const { obligationId } = await context.params;

  const result = await verifyPayment({ ownerId, obligationId, channel: "api" });

  if (!result.ok) {
    const status = result.code === "not_found" || result.code === "forbidden" ? 404 : 422;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    obligationId: result.data.obligationId,
    title: result.data.title,
  });
}
