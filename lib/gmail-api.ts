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
    select: { ownerId: true },
  });

  if (!ws) throw new Error("Workspace not found");

  const profile = await prisma.ownerProfile.findUnique({
    where: { ownerId: ws.ownerId },
    select: { emailRefreshToken: true },
  });

  if (!profile?.emailRefreshToken) {
    throw new Error("No Gmail OAuth token found");
  }

  return refreshAccessToken(profile.emailRefreshToken);
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

  // Accept explicit PDF mimeType OR octet-stream/unknown with a .pdf filename
  const isPdfPart = (p: GmailPart) =>
    !!p.body?.attachmentId &&
    (p.mimeType === "application/pdf" ||
      ((p.mimeType === "application/octet-stream" || p.mimeType === "application/x-pdf" || p.mimeType === "") &&
        p.filename?.toLowerCase().endsWith(".pdf")));

  const pdf = flat.find(isPdfPart);
  if (pdf) return { part: pdf, type: "pdf" };

  const img = flat.find((p) => p.mimeType.startsWith("image/") && p.body?.attachmentId);
  if (img) return { part: img, type: "image" };

  return null;
}

/** Decode the HTML body from a Gmail message (handles multipart and single-part). */
function findHtmlBody(msg: GmailMessageFull): string | null {
  const parts: GmailPart[] = [];
  function flatten(p: GmailPart[]) {
    for (const part of p) {
      parts.push(part);
      if (part.parts) flatten(part.parts);
    }
  }

  if (msg.payload.parts) {
    flatten(msg.payload.parts);
    const htmlPart = parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return Buffer.from(
        htmlPart.body.data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf-8");
    }
  } else if (msg.payload.mimeType === "text/html" && msg.payload.body?.data) {
    return Buffer.from(
      msg.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
  }

  return null;
}

/**
 * Try to extract the real destination URL from tracking/redirect wrappers.
 * Handles:
 *  - ?p=BASE64_JSON with a linkUrl field (Edenor-style relay trackers)
 *  - ?url=, ?redirect=, ?destination= plain parameters
 * Generic — no provider-specific logic.
 */
function extractRealUrl(href: string): string {
  // Base64-encoded JSON payload — common in ESP relay trackers
  const b64Match = href.match(/[?&]p=([A-Za-z0-9+/=_%~-]+)/);
  if (b64Match) {
    try {
      const raw = decodeURIComponent(b64Match[1]).replace(/-/g, "+").replace(/_/g, "/");
      const json = JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as Record<string, unknown>;
      const real = (json.linkUrl ?? json.url ?? json.redirect) as string | undefined;
      if (real && real.startsWith("http")) return real;
    } catch {
      // not valid base64/JSON — fall through
    }
  }

  // Plain redirect parameter
  try {
    const u = new URL(href);
    for (const key of ["url", "redirect", "destination", "target", "link"]) {
      const val = u.searchParams.get(key);
      if (val && val.startsWith("http")) return val;
    }
  } catch {
    // invalid URL
  }

  return href;
}

/** Decode common HTML entities so text matching works correctly. */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#\d+;/g, " ")   // numeric entities → space
    .replace(/&[a-z]+;/gi, " "); // other named entities → space
}

/**
 * Keywords in link TEXT that indicate a bill download link.
 * Generic — no provider-specific logic.
 */
const BILL_LINK_TEXT_PATTERNS = [
  /ver\s+(mi\s+|tu\s+)?factura/i,
  /descargar?\s+(mi\s+|tu\s+)?factura/i,
  /acceder\s+a\s+(mi\s+)?factura/i,
  /ver\s+comprobante/i,
  /descargar?\s+comprobante/i,
  /ver\s+recibo/i,
  /download\s+(bill|invoice)/i,
  /view\s+invoice/i,
  /baixar\s+fatura/i,
  /ver\s+boleto/i,
  /factura\s+disponible/i,
  /tu\s+factura/i,
  /liquidaci[oó]n/i,       // "Liquidacion VENICE 02-2026"
  /liquidaci[oó]n.*\.pdf/i,
  /expensas.*\.pdf/i,
  /\.pdf$/i,               // any link whose visible text ends in .pdf
];

/**
 * Keywords in the HREF that indicate a bill download URL.
 * Catches cases where the button is an image or has no readable text.
 */
const BILL_LINK_HREF_PATTERNS = [
  /descarga[_-]?de[_-]?factura/i,
  /download[_-]?bill/i,
  /download[_-]?invoice/i,
  /descargar[_-]?factura/i,
  /\/factura[/?]/i,
  /\/invoice[/?]/i,
  /\/recibo[/?]/i,
  /\/comprobante[/?]/i,
  /\/boleto[/?]/i,
  /\/fatura[/?]/i,
  /factura\.pdf/i,
  /invoice\.pdf/i,
  /liquidacion.*\.pdf/i,  // "liquidacion_venice_02-2026.pdf"
  /expensas.*\.pdf/i,
  /\.pdf(\?|$)/i,          // any direct .pdf URL
];

/** Extract candidate bill-download URLs from an HTML email body. */
function findBillLinksInHtml(html: string): string[] {
  // Match <a href="...">...</a> — href can use single or double quotes
  const anchorRegex = /<a\s[^>]*?href=["']([^"'>]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    const rawText = match[2];

    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:")) continue;
    if (!rawHref.startsWith("http")) continue;

    const href    = decodeHtmlEntities(rawHref);
    const realUrl = extractRealUrl(href); // unwrap tracking/redirect wrappers
    const text    = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

    const matchesText = BILL_LINK_TEXT_PATTERNS.some((re) => re.test(text));
    const matchesHref = BILL_LINK_HREF_PATTERNS.some((re) => re.test(realUrl));

    if (matchesText || matchesHref) {
      links.push(realUrl); // use the real URL, not the tracker
    }
  }

  return links;
}

/**
 * Attempt to fetch a PDF from a URL.
 * Returns a Buffer if the response is a PDF, null otherwise.
 * Follows redirects — useful for CDN-signed URLs.
 */
async function tryFetchPdfFromLink(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Casita/1.0)",
          Accept: "application/pdf,*/*",
        },
      });

      const contentType   = res.headers.get("content-type") ?? "";
      const disposition   = res.headers.get("content-disposition") ?? "";
      const finalUrl      = res.url ?? url;

      if (!res.ok) return null;

      // Accept if: content-type is PDF, URL ends in .pdf, or it's a file download
      const looksLikePdf =
        contentType.includes("pdf") ||
        finalUrl.toLowerCase().includes(".pdf") ||
        disposition.toLowerCase().includes(".pdf") ||
        (disposition.toLowerCase().includes("attachment") && !contentType.includes("html"));

      if (!looksLikePdf) return null;

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function processGmailMessage(
  accessToken: string,
  msg: GmailMessageFull,
  workspaceId: string
): Promise<GmailBillResult | null> {
  const subject = getHeader(msg, "Subject");
  const from = getHeader(msg, "From");
  const date = getHeader(msg, "Date");

  // DEBUG: log all MIME parts so we can see what Venice Tigre actually sends
  function debugParts(parts: GmailPart[], depth = 0) {
    for (const p of parts) {
      console.log(`[gmail-debug]${"  ".repeat(depth)} mimeType=${p.mimeType} filename=${p.filename ?? "-"} attachmentId=${p.body?.attachmentId ?? "-"} size=${p.body?.size ?? "-"}`);
      if (p.parts) debugParts(p.parts, depth + 1);
    }
  }
  if (msg.payload.parts) debugParts(msg.payload.parts);
  else console.log(`[gmail-debug] no parts — top-level mimeType=${msg.payload.mimeType}`);

  const attachment = msg.payload.parts ? findBestAttachment(msg.payload.parts) : null;

  let amount: number | null = null;
  let dueDate: string | null = null;
  let period: string | null = null;
  let billUrl: string | null = null;
  let attachmentName: string | null = null;

  // ── Path 1: email has an attached PDF or image ──────────────────────────
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
        const extracted = await extractBillData(buffer, attachment.part.mimeType);
        if (extracted) {
          amount    = extracted.totalAmount;
          dueDate   = extracted.dueDate;
          period    = extracted.period;
        }
      } catch (err) {
        console.error("[gmail-api] Extraction error (attachment):", err);
      }
    }
  }

  // ── Path 2: no attachment — look for a "Ver mi factura" style link in HTML body ──
  if (!attachment) {
    const html = findHtmlBody(msg);
    if (html) {
      // Debug: show raw anchors found in HTML
      console.log(`[gmail-debug] html length=${html.length}`);
      console.log(`[gmail-debug] HTML SNIPPET:\n${html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").slice(0, 4000)}\n[/HTML SNIPPET]`);
      const links = findBillLinksInHtml(html);
      console.log(`[gmail-debug] bill links found: ${links.length}`, links);
      for (const link of links) {
        const pdfBuffer = await tryFetchPdfFromLink(link);

        if (pdfBuffer) {
          attachmentName = `factura-link.pdf`;
          const storagePath = `${workspaceId}/gmail-link-${msg.id}.pdf`;

          await uploadFileToBucket({
            bucket: STORAGE_BUCKETS.originalBills,
            path: storagePath,
            file: pdfBuffer,
            contentType: "application/pdf",
          });

          billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, storagePath);

          if (isExtractionConfigured()) {
            try {
              const extracted = await extractBillData(pdfBuffer, "application/pdf");
              if (extracted) {
                amount  = extracted.totalAmount;
                dueDate = extracted.dueDate;
                period  = extracted.period;
              }
            } catch (err) {
              console.error("[gmail-api] Extraction error (link PDF):", err);
            }
          }

          break;
        }

        if (!billUrl) {
          billUrl = link;
          attachmentName = "__needs_manual_download__";
        }
      }

      // ── Path 3: no downloadable PDF anywhere — extract amount/dates from email text ──
      // Handles providers like SimpleSolutions/Venice Tigre that embed the data in HTML
      // and require app authentication to download the actual PDF.
      if (!billUrl && isExtractionConfigured()) {
        try {
          // Strip HTML tags to get readable plain text
          const plainText = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);

          if (plainText.length > 100) {
            const textBuffer = Buffer.from(plainText, "utf-8");
            const extracted = await extractBillData(textBuffer, "text/plain");
            if (extracted) {
              amount  = extracted.totalAmount;
              dueDate = extracted.dueDate;
              period  = extracted.period;
              // No billUrl — data comes from email body, no PDF available
              attachmentName = "__extracted_from_email__";
            }
          }
        } catch (err) {
          console.error("[gmail-api] Extraction error (email text):", err);
        }
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
    let providerFound = false;

    for (const pattern of provider.senderPatterns) {
      if (providerFound) break;
      try {
        // Try with attachment first, then without — many AR utility bills arrive as HTML-only emails
        const queries = [
          `from:${pattern} newer_than:90d has:attachment`,
          `from:${pattern} newer_than:90d`,
        ];

        for (const query of queries) {
          console.log(`[gmail-debug] searchGmailByProvider query="${query}"`);
          const messages = await searchMessages(accessToken, query, 5);
          console.log(`[gmail-debug] searchGmailByProvider found ${messages.length} message(s)`);
          if (messages.length === 0) continue;

          for (const m of messages) {
            try {
              const full = await getMessage(accessToken, m.id);
              const result = await processGmailMessage(accessToken, full, workspaceId);
              if (result) {
                result.provider = provider.name;
                found.push(result);
                providerFound = true;
              }
            } catch (err) {
              errors.push(`Error procesando email de ${provider.name}: ${err instanceof Error ? err.message : "desconocido"}`);
            }
          }

          if (providerFound) break;
        }
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
    // Quote multi-word terms so Gmail doesn't split them ("Venice Tigre" vs Venice AND Tigre)
    const quoted = senderQuery.includes(" ") ? `"${senderQuery}"` : senderQuery;
    const query = `(from:${quoted} OR subject:${quoted}) newer_than:180d`;
    console.log(`[gmail-debug] searchGmailByCustomSender query="${query}"`);
    const messages = await searchMessages(accessToken, query, 30);
    console.log(`[gmail-debug] found ${messages.length} message(s)`);

    if (messages.length === 0) {
      return { found: [], errors: [`No encontré emails de "${senderQuery}" en los últimos 180 días.`] };
    }

    // Process up to 25 emails — enough to find bills buried under newsletters
    const MAX_TO_SCAN = Math.min(messages.length, 25);

    for (const m of messages.slice(0, MAX_TO_SCAN)) {
      try {
        const full = await getMessage(accessToken, m.id);
        const subject = full.payload.headers.find(h => h.name.toLowerCase() === "subject")?.value ?? "";
        const result = await processGmailMessage(accessToken, full, workspaceId);
        if (!result) continue;

        // Only keep emails that have strong financial signals.
        // "period" alone is NOT enough — weekly reports and newsletters often contain
        // date ranges that the AI mistakes for billing periods.
        // We need at least: a due date, a monetary amount, or a real file attachment/URL.
        const hasBillData =
          result.amount !== null ||
          result.dueDate !== null ||
          result.billUrl !== null ||
          (result.attachmentName !== null &&
            result.attachmentName !== "__extracted_from_email__" &&
            result.attachmentName !== "__needs_manual_download__");

        console.log(`[gmail-debug] "${subject}" → hasBillData=${hasBillData} amount=${result.amount} dueDate=${result.dueDate} period=${result.period}`);

        if (hasBillData) {
          found.push(result);
          if (found.length >= 3) break;
        }
      } catch (err) {
        errors.push(`Error procesando email: ${err instanceof Error ? err.message : "desconocido"}`);
      }
    }
  } catch (err) {
    errors.push(`Error buscando en Gmail: ${err instanceof Error ? err.message : "desconocido"}`);
  }

  return { found, errors };
}

// ─── List recent emails (lightweight — no AI extraction) ──────────────────────

export type GmailEmailMeta = {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  hasAttachment: boolean;
  snippet: string;
};

/**
 * Returns up to maxResults recent email subjects from a sender WITHOUT running AI extraction.
 * Used to show the user a menu of emails so they can identify which one is the bill.
 */
export async function listRecentEmailsFromSender(
  workspaceId: string,
  senderQuery: string,
  maxResults = 10
): Promise<{ emails: GmailEmailMeta[]; errors: string[] }> {
  const accessToken = await getAccessToken(workspaceId);
  const errors: string[] = [];

  try {
    const quoted = senderQuery.includes(" ") ? `"${senderQuery}"` : senderQuery;
    const query = `(from:${quoted} OR subject:${quoted}) newer_than:365d`;
    const messages = await searchMessages(accessToken, query, maxResults);

    if (messages.length === 0) {
      return { emails: [], errors: [`No encontré emails de "${senderQuery}" en el último año.`] };
    }

    const emails: GmailEmailMeta[] = [];
    for (const m of messages) {
      try {
        const full = await getMessage(accessToken, m.id);
        const subject = full.payload.headers.find(h => h.name.toLowerCase() === "subject")?.value ?? "(sin asunto)";
        const from    = full.payload.headers.find(h => h.name.toLowerCase() === "from")?.value ?? "";
        const date    = full.payload.headers.find(h => h.name.toLowerCase() === "date")?.value ?? "";
        const hasAttachment = !!(full.payload.parts && findBestAttachment(full.payload.parts));
        const snippet = (full as unknown as { snippet?: string }).snippet ?? "";
        emails.push({ messageId: m.id, subject, from, date, hasAttachment, snippet: snippet.slice(0, 150) });
      } catch { /* skip */ }
    }

    return { emails, errors };
  } catch (err) {
    errors.push(`Error listando emails: ${err instanceof Error ? err.message : "desconocido"}`);
    return { emails: [], errors };
  }
}

/**
 * Process a specific email by messageId — runs full AI extraction on it.
 * Used after the user identifies which email is the bill.
 */
export async function processSpecificEmail(
  workspaceId: string,
  messageId: string
): Promise<{ result: GmailBillResult | null; error?: string }> {
  try {
    const accessToken = await getAccessToken(workspaceId);
    const full = await getMessage(accessToken, messageId);
    const result = await processGmailMessage(accessToken, full, workspaceId);
    return { result };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : "desconocido" };
  }
}
