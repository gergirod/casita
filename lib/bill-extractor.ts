import OpenAI from "openai";

export type BillExtraction = {
  totalAmount: number | null;
  dueDate: string | null;
  period: string | null;
  currency: "ARS" | "USD" | null;
  confidence: "high" | "medium" | "low";
  raw?: string;
};

const SYSTEM_PROMPT = `Sos un asistente especializado en leer facturas de servicios argentinos (luz, gas, agua, internet, expensas, alquiler).

Tu tarea es extraer del documento la siguiente información y devolverla ÚNICAMENTE como JSON válido sin markdown ni texto adicional:

{
  "totalAmount": <número float o null>,
  "dueDate": "<YYYY-MM-DD o null>",
  "period": "<string ej: Marzo 2025, o null>",
  "currency": "<ARS o USD o null>",
  "confidence": "<high|medium|low>"
}

Reglas:
- totalAmount: el importe TOTAL a pagar (no el subtotal, no impuestos parciales). Si hay varias fechas de vencimiento, tomá la primera.
- dueDate: la fecha de vencimiento en formato YYYY-MM-DD. Si hay dos vencimientos (1° y 2°), tomá el primero.
- period: el mes/bimestre/período al que corresponde la factura (ej: "Abril 2025", "Bimestre Mar-Abr 2025").
- currency: casi siempre ARS para servicios argentinos. USD solo si está explícitamente en dólares.
- confidence: "high" si encontraste claramente total + vencimiento, "medium" si encontraste uno de los dos, "low" si tenés dudas.
- Si no podés extraer un campo, usá null.
- NO incluyas texto fuera del JSON.`;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
  return new OpenAI({ apiKey });
}

/**
 * Extrae datos de una factura a partir de un Buffer (PDF, imagen o texto).
 * Usa gpt-4o-mini con vision para imágenes, y text para PDFs/texto plano.
 */
export async function extractBillData(
  buffer: Buffer,
  mimeType: string = "application/pdf"
): Promise<BillExtraction> {
  const openai = getClient();

  const isImage = mimeType.startsWith("image/");
  const isText = mimeType === "text/plain" || mimeType === "message/rfc822";

  let content: OpenAI.ChatCompletionContentPart[];

  if (isImage) {
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    content = [
      { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      { type: "text", text: "Extraé los datos de esta factura." },
    ];
  } else if (isText) {
    const text = buffer.toString("utf-8").slice(0, 12000);
    content = [
      { type: "text", text: `Extraé los datos de esta factura:\n\n${text}` },
    ];
  } else {
    // PDF: use pdfjs-dist to extract the text layer (works in Node.js without DOM).
    let extractedText = "";
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const uint8 = new Uint8Array(buffer);
      const doc = await pdfjsLib.getDocument({ data: uint8, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      extractedText = pages.join("\n").trim();
    } catch {
      // pdfjs failed — fall back to UTF-8 slice (works for some simple text-based PDFs)
      extractedText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\táéíóúñÁÉÍÓÚÑ$.,:%]/g, " ").trim();
    }

    if (extractedText.length > 50) {
      content = [
        { type: "text", text: `Extraé los datos de esta factura (texto del PDF):\n\n${extractedText.slice(0, 12000)}` },
      ];
    } else {
      // Scanned/image-only PDF — pass first page as base64 image
      const base64 = buffer.toString("base64");
      content = [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" },
        },
        { type: "text", text: "Extraé los datos de esta factura." },
      ];
    }
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    temperature: 0.1,
    max_completion_tokens: 300,
  });

  const raw = response.choices[0]?.message.content?.trim() ?? "";

  try {
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(clean) as BillExtraction;
    parsed.raw = raw;

    if (typeof parsed.totalAmount === "string") {
      parsed.totalAmount = parseFloat(
        (parsed.totalAmount as string).replace(/[.,]/g, (m) => (m === "," ? "." : ""))
      );
    }

    return parsed;
  } catch {
    return {
      totalAmount: null,
      dueDate: null,
      period: null,
      currency: null,
      confidence: "low",
      raw,
    };
  }
}

/** @deprecated Use isExtractionConfigured instead */
export function isGeminiConfigured(): boolean {
  return isExtractionConfigured();
}

export function isExtractionConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
