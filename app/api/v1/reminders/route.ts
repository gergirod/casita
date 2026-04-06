import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMachineOwner } from "@/lib/machine-auth";
import { sendReminderToTenant } from "@/lib/services/reminders";

const schema = z.object({
  obligationId: z.string().min(1),
});

/**
 * POST /api/v1/reminders
 *
 * Dale action: send_reminder
 * Sends a payment reminder to the tenant for a specific obligation.
 */
export async function POST(req: NextRequest) {
  const ownerId = getMachineOwner(req);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "obligationId is required", code: "invalid_input" }, { status: 400 });
  }

  const result = await sendReminderToTenant({ ownerId, obligationId: parsed.data.obligationId, channel: "api" });

  if (!result.ok) {
    const status = result.code === "not_found" || result.code === "forbidden" ? 404 : 422;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ channels: result.data.channels });
}
