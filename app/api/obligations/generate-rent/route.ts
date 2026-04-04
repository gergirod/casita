import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { generateMonthlyRentObligationsForOwner } from "@/lib/obligations";

const generateSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12)
  })
  .optional();

export async function POST(request: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const referenceDate = parsed.data
    ? new Date(Date.UTC(parsed.data.year, parsed.data.month - 1, 1))
    : new Date();

  const result = await generateMonthlyRentObligationsForOwner({
    ownerId: auth.user.id,
    referenceDate
  });

  return NextResponse.json(result, { status: 201 });
}
