/*
  Conecta al email del owner via IMAP y busca facturas de proveedores configurados.
  Compatible con Gmail (app password), Outlook, Yahoo y cualquier IMAP estándar.

  Cómo obtener una App Password:
    Gmail   → myaccount.google.com > Seguridad > Contraseñas de aplicación
    Outlook → account.live.com/proofs > Contraseña de aplicación
    Yahoo   → login.yahoo.com/account/security > Contraseñas de aplicación

  Frecuencia del cron: semanal (lunes 08:00 AR).
  La lógica de "¿ya procesé este período?" usa billingPeriod para no duplicar
  obligaciones bimestrales o trimestrales.
*/

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decrypt } from "@/lib/encrypt";
import { extractBillData, isExtractionConfigured } from "@/lib/bill-extractor";
import { getInitialStatusFromDueDate } from "@/lib/obligations";
import { PROVIDERS, BILLING_PERIOD_DAYS, type Provider, type ServiceType } from "@/lib/providers";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { sendBillNotificationEmail } from "@/lib/email";
import { sendWhatsApp, buildReminderMessage } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";

/* Known IMAP hosts per provider slug */
const IMAP_HOSTS: Record<string, { host: string; port: number }> = {
  gmail:   { host: "imap.gmail.com",       port: 993 },
  outlook: { host: "outlook.office365.com", port: 993 },
  yahoo:   { host: "imap.mail.yahoo.com",   port: 993 },
};

export type EmailConnection = {
  emailProvider:          string;
  emailAddress:           string;
  emailEncryptedPassword: string;
  imapHost:               string | null;
  imapPort:               number | null;
};

type ImapMessage = {
  source?: Buffer;
  uid?: number;
};

type TemplateForFetch = {
  id: string;
  providerSlug: string | null;
  dueDay: number;
  amount: unknown;
  type: "rent" | "expensas" | "electricity" | "gas" | "water" | "internet" | "custom";
  title: string;
  currency: string;
  reminderChannel: string;
};

type UnitForFetch = {
  id: string;
  identifier: string;
  tenantToken: string;
  tenantContact: { fullName: string; email: string | null; whatsapp: string | null } | null;
  obligationTemplates: TemplateForFetch[];
};

type WorkspaceForFetch = {
  id: string;
  properties: Array<{ name: string; units: UnitForFetch[] }>;
};

function getImapConfig(conn: EmailConnection) {
  const preset = IMAP_HOSTS[conn.emailProvider] ?? null;
  return {
    host:   conn.imapHost ?? preset?.host ?? "imap.gmail.com",
    port:   conn.imapPort ?? preset?.port ?? 993,
    secure: true,
    auth: {
      user: conn.emailAddress,
      pass: decrypt(conn.emailEncryptedPassword),
    },
    logger: false as const,
  };
}

export type EmailBillResult = {
  provider: string;
  subject: string;
  date: string;
  amount: number | null;
  dueDate: string | null;
  period: string | null;
  billUrl: string;
  confidence: string;
  attachmentName: string | null;
};

const BILL_MIME_TYPES = [
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/tiff", "image/bmp",
];

/**
 * Parsea un email raw, extrae el mejor adjunto (PDF > imagen),
 * lo sube a storage y lo pasa a OpenAI para extracción.
 * Si no hay adjuntos, intenta extraer del body HTML/texto.
 */
async function extractFromEmail(
  source: Buffer,
  workspaceId: string,
  providerLabel: string,
  filePrefix: string
): Promise<EmailBillResult> {
  const parsed = await simpleParser(source);

  const subject  = parsed.subject ?? "(sin asunto)";
  const dateStr  = parsed.date?.toISOString().slice(0, 10) ?? "desconocida";
  const fromName = parsed.from?.value?.[0]?.name
                ?? parsed.from?.value?.[0]?.address
                ?? providerLabel;

  const billAttachments = (parsed.attachments ?? [])
    .filter((a) => BILL_MIME_TYPES.includes(a.contentType))
    .sort((a, b) => {
      const aIsPdf = a.contentType === "application/pdf" ? 0 : 1;
      const bIsPdf = b.contentType === "application/pdf" ? 0 : 1;
      return aIsPdf - bIsPdf;
    });

  let buffer: Buffer;
  let mimeType: string;
  let attachmentName: string | null = null;
  let storagePath: string;

  if (billAttachments.length > 0) {
    const att = billAttachments[0];
    buffer = att.content;
    mimeType = att.contentType;
    attachmentName = att.filename ?? null;
    const ext = mimeType.includes("pdf") ? "pdf" : mimeType.includes("png") ? "png" : "jpg";
    storagePath = `${workspaceId}/${filePrefix}-${Date.now()}.${ext}`;
  } else {
    const htmlText = parsed.html
      ? parsed.html.replace(/<[^>]*>/g, " ").slice(0, 12000)
      : null;
    const bodyText = parsed.text?.slice(0, 12000) ?? htmlText ?? "";
    buffer = Buffer.from(bodyText, "utf-8");
    mimeType = "text/plain";
    storagePath = `${workspaceId}/${filePrefix}-${Date.now()}.eml`;
    await uploadFileToBucket({
      bucket: STORAGE_BUCKETS.originalBills,
      path: storagePath,
      file: source,
      contentType: "message/rfc822",
    });
  }

  if (attachmentName) {
    await uploadFileToBucket({
      bucket: STORAGE_BUCKETS.originalBills,
      path: storagePath,
      file: buffer,
      contentType: mimeType,
    });
  }

  const billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

  let amount: number | null = null;
  let dueDate: string | null = null;
  let period: string | null = null;
  let confidence = "low";

  if (isExtractionConfigured()) {
    try {
      const extraction = await extractBillData(buffer, mimeType);
      amount = extraction.totalAmount;
      dueDate = extraction.dueDate;
      period = extraction.period;
      confidence = extraction.confidence;
    } catch { /* extraction failed, continue with nulls */ }
  }

  return {
    provider: fromName,
    subject,
    date: dateStr,
    amount,
    dueDate,
    period,
    billUrl,
    confidence,
    attachmentName,
  };
}

/** Test que las credenciales IMAP son válidas */
export async function testImapConnection(
  conn: EmailConnection
): Promise<{ ok: boolean; error?: string }> {
  const client = new ImapFlow(getImapConfig(conn));
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de conexión" };
  }
}

/**
 * ¿Necesitamos buscar una nueva factura para este template?
 * Respeta el billingPeriod para no crear duplicados bimestrales/trimestrales.
 */
async function shouldFetch(templateId: string, billingPeriod: string): Promise<boolean> {
  const minDays = BILLING_PERIOD_DAYS[billingPeriod as keyof typeof BILLING_PERIOD_DAYS] ?? 28;
  const cutoff  = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000);

  const recent = await prisma.obligation.findFirst({
    where: {
      templateId,
      createdAt: { gte: cutoff },
      /* Solo contar obligaciones que vinieron de email auto o n8n */
      OR: [
        { extractionSource: "gemini" },
        { notes: { contains: "Auto-importado" } },
      ],
    },
    select: { id: true },
  });

  return !recent; /* true = hay que buscar */
}

/** Fetch bills para un workspace — llamado por el cron semanal */
export async function fetchBillsForWorkspace(workspaceId: string): Promise<{
  processed: number;
  skipped:   number;
  errors:    string[];
}> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      properties: {
        include: {
          units: {
            include: {
              tenantContact:       { select: { fullName: true, email: true, whatsapp: true } },
              obligationTemplates: {
                where: {
                  isActive: true,
                  ingestionMode: "auto_email",
                  providerSlug: { not: null },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!workspace) return { processed: 0, skipped: 0, errors: ["Workspace no encontrado"] };

  /* Email config now lives in OwnerProfile, not Workspace */
  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { ownerId: workspace.ownerId },
    select: {
      emailProvider: true,
      emailAddress: true,
      emailEncryptedPassword: true,
      emailRefreshToken: true,
      imapHost: true,
      imapPort: true,
    },
  });

  if (
    !ownerProfile?.emailAddress ||
    (!ownerProfile?.emailEncryptedPassword && !ownerProfile?.emailRefreshToken) ||
    !ownerProfile?.emailProvider
  ) {
    return { processed: 0, skipped: 0, errors: ["Email no conectado"] };
  }

  const allTemplates = workspace.properties.flatMap((p: (typeof workspace.properties)[number]) =>
    p.units.flatMap((u: (typeof p.units)[number]) => u.obligationTemplates)
  );
  if (allTemplates.length === 0) return { processed: 0, skipped: 0, errors: [] };

  const slugsInUse = [...new Set(allTemplates.map((t: (typeof allTemplates)[number]) => t.providerSlug).filter(Boolean))] as string[];
  const providers  = PROVIDERS.filter((p) => slugsInUse.includes(p.slug));
  if (providers.length === 0) return { processed: 0, skipped: 0, errors: [] };

  /* ownerProfile is guaranteed non-null here due to the check above */

  /* ── Filtrar templates que realmente necesitan fetch esta semana ── */
  const templatesToFetch: typeof allTemplates = [];
  for (const t of allTemplates) {
    if (!t.providerSlug) continue;
    const provider = providers.find((p) => p.slug === t.providerSlug);
    if (!provider) continue;
    const period = t.billingPeriod || provider.billingPeriod || "monthly";
    if (await shouldFetch(t.id, period)) {
      templatesToFetch.push(t);
    }
  }

  if (templatesToFetch.length === 0) {
    return { processed: 0, skipped: allTemplates.length, errors: [] };
  }

  const activeProviderSlugs = [...new Set(templatesToFetch.map((t: (typeof allTemplates)[number]) => t.providerSlug!))];
  const activeProviders     = providers.filter((p) => activeProviderSlugs.includes(p.slug));

  /* ── Conectar IMAP ── */
  const conn: EmailConnection = {
    emailProvider:          ownerProfile.emailProvider!,
    emailAddress:           ownerProfile.emailAddress!,
    emailEncryptedPassword: ownerProfile.emailEncryptedPassword!,
    imapHost:               ownerProfile.imapHost,
    imapPort:               ownerProfile.imapPort,
  };

  const client = new ImapFlow(getImapConfig(conn));
  const errors:    string[] = [];
  let   processed  = 0;
  const skipped    = allTemplates.length - templatesToFetch.length;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      /* Buscar en los últimos 70 días — cubre hasta el bimestre anterior */
      const since = new Date();
      since.setDate(since.getDate() - 70);

      for (const provider of activeProviders) {
        if (provider.senderPatterns.length === 0) continue;

        for (const pattern of provider.senderPatterns) {
          let uids: number[];
          try {
            uids = await client.search({ from: pattern, since }) as number[];
          } catch {
            continue;
          }
          if (!uids.length) continue;

          /* Solo los más recientes para no reprocesar */
          const recentUids = uids.slice(-5);
          const messages   = client.fetch(recentUids, { envelope: true, source: true });

          for await (const msg of messages) {
            try {
              const count = await processProviderEmail(
                msg,
                provider,
                workspace,
                templatesToFetch,
              );
              processed += count;
            } catch (err) {
              errors.push(`${provider.name}: ${err instanceof Error ? err.message : "error"}`);
            }
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "IMAP error");
  }

  return { processed, skipped, errors };
}

/**
 * Búsqueda directa de facturas en IMAP por proveedor.
 * Extrae adjuntos PDF/imagen y los analiza con OpenAI.
 */
export async function searchEmailByProvider(
  workspaceId: string,
  providerSlugs: string[]
): Promise<{ found: EmailBillResult[]; errors: string[] }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true, emailAddress: true, emailEncryptedPassword: true,
      emailProvider: true, imapHost: true, imapPort: true,
    },
  });

  if (!workspace?.emailAddress || !workspace?.emailEncryptedPassword || !workspace?.emailProvider) {
    return { found: [], errors: ["Email no conectado. Conectalo desde el dashboard en Configuración > Email."] };
  }

  const matchedProviders = providerSlugs
    .map((slug) => PROVIDERS.find((p) => p.slug === slug))
    .filter((p): p is Provider => !!p && p.senderPatterns.length > 0);

  if (matchedProviders.length === 0) {
    return { found: [], errors: [`No encontré proveedores válidos para: ${providerSlugs.join(", ")}`] };
  }

  const conn: EmailConnection = {
    emailProvider: workspace.emailProvider, emailAddress: workspace.emailAddress,
    emailEncryptedPassword: workspace.emailEncryptedPassword,
    imapHost: workspace.imapHost, imapPort: workspace.imapPort,
  };

  const client = new ImapFlow(getImapConfig(conn));
  const found: EmailBillResult[] = [];
  const errors: string[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      for (const provider of matchedProviders) {
        for (const pattern of provider.senderPatterns) {
          let uids: number[];
          try {
            uids = await client.search({ from: pattern, since }) as number[];
          } catch { continue; }
          if (!uids.length) continue;

          const lastUid = uids[uids.length - 1];
          const messages = client.fetch([lastUid], { source: true });

          for await (const msg of messages) {
            if (!msg.source) continue;
            try {
              const result = await extractFromEmail(
                msg.source, workspace.id, provider.name, `search-${provider.slug}`
              );
              found.push(result);
            } catch (err) {
              errors.push(`${provider.name}: ${err instanceof Error ? err.message : "error"}`);
            }
          }
          break;
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error IMAP");
  }

  return { found, errors };
}

/**
 * Búsqueda libre en IMAP por remitente o asunto.
 * Para administraciones de expensas custom, consorcios, etc.
 * Extrae adjuntos PDF/imagen y los analiza con OpenAI.
 */
export async function searchEmailByCustomSender(
  workspaceId: string,
  senderQuery: string
): Promise<{ found: EmailBillResult[]; errors: string[] }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true, emailAddress: true, emailEncryptedPassword: true,
      emailProvider: true, imapHost: true, imapPort: true,
    },
  });

  if (!workspace?.emailAddress || !workspace?.emailEncryptedPassword || !workspace?.emailProvider) {
    return { found: [], errors: ["Email no conectado. Conectalo desde el dashboard en Configuración > Email."] };
  }

  const conn: EmailConnection = {
    emailProvider: workspace.emailProvider, emailAddress: workspace.emailAddress,
    emailEncryptedPassword: workspace.emailEncryptedPassword,
    imapHost: workspace.imapHost, imapPort: workspace.imapPort,
  };

  const client = new ImapFlow(getImapConfig(conn));
  const found: EmailBillResult[] = [];
  const errors: string[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const isEmail = senderQuery.includes("@");
      const searches = isEmail
        ? [{ from: senderQuery, since }]
        : [{ from: senderQuery, since }, { subject: senderQuery, since }];

      const seenUids = new Set<number>();

      for (const criteria of searches) {
        let uids: number[];
        try { uids = await client.search(criteria) as number[]; } catch { continue; }
        if (!uids.length) continue;

        const recentUids = uids.slice(-3).filter((u) => !seenUids.has(u));
        for (const u of recentUids) seenUids.add(u);
        if (recentUids.length === 0) continue;

        const messages = client.fetch(recentUids, { source: true });

        for await (const msg of messages) {
          if (!msg.source) continue;
          try {
            const result = await extractFromEmail(
              msg.source, workspace.id, senderQuery, `custom-${Date.now()}`
            );
            found.push(result);
          } catch (err) {
            errors.push(`${senderQuery}: ${err instanceof Error ? err.message : "error"}`);
          }
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error IMAP");
  }

  return { found, errors };
}

/**
 * Resolver slugs de proveedores a partir de texto libre del usuario.
 * "edenor" → ["edenor"], "expensas" → todos los de tipo expensas,
 * "luz" → todos los de tipo electricity
 */
export function resolveProviderSlugs(text: string): string[] {
  const lower = text.toLowerCase();
  const slugs: string[] = [];
  const seen = new Set<string>();

  const typeAliases: Record<string, ServiceType> = {
    luz: "electricity", electricidad: "electricity", energia: "electricity",
    gas: "gas", agua: "water", internet: "internet", wifi: "internet",
    expensas: "expensas", consorcio: "expensas",
  };

  for (const [alias, type] of Object.entries(typeAliases)) {
    if (lower.includes(alias)) {
      for (const p of PROVIDERS.filter((pr) => pr.type === type && pr.senderPatterns.length > 0)) {
        if (!seen.has(p.slug)) { slugs.push(p.slug); seen.add(p.slug); }
      }
    }
  }

  for (const p of PROVIDERS) {
    if (lower.includes(p.slug) || lower.includes(p.name.toLowerCase())) {
      if (!seen.has(p.slug) && p.senderPatterns.length > 0) {
        slugs.push(p.slug);
        seen.add(p.slug);
      }
    }
  }

  return slugs;
}

async function processProviderEmail(
  msg: ImapMessage,
  provider: Provider,
  workspace: WorkspaceForFetch,
  templatesToFetch: TemplateForFetch[]
): Promise<number> {
  if (!msg.source) return 0;
  const source = msg.source;

  /* Upload raw email to storage (Gemini puede leer el texto del email como PDF) */
  const filename    = `auto-${provider.slug}-${msg.uid ?? Date.now()}.eml`;
  const storagePath = `workspace-${workspace.id}/${filename}`;
  await uploadFileToBucket({
    bucket:      STORAGE_BUCKETS.originalBills,
    path:        storagePath,
    file:        source,
    contentType: "message/rfc822",
  });
  const billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

  /* Gemini extraction — enviamos el email completo como texto plano */
  let extracted: Awaited<ReturnType<typeof extractBillData>> | null = null;
  if (isExtractionConfigured()) {
    const textContent = source.toString("utf-8").slice(0, 8000);
    extracted = await extractBillData(
      Buffer.from(textContent),
      "text/plain"
    ).catch(() => null);
  }

  const now      = new Date();
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "";
  let   created  = 0;

  const matchingTemplates = templatesToFetch.filter((t) => t.providerSlug === provider.slug);

  for (const template of matchingTemplates) {
    /* Buscar la unidad a la que pertenece el template */
    const unit = workspace.properties
      .flatMap((p) => p.units)
      .find((u) => u.obligationTemplates.some((t) => t.id === template.id));
    if (!unit) continue;

    const dueDate = extracted?.dueDate
      ? new Date(extracted.dueDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), template.dueDay));
    const amount  = extracted?.totalAmount ?? Number(template.amount);
    const status  = getInitialStatusFromDueDate(dueDate);

    /* dueMonth = inicio del mes de la fecha de vencimiento */
    const dueMonth = new Date(Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      1
    ));

    await prisma.obligation.upsert({
      where:  { templateId_dueMonth: { templateId: template.id, dueMonth } },
      update: {
        amount, dueDate, originalBillUrl: billUrl, status,
        extractionSource: isExtractionConfigured() ? "gemini" : "email",
        ...(extracted?.totalAmount != null && { extractedAmount: extracted.totalAmount }),
        ...(extracted?.dueDate && { extractedDueDate: new Date(extracted.dueDate) }),
        ...(extracted?.period  && { extractedPeriod: extracted.period }),
      },
      create: {
        unitId:          unit.id,
        templateId:      template.id,
        type:            template.type,
        sourceType:      "manual",
        title:           template.title,
        amount, dueDate, dueMonth, status,
        currency:        template.currency,
        originalBillUrl: billUrl,
        notes:           `Auto-importado desde email`,
        extractionSource: isExtractionConfigured() ? "gemini" : "email",
        ...(extracted?.totalAmount != null && { extractedAmount: extracted.totalAmount }),
        ...(extracted?.dueDate && { extractedDueDate: new Date(extracted.dueDate) }),
        ...(extracted?.period  && { extractedPeriod: extracted.period }),
      },
    });
    created++;

    /* ── Notificar al inquilino según el canal configurado ── */
    const contact         = unit.tenantContact;
    const reminderChannel = template.reminderChannel;
    const portalUrl       = `${appUrl}/t/${unit.tenantToken}`;
    const property        = workspace.properties
      .find((p) => p.units.some((u) => u.id === unit.id));

    if (contact?.email && (reminderChannel === "email" || reminderChannel === "both")) {
      void sendBillNotificationEmail({
        to:              contact.email,
        tenantName:      contact.fullName,
        title:           template.title,
        amount:          amount.toFixed(2),
        dueDate:         dueDate.toISOString(),
        tenantToken:     unit.tenantToken,
        propertyName:    property?.name ?? "",
        unitIdentifier:  unit.identifier,
        originalBillUrl: billUrl,
      }).catch(() => {});
    }

    if (contact?.whatsapp && (reminderChannel === "whatsapp" || reminderChannel === "both")) {
      void sendWhatsApp({
        to:   contact.whatsapp,
        body: buildReminderMessage({
          tenantName:     contact.fullName,
          title:          template.title,
          amount:         amount.toFixed(2),
          currency:       template.currency,
          dueDate:        dueDate.toISOString(),
          daysUntilDue:   Math.ceil((dueDate.getTime() - Date.now()) / 864e5),
          propertyName:   property?.name ?? "",
          unitIdentifier: unit.identifier,
          portalUrl,
        }),
      }).catch(() => {});
    }
  }

  return created;
}
