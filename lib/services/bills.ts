import { randomUUID } from "crypto";
import { ObligationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toPrismaDecimal } from "@/lib/obligations";
import { extractBillData } from "@/lib/bill-extractor";
import { uploadFileToBucket, getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage";
import { logActivity, type ActivityChannel } from "@/lib/services/activity-log";
import type { ServiceResult } from "@/lib/services/obligations";

// ─── Helpers ─────────────────────────────────────────────────────
//
// Both helpers are exported so they can be unit-tested without any
// external service dependency.

/** Maps a MIME type string to a safe file extension for Supabase storage paths. */
export function mimeToExt(mime: string): "pdf" | "png" | "jpg" {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  return "jpg";
}

/** Returns the last day of the next calendar month (midnight local time).
 *  Used as the default dueDate for manually uploaded bills when no extraction
 *  date is available.
 *
 *  Derivation: new Date(y, m+2, 0) === day-0 of month m+2 === last day of month m+1.
 *  Example: called in April (m=3) → new Date(y, 5, 0) → April 30 ← WRONG
 *           called in April (m=3) → new Date(y, 5, 0) means month 5 (June), day 0 = May 31 ✓
 */
export function nextMonthLastDay(): Date {
  const now = new Date();
  // day=0 of (month+2) is the last day of (month+1), i.e. next calendar month
  return new Date(now.getFullYear(), now.getMonth() + 2, 0);
}

// ─── ingestBill ──────────────────────────────────────────────────
//
// Persists a bill file and creates its associated obligation record.
//
// Upload-first strategy to prevent orphaned obligations:
//   1. Validate ownership.
//   2. Upload file to Supabase — if this fails, the function throws
//      and no obligation is created.
//   3. Create obligation with originalBillUrl already set.
//   4. Run AI extraction (non-blocking try/catch — never aborts the flow).
//   5. Update obligation with extracted fields if extraction succeeded.
//   6. Write ActivityLog (non-blocking).
//
// The caller (agent) is responsible for channel-specific downloads
// (e.g. Twilio) before calling this function.

export interface IngestBillInput {
  ownerId: string;
  unitId: string;
  workspaceId: string;
  type: ObligationType;
  title: string;
  fileBuffer: Buffer;
  mimeType: string;
  channel: ActivityChannel;
}

export interface IngestBillResult {
  obligationId: string;
  billUrl: string;
  title: string;
  extractedAmount: number | null;
  extractedPeriod: string | null;
  extractionConfidence: "high" | "medium" | "low" | null;
}

export async function ingestBill(
  input: IngestBillInput
): Promise<ServiceResult<IngestBillResult>> {
  // 1. Validate ownership — same pattern and error codes as other services
  const unit = await prisma.unit.findFirst({
    where: {
      id: input.unitId,
      property: { workspace: { ownerId: input.ownerId } },
    },
    select: { id: true },
  });

  if (!unit) {
    return { ok: false, error: "Unidad no encontrada o sin permisos.", code: "forbidden" };
  }

  // 2. Upload file FIRST — a storage failure throws here and prevents
  //    the obligation from being created at all (no orphaned records).
  const ext = mimeToExt(input.mimeType);
  const filePath = `${input.unitId}/${randomUUID()}.${ext}`;

  await uploadFileToBucket({
    bucket: STORAGE_BUCKETS.originalBills,
    path: filePath,
    file: input.fileBuffer,
    contentType: input.mimeType,
  });

  const billUrl = getPublicUrl(STORAGE_BUCKETS.originalBills, filePath);

  // 3. Create obligation with billUrl already set — storage is confirmed at this point
  const dueDate = nextMonthLastDay();
  const ob = await prisma.obligation.create({
    data: {
      unitId: input.unitId,
      type: input.type,
      sourceType: "manual",
      title: input.title,
      amount: toPrismaDecimal(0),
      dueDate,
      currency: "ARS",
      status: "pending",
      originalBillUrl: billUrl,
    },
  });

  // 4–5. AI extraction — non-blocking; a failure never breaks the flow
  let extractedAmount: number | null = null;
  let extractedPeriod: string | null = null;
  let extractionConfidence: "high" | "medium" | "low" | null = null;

  try {
    const extraction = await extractBillData(input.fileBuffer, input.mimeType);
    extractedAmount = extraction.totalAmount;
    extractedPeriod = extraction.period;
    extractionConfidence = extraction.confidence;

    if (extraction.totalAmount != null) {
      await prisma.obligation.update({
        where: { id: ob.id },
        data: {
          extractionSource: "gemini",
          extractedAmount: extraction.totalAmount,
          amount: extraction.totalAmount,
          ...(extraction.dueDate && { extractedDueDate: new Date(extraction.dueDate) }),
          ...(extraction.period && { extractedPeriod: extraction.period }),
        },
      });
    }
  } catch { /* extraction failure is acceptable — obligation + billUrl already persisted */ }

  // 6. ActivityLog — non-blocking
  void logActivity({
    workspaceId: input.workspaceId,
    unitId: input.unitId,
    actorType: "owner",
    actorId: input.ownerId,
    action: "obligation.created",
    entityType: "obligation",
    entityId: ob.id,
    metadata: {
      title: input.title,
      type: input.type,
      billUrl,
      extractedAmount,
      extractionConfidence,
    },
    channel: input.channel,
  });

  return {
    ok: true,
    data: {
      obligationId: ob.id,
      billUrl,
      title: input.title,
      extractedAmount,
      extractedPeriod,
      extractionConfidence,
    },
  };
}
