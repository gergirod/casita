import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Returns the contract text for a unit.
 * Strategy:
 *  1. Check DB cache → return if available
 *  2. Download PDF → send to gpt-4o as file → extract text
 *  3. Cache result in DB
 */
export async function getContractText(unitId: string): Promise<string | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      contractText: true,
      contractUrl: true,
      contractHistory: {
        orderBy: { uploadedAt: "desc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  if (!unit) return null;
  if (unit.contractText) return unit.contractText;

  const pdfUrl = unit.contractHistory[0]?.url ?? unit.contractUrl;
  if (!pdfUrl) return null;

  const text = await extractTextFromPdf(pdfUrl);
  if (!text) return null;

  await prisma.unit.update({
    where: { id: unitId },
    data: { contractText: text },
  });

  return text;
}

/**
 * Downloads the PDF and sends it to gpt-4.1 for text extraction.
 * gpt-4.1 is the most capable model for document/PDF understanding.
 * Cost doesn't matter here — extraction runs once and gets cached.
 */
async function extractTextFromPdf(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[contract-reader] Failed to download PDF: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Transcribí TODO el texto de este contrato de alquiler. " +
                "Preservá la numeración de cláusulas, artículos y secciones exactamente como aparecen. " +
                "No resumas, no interpretes, no omitas nada. Transcripción completa y fiel.",
            },
            {
              type: "file",
              file: {
                filename: "contrato.pdf",
                file_data: `data:application/pdf;base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_completion_tokens: 16384,
    });

    const text = completion.choices[0]?.message?.content?.trim();

    if (!text || text.length < 100) {
      console.warn(`[contract-reader] Extraction too short: ${text?.length ?? 0} chars`);
      return null;
    }

    if (text.toLowerCase().includes("no puedo") || text.toLowerCase().includes("lo siento")) {
      console.warn("[contract-reader] Model refused to extract, discarding");
      return null;
    }

    console.log(`[contract-reader] Extracted ${text.length} chars via gpt-4.1`);
    return text;
  } catch (err) {
    console.error("[contract-reader] Extraction error:", err);
    return null;
  }
}

/**
 * Answers a question about a contract by sending the PDF + question
 * directly to gpt-4.1 in a single call.
 */
export async function askContractDirect(
  pdfUrl: string,
  question: string
): Promise<string | null> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        {
          role: "system",
          content:
            "Sos un asistente legal argentino. Respondé la pregunta basándote EXCLUSIVAMENTE " +
            "en el contrato de alquiler adjunto. Si la respuesta no está en el contrato, decilo " +
            "claramente. No inventés información. Respondé en español argentino, conciso y claro.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: question },
            {
              type: "file",
              file: {
                filename: "contrato.pdf",
                file_data: `data:application/pdf;base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 1000,
    });

    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("[contract-reader] Direct Q&A error:", err);
    return null;
  }
}

/**
 * Invalidates the cached contract text (call when a new contract is uploaded).
 */
export async function invalidateContractCache(unitId: string) {
  await prisma.unit.update({
    where: { id: unitId },
    data: { contractText: null },
  });
}
