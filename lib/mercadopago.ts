/**
 * lib/mercadopago.ts
 *
 * Thin wrapper over the Mercado Pago REST API.
 * Supports creating payment preferences (Checkout Pro) using either:
 *   - a per-workspace encrypted token (from mpAccessTokenEncrypted)
 *   - the global MP_ACCESS_TOKEN env var as fallback
 */

import { decrypt } from "@/lib/encrypt";

const MP_API = "https://api.mercadopago.com";

export type MpPaymentItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

export type CreatePreferenceInput = {
  items: MpPaymentItem[];
  external_reference: string;   // obligationId — used for webhook reconciliation
  notification_url?: string;    // Vercel webhook URL
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
};

export type MpPreference = {
  id: string;
  init_point: string;          // live checkout URL
  sandbox_init_point: string;  // test checkout URL
};

/**
 * Resolve the access token to use.
 * Priority: per-workspace encrypted token > global env var.
 */
export function resolveAccessToken(encryptedToken?: string | null): string {
  if (encryptedToken) {
    try {
      return decrypt(encryptedToken);
    } catch {
      // Fall through to env var
    }
  }
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN not configured");
  return token;
}

/**
 * Create a Checkout Pro payment preference.
 * Returns the preference id and the hosted checkout URL.
 */
export async function createPaymentPreference(
  input: CreatePreferenceInput,
  accessToken: string,
): Promise<MpPreference> {
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MP createPreference failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<MpPreference>;
}

/**
 * Verify a payment by its ID.
 * Used for manual reconciliation or webhook verification.
 */
export async function getPayment(paymentId: string, accessToken: string) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MP getPayment failed (${res.status})`);
  return res.json();
}

export function isMpConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN || process.env.MP_APP_ID);
}
