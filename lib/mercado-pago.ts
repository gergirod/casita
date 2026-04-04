import { decrypt } from "@/lib/encrypt";

export type MercadoPagoConnection = {
  enabled: boolean;
  accessTokenEncrypted: string | null;
};

export type PaymentLinkInput = {
  obligationId: string;
  title: string;
  amount: number;
  externalReference: string;
  payerEmail?: string | null;
};

export type PaymentLinkResult =
  | { ok: true; checkoutUrl: string; externalReference: string }
  | { ok: false; error: string };

function getAccessToken(connection: MercadoPagoConnection): string | null {
  if (!connection.enabled || !connection.accessTokenEncrypted) return null;
  try {
    return decrypt(connection.accessTokenEncrypted);
  } catch {
    return null;
  }
}

export function buildExternalReference(obligationId: string): string {
  return `obligation:${obligationId}`;
}

export function parseExternalReference(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("obligation:")) return null;
  const id = raw.slice("obligation:".length);
  return id || null;
}

export async function createMercadoPagoPaymentLink(
  connection: MercadoPagoConnection,
  input: PaymentLinkInput
): Promise<PaymentLinkResult> {
  const accessToken = getAccessToken(connection);
  if (!accessToken) {
    return { ok: false, error: "Mercado Pago no configurado" };
  }

  const body = {
    items: [
      {
        title: input.title,
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(input.amount),
      },
    ],
    external_reference: input.externalReference,
    payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    metadata: { obligationId: input.obligationId },
    notification_url: process.env.MP_WEBHOOK_URL || undefined,
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: json?.message ?? "No se pudo crear link de pago" };
  }

  const checkoutUrl = json?.init_point || json?.sandbox_init_point;
  if (!checkoutUrl) {
    return { ok: false, error: "Mercado Pago no devolvió URL de pago" };
  }

  return { ok: true, checkoutUrl, externalReference: input.externalReference };
}

export async function fetchMercadoPagoPaymentById(connection: MercadoPagoConnection, paymentId: string) {
  const accessToken = getAccessToken(connection);
  if (!accessToken) return { ok: false as const, error: "Mercado Pago no configurado" };

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return { ok: false as const, error: json?.message ?? "No se pudo consultar pago" };
  return { ok: true as const, data: json };
}
