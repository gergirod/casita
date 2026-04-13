/*
  WhatsApp adapter — Twilio WhatsApp API (opcional)
  ──────────────────────────────────────────────────
  Si TWILIO_* no están configurados, sendWhatsApp() retorna { skipped }.
  El canal principal de automatización es email (Resend).
  WhatsApp manual funciona siempre via los botones wa.me del dashboard.
*/

export type WhatsAppInput = {
  to:   string;   /* E.164 format, e.g. +5491124720369 */
  body: string;
};

export type WhatsAppResult =
  | { ok: true; sid: string }
  | { skipped: true; reason: string }
  | { error: true; message: string };

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isTwilioConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  );
}

// Twilio sandbox has a 1600-char limit; production WhatsApp API does not.
const TWILIO_MAX_CHARS = 1550;

export async function sendWhatsApp(input: WhatsAppInput): Promise<WhatsAppResult> {
  if (!isTwilioConfigured()) {
    return { skipped: true, reason: "Twilio no configurado" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken  = process.env.TWILIO_AUTH_TOKEN!;
  const rawFrom    = process.env.TWILIO_WHATSAPP_FROM!;
  const from       = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;
  const to         = `whatsapp:+${normalizePhone(input.to)}`;

  const safeBody = input.body.length > TWILIO_MAX_CHARS
    ? input.body.slice(0, TWILIO_MAX_CHARS - 3) + "..."
    : input.body;

  const body = new URLSearchParams({ From: from, To: to, Body: safeBody });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: body.toString(),
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) return { error: true, message: data?.message ?? "Twilio error" };
  return { ok: true, sid: data.sid };
}

/* ── Welcome message builder ─────────────────────────────────── */

export function buildWelcomeMessage(input: {
  tenantName:     string;
  propertyName:   string;
  unitIdentifier: string;
  portalUrl:      string;
  paymentMethod?: string | null;
  paymentCbu?:    string | null;
  paymentName?:   string | null;
  paymentMpLink?: string | null;
}) {
  const name     = input.tenantName;
  const location = `*${input.propertyName} · ${input.unitIdentifier}*`;

  let paymentLine = "";
  if (input.paymentMethod === "cbu" && input.paymentCbu) {
    paymentLine = `\n\n💳 *Datos para el alquiler:*\nCBU / Alias: \`${input.paymentCbu}\`${input.paymentName ? `\nTitular: ${input.paymentName}` : ""}`;
  } else if (input.paymentMethod === "mp_link" && input.paymentCbu) {
    paymentLine = `\n\n💳 *Pagá el alquiler con Mercado Pago:*\nAlias: ${input.paymentCbu}${input.paymentName ? `\nA nombre de: ${input.paymentName}` : ""}`;
  }

  return `Hola ${name}! 🏠 *Ya sos parte de Casita*.\n\nTu propietario te sumó como inquilino de ${location}. Por acá podés:${paymentLine}\n\n✅ Recibir recordatorios de pago\n📎 Subir comprobantes\n🔧 Mandar reclamos o reportar problemas\n📄 Consultar tu contrato\n\nEscribime cuando quieras — estoy acá.\n\n👉 Tu portal:\n${input.portalUrl}`;
}

/* ── Reminder message builder ────────────────────────────────── */

export function buildReminderMessage(input: {
  tenantName:      string | null;
  title:           string;
  amount:          string;
  currency:        string;
  dueDate:         string;        /* ISO */
  daysUntilDue:    number;
  propertyName?:   string;
  unitIdentifier?: string;
  portalUrl?:      string;
  paymentUrl?:     string;        /* MP checkout link — si está, reemplaza el texto de acción */
}) {
  const name     = input.tenantName ?? "Inquilino";
  const date     = new Date(input.dueDate).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  const amt      = input.currency === "USD"
    ? `U$D ${Number(input.amount).toLocaleString("es-AR")}`
    : `$ ${Number(input.amount).toLocaleString("es-AR")}`;
  const location = input.propertyName
    ? ` de *${input.propertyName}${input.unitIdentifier ? ` · ${input.unitIdentifier}` : ""}*`
    : "";

  // Payment action block — MP link takes priority over portal-only message
  let actionBlock = "";
  if (input.paymentUrl && input.portalUrl) {
    actionBlock = `\n\n💳 Pagá por Mercado Pago:\n${input.paymentUrl}\n\nO subí tu comprobante acá:\n${input.portalUrl}`;
  } else if (input.paymentUrl) {
    actionBlock = `\n\n💳 Pagá por Mercado Pago:\n${input.paymentUrl}`;
  } else if (input.portalUrl) {
    actionBlock = `\n\nPodés ver la factura y subir tu comprobante acá:\n${input.portalUrl}`;
  }

  if (input.daysUntilDue <= 0) {
    return `Hola ${name}! 🏠 Te avisamos desde *Casita* que el pago${location} — *${input.title}* (${amt}) — ya está *vencido*.\n\nPor favor regularizá tu situación a la brevedad.${actionBlock}`;
  }
  if (input.daysUntilDue === 1) {
    return `Hola ${name}! 🏠 Recordatorio de *Casita*: el *${input.title}*${location} (${amt}) vence *mañana*, ${date}. ¡No te olvides!${actionBlock}`;
  }
  return `Hola ${name}! 🏠 Recordatorio de *Casita*: el *${input.title}*${location} (${amt}) vence el *${date}* — en ${input.daysUntilDue} días.${actionBlock}`;
}
