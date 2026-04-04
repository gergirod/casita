import { refreshMsAccessToken } from "@/lib/microsoft-oauth";
import { prisma } from "@/lib/prisma";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { extractBillData, isExtractionConfigured } from "@/lib/bill-extractor";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0/me";

type GraphMessage = {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  hasAttachments: boolean;
};

type GraphAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
  "@odata.type": string;
};

export type OutlookBillResult = {
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
    throw new Error("No Microsoft OAuth token found");
  }

  return refreshMsAccessToken(ws.emailRefreshToken);
}

async function graphFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API error (${res.status}): ${err}`);
  }

  return res.json() as Promise<T>;
}

async function searchMessages(accessToken: string, filter: string, top = 5): Promise<GraphMessage[]> {
  const params = new URLSearchParams({
    $filter: filter,
    $top: String(top),
    $orderby: "receivedDateTime desc",
    $select: "id,subject,from,receivedDateTime,hasAttachments",
  });

  const data = await graphFetch<{ value: GraphMessage[] }>(accessToken, `/messages?${params}`);
  return data.value ?? [];
}

async function getAttachments(accessToken: string, messageId: string): Promise<GraphAttachment[]> {
  const data = await graphFetch<{ value: GraphAttachment[] }>(
    accessToken,
    `/messages/${messageId}/attachments?$select=id,name,contentType,size,contentBytes`
  );
  return data.value ?? [];
}

function findBestAttachment(attachments: GraphAttachment[]): GraphAttachment | null {
  const fileAttachments = attachments.filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment" && a.contentBytes);

  const pdf = fileAttachments.find((a) => a.contentType === "application/pdf");
  if (pdf) return pdf;

  const img = fileAttachments.find((a) => a.contentType.startsWith("image/"));
  if (img) return img;

  return null;
}

async function processOutlookMessage(
  accessToken: string,
  msg: GraphMessage,
  workspaceId: string
): Promise<OutlookBillResult | null> {
  let amount: number | null = null;
  let dueDate: string | null = null;
  let period: string | null = null;
  let billUrl: string | null = null;
  let attachmentName: string | null = null;

  if (msg.hasAttachments) {
    const attachments = await getAttachments(accessToken, msg.id);
    const best = findBestAttachment(attachments);

    if (best?.contentBytes) {
      const buffer = Buffer.from(best.contentBytes, "base64");
      attachmentName = best.name;

      const ext = best.contentType === "application/pdf" ? "pdf" : "jpg";
      const storagePath = `${workspaceId}/outlook-${msg.id}.${ext}`;

      await uploadFileToBucket({
        bucket: STORAGE_BUCKETS.originalBills,
        path: storagePath,
        file: buffer,
        contentType: best.contentType,
      });

      billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

      if (isExtractionConfigured()) {
        try {
          const extracted = await extractBillData(buffer, best.contentType);
          if (extracted) {
            amount = extracted.totalAmount;
            dueDate = extracted.dueDate;
            period = extracted.period;
          }
        } catch (err) {
          console.error("[outlook-api] Extraction error:", err);
        }
      }
    }
  }

  return {
    provider: msg.from.emailAddress.name || msg.from.emailAddress.address,
    subject: msg.subject,
    date: msg.receivedDateTime,
    amount,
    dueDate,
    period,
    billUrl,
    attachmentName,
  };
}

function buildDateFilter(): string {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  return `receivedDateTime ge ${since.toISOString()}`;
}

export async function searchOutlookByProvider(
  workspaceId: string,
  providerSlugs: string[]
): Promise<{ found: OutlookBillResult[]; errors: string[] }> {
  const accessToken = await getAccessToken(workspaceId);
  const found: OutlookBillResult[] = [];
  const errors: string[] = [];

  const matchedProviders = providerSlugs
    .map((slug) => PROVIDERS.find((p) => p.slug === slug))
    .filter((p): p is Provider => !!p && p.senderPatterns.length > 0);

  if (matchedProviders.length === 0) {
    return { found: [], errors: [`No encontré proveedores válidos para: ${providerSlugs.join(", ")}`] };
  }

  const dateFilter = buildDateFilter();

  for (const provider of matchedProviders) {
    for (const pattern of provider.senderPatterns) {
      try {
        const filter = `${dateFilter} and contains(from/emailAddress/address, '${pattern}')`;
        const messages = await searchMessages(accessToken, filter, 3);

        for (const m of messages) {
          try {
            const result = await processOutlookMessage(accessToken, m, workspaceId);
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

export async function searchOutlookByCustomSender(
  workspaceId: string,
  senderQuery: string
): Promise<{ found: OutlookBillResult[]; errors: string[] }> {
  const accessToken = await getAccessToken(workspaceId);
  const found: OutlookBillResult[] = [];
  const errors: string[] = [];

  try {
    const dateFilter = buildDateFilter();
    const searchFilter = `${dateFilter} and (contains(from/emailAddress/address, '${senderQuery}') or contains(from/emailAddress/name, '${senderQuery}') or contains(subject, '${senderQuery}'))`;
    const messages = await searchMessages(accessToken, searchFilter, 5);

    if (messages.length === 0) {
      return { found: [], errors: [`No encontré emails de "${senderQuery}" en los últimos 90 días.`] };
    }

    for (const m of messages.slice(0, 3)) {
      try {
        const result = await processOutlookMessage(accessToken, m, workspaceId);
        if (result) found.push(result);
      } catch (err) {
        errors.push(`Error procesando email: ${err instanceof Error ? err.message : "desconocido"}`);
      }
    }
  } catch (err) {
    errors.push(`Error buscando en Outlook: ${err instanceof Error ? err.message : "desconocido"}`);
  }

  return { found, errors };
}
