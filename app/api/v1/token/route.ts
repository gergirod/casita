import { NextResponse } from "next/server";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { generateMachineToken } from "@/lib/machine-auth";

/**
 * POST /api/v1/token
 *
 * Generates a machine-to-machine JWT for the Dale connector.
 * Requires a valid Supabase session (owner must be logged in to the dashboard).
 *
 * The owner copies this token and configures it in Dale's credential vault as:
 *   { "token": "<jwt>", "url": "https://casita.app" }
 */
export async function POST() {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const token = generateMachineToken(auth.user.id);

  return NextResponse.json({
    token,
    hint: 'Store in Dale vault as: { "token": "<value>", "url": "https://your-casita-url.com" }',
  });
}
