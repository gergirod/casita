import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { transitionObligationStatus } from "@/lib/services/obligations";

const statusSchema = z.object({
  status: z.enum([
    "upcoming", "pending", "reminded",
    "proof_uploaded", "overdue", "verified", "cancelled",
  ]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ obligationId: string }> }
) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const { obligationId } = await context.params;
  const body = await request.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await transitionObligationStatus({
    ownerId: auth.user.id,
    obligationId,
    newStatus: parsed.data.status,
    channel: "dashboard",
  });

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    obligation: {
      id: result.data.obligationId,
      previousStatus: result.data.previousStatus,
      status: result.data.newStatus,
    },
  });
}
