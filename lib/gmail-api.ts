import { refreshAccessToken } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { extractBillData, isExtractionConfigured } from "@/lib/bill-extractor";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";

const GMAIL_BASE = "https://www.googleapis.com/gmail/v1/users/me";

type GmailMessage = {
  id: string;
  threadId: string;
};

type GmailMessageFull = {
  id: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType: string;
    body?: { data?: string; attachmentId?: string; size: number };
    parts?: GmailPart[];
  };
};

type GmailPart = {
  mimeType: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size: number };
  parts?: GmailPart[];
};

type GmailAttachment = {
  data: string;
  size: number;
};

export type GmailBillResult = {
  provider: string;
  subject: string;
  date: string;
  amount: number | null;
  dueDate: string | null;
  period: string | null;
  billUrl: string | null;
  attachmentName: string | null;
};

async function getAccessToken(workspaceId: string): Promise<string> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { emailRefreshToken: true },
  });

  if (!ws?.emailRefreshToken) {
    throw new Error("No Gmail OAuth token found");
  }

  return refreshAccessToken(ws.emailRefreshToken);
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${err}`);
  }

  return res.json() as Promise<T>;
}

async function searchMessages(accessToken: string, query: string, maxResults = 5): Promise<GmailMessage[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const data = await gmailFetch<{ messages?: GmailMessage[] }>(accessToken, `/messages?${params}`);
  return data.messages ?? [];
}

async function getMessage(accessToken: string, messageId: string): Promise<GmailMessageFull> {
  return gmailFetch<GmailMessageFull>(accessToken, `/messages/${messageId}?format=full`);
}

async function getAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<Buffer> {
  const data = await gmailFetch<GmailAttachment>(accessToken, `/messages/${messageId}/attachments/${attachmentId}`);
  return Buffer.from(data.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function getHeader(msg: GmailMessageFull, name: string): string {
  return msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function findBestAttachment(parts: GmailPart[]): { part: GmailPart; type: "pdf" | "image" } | null {
  const flat: GmailPart[] = [];
  function flatten(p: GmailPart[]) {
    for (const part of p) {
      flat.push(part);
      if (part.parts) flatten(part.parts);
    }
  }
  flatten(parts);

  const pdf = flat.find((p) => p.mimeType === "application/pdf" && p.body?.attachmentId);
  if (pdf) return { part: pdf, type: "pdf" };

  const img = flat.find((p) => p.mimeType.startsWith("image/") && p.body?.attachmentId);
  if (img) return { part: img, type: "image" };

  return null;
}

async function processGmailMessage(
  accessToken: string,
  msg: GmailMessageFull,
  workspaceId: string
): Promise<GmailBillResult | null> {
  const subject = getHeader(msg, "Subject");
  const from = getHeader(msg, "From");
  const date = getHeader(msg, "Date");

  const attachment = msg.payload.parts ? findBestAttachment(msg.payload.parts) : null;

  let amount: number | null = null;
  let dueDate: string | null = null;
  let period: string | null = null;
  let billUrl: string | null = null;
  let attachmentName: string | null = null;

  if (attachment && attachment.part.body?.attachmentId) {
    const buffer = await getAttachment(accessToken, msg.id, attachment.part.body.attachmentId);
    attachmentName = attachment.part.filename ?? `bill.${attachment.type === "pdf" ? "pdf" : "jpg"}`;

    const ext = attachment.type === "pdf" ? "pdf" : "jpg";
    const storagePath = `${workspaceId}/gmail-${msg.id}.${ext}`;

    await uploadFileToBucket({
      bucket: STORAGE_BUCKETS.originalBills,
      path: storagePath,
      file: buffer,
      contentType: attachment.part.mimeType,
    });

    billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

    if (isExtractionConfigured()) {
      try {
        const extracted = await extractBillData(
          buffer,
          attachment.part.mimeType
        );
        if (extracted) {
          amount = extracted.totalAmount;
          dueDate = extracted.dueDate;
          period = extracted.period;
        }
      } catch (err) {
        console.error("[gmail-api] Extraction error:", err);
      }
    }
  }

  return {
    provider: from,
    subject,
    date,
    amount,
    dueDate,
    period,
    billUrl,
    attachmentName,
  };
}

/**
 * Search Gmail for bills from known providers.
 */
export async function searchGmailByProvider(
  workspaceId: string,
  providerSlugs: string[]
): Promise<{ found: GmailBillResult[]; errors: string[] }> {
  const accessToken = await getAccessToken(workspaceId);
  const found: GmailBillResult[] = [];
  const errors: string[] = [];

  const matchedProviders = providerSlugs
    .map((slug) => PROVIDERS.find((p) => p.slug === slug))
    .filter((p): p is Provider => !!p && p.senderPatterns.length > 0);

  if (matchedProviders.length === 0) {
    return { found: [], errors: [`No encontré proveedores válidos para: ${providerSlugs.join(", ")}`] };
  }

  for (const provider of matchedProviders) {
    for (const pattern of provider.senderPatterns) {
      try {
        const query = `from:${pattern} newer_than:90d has:attachment`;
        const messages = await searchMessages(accessToken, query, 3);

        for (const m of messages) {
          try {
            const full = await getMessage(accessToken, m.id);
            const result = await processGmailMessage(accessToken, full, workspaceId);
            if (result) {
              result.provider = provider.name;
              found.push(result);
            }
          } catch (err) {
            errors.push(`Error procesando email de ${provider.name}: ${err instanceof Error ? err.message : "desconocido"}`);
          }
        }

        if (found.length > 0) break;
      } catch {
        continue;
      }
    }
  }

  return { found, errors };
}

/**
 * Search Gmail by custom sender (for expensas, etc).
 */
export async function searchGmailByCustomSender(
  workspaceId: string,
  senderQuery: string
): Promise<{ found: GmailBillResult[]; errors: string[] }> {
  const accessToken = await getAccessToken(workspaceId);
  const found: GmailBillResult[] = [];
  const errors: string[] = [];

  try {
    const query = `(from:${senderQuery} OR subject:${senderQuery}) newer_than:90d`;
    const messages = await searchMessages(accessToken, query, 5);

    if (messages.length === 0) {
      return { found: [], errors: [`No encontré emails de "${senderQuery}" en los últimos 90 días.`] };
    }

    for (const m of messages.slice(0, 3)) {
      try {
        const full = await getMessage(accessToken, m.id);
        const result = await processGmailMessage(accessToken, full, workspaceId);
        if (result) found.push(result);
      } catch (err) {
        errors.push(`Error procesando email: ${err instanceof Error ? err.message : "desconocido"}`);
      }
    }
  } catch (err) {
    errors.push(`Error buscando en Gmail: ${err instanceof Error ? err.message : "desconocido"}`);
  }

  return { found, errors };
}
