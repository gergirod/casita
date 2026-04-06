import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Machine-to-machine auth for Dale connector integration.
 *
 * Tokens are signed JWTs (HMAC-SHA256) containing { ownerId }.
 * No DB lookup — stateless verification using CASITA_API_SECRET.
 *
 * The credential Dale stores in its vault is a JSON string:
 *   { "token": "<signed-jwt>", "url": "https://casita.app" }
 */

function getSecret(): string {
  const secret = process.env.CASITA_API_SECRET;
  if (!secret) throw new Error("CASITA_API_SECRET is not configured");
  return secret;
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function sign(header: string, payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
}

export interface MachineTokenPayload {
  ownerId: string;
  iat: number;
}

/**
 * Generate a signed JWT for machine-to-machine auth.
 * Called from POST /api/v1/token (requires Supabase session).
 */
export function generateMachineToken(ownerId: string): string {
  const secret = getSecret();
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ ownerId, iat: Math.floor(Date.now() / 1000) }));
  const sig = sign(header, payload, secret);
  return `${header}.${payload}.${sig}`;
}

/**
 * Verify a signed JWT and return the payload, or null if invalid.
 */
export function verifyMachineToken(token: string): MachineTokenPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, receivedSig] = parts;
    const expectedSig = sign(header, payload, secret);

    // Timing-safe comparison to prevent timing attacks
    const received = Buffer.from(receivedSig, "base64url");
    const expected = Buffer.from(expectedSig, "base64url");
    if (received.length !== expected.length) return null;
    if (!timingSafeEqual(received, expected)) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as MachineTokenPayload;
    if (!decoded.ownerId || typeof decoded.ownerId !== "string") return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the Bearer token from an API request.
 * Returns the ownerId if valid, null otherwise.
 *
 * Usage in /api/v1/* routes:
 *   const ownerId = await getMachineOwner(req);
 *   if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export function getMachineOwner(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const payload = verifyMachineToken(token);
  return payload?.ownerId ?? null;
}

/**
 * Generate a random secret suitable for CASITA_API_SECRET.
 * Only used during setup — not called at runtime.
 */
export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}
