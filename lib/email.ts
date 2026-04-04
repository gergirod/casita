import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? "placeholder");
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Casita <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatAmount(amount: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/* ─── Base HTML wrapper ─────────────────────────────────── */
function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f9f7;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #c8dbd2;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#deeee7;padding:20px 28px;border-bottom:1px solid #c8dbd2;">
              <span style="font-size:18px;font-weight:800;color:#1a2e24;letter-spacing:-0.03em;">casita</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e8f0ec;background:#f5f9f7;">
              <p style="margin:0;font-size:12px;color:#9ab5a8;">Casita · Gestión de alquileres</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ─── Email types ───────────────────────────────────────── */

export type ReminderEmailInput = {
  to: string;
  tenantName: string;
  title: string;
  amount: string;
  dueDate: string;
  tenantToken: string;
  propertyName: string;
  unitIdentifier: string;
  daysUntilDue?: number;
};

/* Due soon — N days before */
export async function sendDueSoonEmail(input: ReminderEmailInput) {
  const days = input.daysUntilDue ?? 3;
  const uploadUrl = `${APP_URL}/t/${input.tenantToken}`;
  const html = baseHtml(`
    <p style="margin:0 0 8px;font-size:14px;color:#4a6a58;">Hola${input.tenantName ? `, ${input.tenantName}` : ""},</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#1a2e24;line-height:1.2;">
      Tenés un pago que vence en ${days} día${days === 1 ? "" : "s"}
    </h1>
    ${obligationCard(input)}
    <p style="margin:20px 0 8px;font-size:14px;color:#4a6a58;">
      Cuando lo abones, subí el comprobante desde acá:
    </p>
    <a href="${uploadUrl}" style="display:inline-block;padding:12px 20px;background:#3d6b54;color:#fff;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">
      Subir comprobante →
    </a>
  `);

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `Recordatorio: ${input.title} vence en ${days} día${days === 1 ? "" : "s"}`,
    html,
  });
}

/* Due today */
export async function sendDueTodayEmail(input: ReminderEmailInput) {
  const uploadUrl = `${APP_URL}/t/${input.tenantToken}`;
  const html = baseHtml(`
    <p style="margin:0 0 8px;font-size:14px;color:#4a6a58;">Hola${input.tenantName ? `, ${input.tenantName}` : ""},</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#1a2e24;line-height:1.2;">
      Hoy vence tu pago
    </h1>
    ${obligationCard(input)}
    <p style="margin:20px 0 8px;font-size:14px;color:#4a6a58;">
      Cuando lo abones, subí el comprobante para que el propietario lo verifique:
    </p>
    <a href="${uploadUrl}" style="display:inline-block;padding:12px 20px;background:#3d6b54;color:#fff;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">
      Subir comprobante →
    </a>
  `);

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `Hoy vence: ${input.title}`,
    html,
  });
}

/* Overdue */
export async function sendOverdueEmail(input: ReminderEmailInput) {
  const uploadUrl = `${APP_URL}/t/${input.tenantToken}`;
  const html = baseHtml(`
    <p style="margin:0 0 8px;font-size:14px;color:#4a6a58;">Hola${input.tenantName ? `, ${input.tenantName}` : ""},</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#b0405a;line-height:1.2;">
      Tenés un pago vencido
    </h1>
    ${obligationCard(input, true)}
    <p style="margin:20px 0 8px;font-size:14px;color:#4a6a58;">
      Si ya lo abonaste, subí el comprobante para regularizar:
    </p>
    <a href="${uploadUrl}" style="display:inline-block;padding:12px 20px;background:#3d6b54;color:#fff;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">
      Subir comprobante →
    </a>
  `);

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `Pago vencido: ${input.title}`,
    html,
  });
}

/* Owner — proof uploaded notification */
export async function sendProofUploadedEmail(input: {
  ownerEmail: string;
  tenantName: string | null;
  title: string;
  amount: string;
  dueDate: string;
  propertyName: string;
  unitIdentifier: string;
  workspaceId: string;
}) {
  const dashUrl = `${APP_URL}/dashboard/${input.workspaceId}`;
  const html = baseHtml(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a2e24;line-height:1.2;">
      Comprobante subido para verificar
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#4a6a58;">
      ${input.tenantName ?? "El inquilino"} subió un comprobante de pago.
    </p>
    ${obligationCard(input)}
    <p style="margin:20px 0 8px;font-size:14px;color:#4a6a58;">
      Revisá el comprobante y confirmá el pago desde el panel:
    </p>
    <a href="${dashUrl}" style="display:inline-block;padding:12px 20px;background:#3d6b54;color:#fff;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">
      Ir al panel →
    </a>
  `);

  return getResend().emails.send({
    from: FROM,
    to: input.ownerEmail,
    subject: `Comprobante a verificar: ${input.title}`,
    html,
  });
}

/* Bill notification — tenant receives bill + upload link */
export async function sendBillNotificationEmail(input: ReminderEmailInput & {
  originalBillUrl: string;
}) {
  const uploadUrl = `${APP_URL}/t/${input.tenantToken}`;
  const html = baseHtml(`
    <p style="margin:0 0 8px;font-size:14px;color:#4a6a58;">Hola${input.tenantName ? `, ${input.tenantName}` : ""},</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#1a2e24;line-height:1.2;">
      Te llegó una nueva factura
    </h1>
    ${obligationCard(input)}
    <p style="margin:20px 0 12px;font-size:14px;color:#4a6a58;">
      Podés ver la factura original acá:
    </p>
    <a href="${input.originalBillUrl}" style="display:inline-block;margin-bottom:16px;padding:10px 18px;background:#f5f9f7;color:#3d6b54;border:1px solid #c8dbd2;border-radius:10px;font-weight:600;font-size:13px;text-decoration:none;">
      📄 Ver factura →
    </a>
    <p style="margin:0 0 8px;font-size:14px;color:#4a6a58;">
      Cuando la abones, subí el comprobante desde acá:
    </p>
    <a href="${uploadUrl}" style="display:inline-block;padding:12px 20px;background:#3d6b54;color:#fff;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">
      Subir comprobante →
    </a>
  `);

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `Nueva factura: ${input.title} — ${formatAmount(input.amount)}`,
    html,
  });
}

/* ─── Shared card ───────────────────────────────────────── */
function obligationCard(
  input: { title: string; amount: string; dueDate: string; propertyName: string; unitIdentifier: string },
  danger = false
) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:${danger ? "#fdeef3" : "#f5f9f7"};border:1px solid ${danger ? "#f5c0d0" : "#c8dbd2"};border-radius:10px;margin-bottom:4px;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 4px;font-weight:700;color:#1a2e24;font-size:15px;">${input.title}</p>
          <p style="margin:0;font-size:13px;color:#7a9e8c;">${input.propertyName} · ${input.unitIdentifier}</p>
          <p style="margin:8px 0 0;font-size:20px;font-weight:800;color:${danger ? "#b0405a" : "#1a2e24"};">
            ${formatAmount(input.amount)}
          </p>
          <p style="margin:2px 0 0;font-size:12px;color:#9ab5a8;">Vence ${formatDate(input.dueDate)}</p>
        </td>
      </tr>
    </table>`;
}

/* Welcome message — sent once when a new tenant is added */
export async function sendWelcomeEmail(input: {
  to: string;
  tenantName: string;
  propertyName: string;
  unitIdentifier: string;
  tenantToken: string;
  paymentMethod?: string | null;
  paymentCbu?: string | null;
  paymentName?: string | null;
  paymentMpLink?: string | null;
}) {
  const portalUrl = `${APP_URL}/t/${input.tenantToken}`;

  let paymentBlock = "";
  if (input.paymentMethod === "cbu" && input.paymentCbu) {
    paymentBlock = `
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f0faf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 4px;font-weight:700;color:#1a2e24;font-size:14px;">Datos para transferir el alquiler</p>
          <p style="margin:6px 0 2px;font-size:13px;color:#4a6a58;"><strong>CBU / Alias:</strong> ${input.paymentCbu}</p>
          ${input.paymentName ? `<p style="margin:2px 0 0;font-size:13px;color:#4a6a58;"><strong>Titular:</strong> ${input.paymentName}</p>` : ""}
        </td>
      </tr>
    </table>`;
  } else if (input.paymentMethod === "mp_link" && input.paymentCbu) {
    paymentBlock = `
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f0faf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 4px;font-weight:700;color:#1a2e24;font-size:14px;">Pagá el alquiler con Mercado Pago</p>
          <p style="margin:6px 0 2px;font-size:13px;color:#4a6a58;"><strong>Alias MP:</strong> ${input.paymentCbu}</p>
          ${input.paymentName ? `<p style="margin:2px 0 0;font-size:13px;color:#4a6a58;"><strong>A nombre de:</strong> ${input.paymentName}</p>` : ""}
        </td>
      </tr>
    </table>`;
  }

  const html = baseHtml(`
    <p style="margin:0 0 8px;font-size:14px;color:#4a6a58;">Hola${input.tenantName ? `, ${input.tenantName}` : ""},</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1a2e24;line-height:1.2;">
      Ya sos parte de Casita
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#4a6a58;line-height:1.6;">
      Tu propietario usa <strong>Casita</strong> para gestionar el alquiler de
      <strong>${input.propertyName} · ${input.unitIdentifier}</strong>.
      Desde acá vas a poder ver tus boletas, fechas de vencimiento y subir los comprobantes de pago.
    </p>

    ${paymentBlock}

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f5f9f7;border:1px solid #c8dbd2;border-radius:10px;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 4px;font-weight:700;color:#1a2e24;font-size:14px;">¿Cómo funciona?</p>
          <p style="margin:6px 0 0;font-size:13px;color:#4a6a58;line-height:1.6;">
            1. Cada mes aparece tu alquiler a pagar.<br/>
            2. Vas a recibir recordatorios automáticos antes de cada vencimiento.<br/>
            3. Cuando abonás, subís el comprobante desde tu casita y listo.
          </p>
        </td>
      </tr>
    </table>

    <a href="${portalUrl}" style="display:inline-block;padding:13px 22px;background:#3d6b54;color:#fff;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:-0.01em;">
      Entrar a tu casita →
    </a>

    <p style="margin:20px 0 0;font-size:12px;color:#9ab5a8;">
      Si tenés alguna duda, respondé este email o contactá a tu propietario directamente.
    </p>
  `);

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `Bienvenido/a a Casita — ${input.propertyName}`,
    html,
  });
}

/* Tenant uploaded a bill — notify owner */
export async function sendTenantBillUploadedEmail(input: {
  ownerEmail:      string;
  tenantName:      string | null;
  title:           string;
  amount:          string;
  currency:        string;
  dueDate:         string;
  propertyName:    string;
  unitIdentifier:  string;
  billUrl:         string;
  workspaceId:     string;
  extractedAmount: number | null;
  confidence:      string | null;
}) {
  const dashUrl    = `${APP_URL}/dashboard/${input.workspaceId}`;
  const tenantName = input.tenantName ?? "El inquilino";

  const confBadge = input.confidence === "high"
    ? `<span style="background:#d6f0df;color:#2d7a4a;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">IA · Alta confianza</span>`
    : input.confidence === "medium"
    ? `<span style="background:#fdf3db;color:#7a5a20;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">IA · Verificá el monto</span>`
    : "";

  const amtDisplay = input.currency === "USD"
    ? `U$D ${Number(input.amount).toLocaleString("es-AR")}`
    : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(input.amount));

  const html = baseHtml(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a2e24;line-height:1.2;">
      Nueva factura subida por el inquilino
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#4a6a58;">
      <strong>${tenantName}</strong> subió la factura de <strong>${input.title}</strong>
      (${input.propertyName} · ${input.unitIdentifier}).
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f0faf4;border:1px solid #c8dbd2;border-radius:10px;margin-bottom:16px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;font-weight:700;color:#1a2e24;font-size:15px;">${input.title}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#7a9e8c;">${input.propertyName} · ${input.unitIdentifier}</p>
          <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a2e24;">${amtDisplay}</p>
          <p style="margin:0 0 8px;font-size:12px;color:#9ab5a8;">Vence ${formatDate(input.dueDate)}</p>
          ${confBadge}
        </td>
      </tr>
    </table>

    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <a href="${input.billUrl}" style="display:inline-block;padding:10px 16px;background:#f5f9f7;color:#3d6b54;border:1px solid #c8dbd2;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none;">
        Ver factura →
      </a>
      <a href="${dashUrl}" style="display:inline-block;padding:10px 16px;background:#3d6b54;color:#fff;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none;">
        Ir al panel →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#9ab5a8;">
      El monto y la fecha de vencimiento fueron detectados automáticamente. Podés editarlos desde el panel si es necesario.
    </p>
  `);

  return getResend().emails.send({
    from:    FROM,
    to:      input.ownerEmail,
    subject: `${tenantName} subió la factura de ${input.title} · ${amtDisplay}`,
    html,
  });
}
