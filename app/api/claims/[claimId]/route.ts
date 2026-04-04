import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { z } from "zod";
import { updateClaimStatus } from "@/lib/services/claims";

const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const owner = await requireOwner();
  const { claimId } = await params;

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const result = await updateClaimStatus({
    claimId,
    newStatus: body.data.status,
    ownerId: owner.id,
    channel: "dashboard",
  });

  if (!result.ok) {
    const status = result.code === "not_found" || result.code === "forbidden" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, claim: { id: result.data.claimId, status: result.data.status } });
}
