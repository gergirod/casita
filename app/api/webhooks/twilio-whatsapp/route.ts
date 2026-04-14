import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { handleWhatsAppMessage } from "@/lib/whatsapp-agent";
import { handleOwnerMessage } from "@/lib/owner-agent";
import { routeByPhone } from "@/lib/phone-router";
import { sendWhatsApp } from "@/lib/whatsapp";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * POST /api/webhooks/twilio-whatsapp
 *
 * Responds to Twilio immediately with empty TwiML, then processes
 * the message async and sends the reply via REST API.
 * This avoids Twilio's 15-second webhook timeout.
 */
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

  const rawText = await req.text();
  const params = new URLSearchParams(rawText);

  const twilioSignature = req.headers.get("x-twilio-signature") ?? "";
  const requestUrl = getRequestPublicUrl(req);

  // Only verify signature if TWILIO_VERIFY_SIGNATURE is explicitly enabled.
  // In sandbox/development mode this is often skipped due to URL reconstruction issues.
  const shouldVerify = process.env.TWILIO_VERIFY_SIGNATURE === "true";
  if (shouldVerify && authToken && twilioSignature) {
    const valid = verifyTwilioSignature({
      authToken,
      requestUrl,
      params,
      signature: twilioSignature,
    });
    if (!valid) {
      console.warn("[webhook] Invalid Twilio signature — url:", requestUrl);
      return NextResponse.json(
        { error: "Invalid Twilio signature" },
        { status: 403 }
      );
    }
  }

  const from = params.get("From") ?? "";
  const body = params.get("Body") ?? "";
  const waId = params.get("WaId") ?? "";
  const numMedia = parseInt(params.get("NumMedia") ?? "0", 10);
  const mediaUrl = numMedia > 0 ? params.get("MediaUrl0") : null;
  const mediaType = numMedia > 0 ? params.get("MediaContentType0") : null;

  const phone = waId || from.replace(/^whatsapp:/i, "");

  // waitUntil keeps the Vercel function alive until processing finishes,
  // while still returning the TwiML response to Twilio immediately.
  waitUntil(
    processMessageAsync(phone, from, body, mediaUrl, mediaType).catch((err) =>
      console.error("[webhook] Async processing error:", err)
    )
  );

  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

async function processMessageAsync(
  phone: string,
  from: string,
  body: string,
  mediaUrl: string | null,
  mediaType: string | null,
) {
  let reply: string;

  try {
    if (!process.env.OPENAI_API_KEY) {
      reply = buildFallbackReply(body);
    } else {
      const route = await routeByPhone(phone);

      if (route.type === "owner") {
        reply = await handleOwnerMessage({
          ownerId: route.ownerId,
          phone: route.phone,
          body,
          mediaUrl,
          mediaType,
        });
      } else {
        reply = await handleWhatsAppMessage({ phone, body, mediaUrl, mediaType });
      }
    }
  } catch (err) {
    console.error("[webhook] Error processing message:", err);
    reply = "Disculpá, no pude procesar tu mensaje. ¿Podés intentar de nuevo? 🙏";
  }

  try {
    const result = await sendWhatsApp({ to: phone, body: reply });
    if ("skipped" in result) {
      console.warn("[webhook] sendWhatsApp skipped:", result.reason);
    } else if ("error" in result) {
      const msg = result.message ?? "";

      // Twilio sandbox 50 msg/day limit — can't send anything, save for visibility
      if (msg.includes("exceeded") && msg.includes("daily messages limit")) {
        console.warn("[webhook] ⚠️  TWILIO SANDBOX DAILY LIMIT REACHED — reply not delivered to", phone);
        console.warn("[webhook] Undelivered reply:", reply.slice(0, 200));
        // Save the failed reply to chat history so it shows up in dashboard
        try {
          const { saveChatMessage } = await import("@/lib/services/chat-history");
          await saveChatMessage(phone, "assistant", `[NO ENVIADO — límite Twilio sandbox] ${reply}`);
        } catch { /* non-critical */ }
        return;
      }

      // Other Twilio errors — log and try a short fallback
      console.error("[webhook] sendWhatsApp error:", msg);
      try {
        await sendWhatsApp({ to: phone, body: "Ups, tuve un problema técnico enviando tu respuesta. Intentá de nuevo en un momento 🙏" });
      } catch { /* if fallback also fails, nothing we can do */ }
    } else {
      console.log("[webhook] Reply sent, sid:", result.sid);
    }
  } catch (err) {
    console.error("[webhook] Failed to send reply via REST:", err);
  }
}

// ─── Twilio signature verification ──────────────────────────────

function getRequestPublicUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
}

function verifyTwilioSignature(input: {
  authToken: string;
  requestUrl: string;
  params: URLSearchParams;
  signature: string;
}) {
  if (!input.signature) return false;

  const sorted = [...input.params.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const payload = sorted.reduce(
    (acc, [key, value]) => acc + key + value,
    input.requestUrl
  );

  const digest = createHmac("sha1", input.authToken)
    .update(payload)
    .digest("base64");
  const expected = Buffer.from(digest);
  const received = Buffer.from(input.signature);

  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

// ─── Fallback when OPENAI_API_KEY is not set ────────────────────

function buildFallbackReply(rawBody: string) {
  const text = rawBody.toLowerCase().trim();

  if (!text) {
    return "Te leo 👋 ¿Querés subir comprobante, enviar factura o hacer un reclamo?";
  }
  if (/\b(hola|buenas|hello|hi)\b/.test(text)) {
    return "Hola 👋 Soy Casita. ¿Querés subir comprobante, enviar factura o hacer un reclamo?";
  }
  if (/\b(reclamo|problema|queja)\b/.test(text)) {
    return "Perfecto. Contame tu reclamo en una frase y lo registro ahora.";
  }
  if (/\b(comprobante|pague|pago|transferencia)\b/.test(text)) {
    return "Genial. Mandame foto o PDF del comprobante y lo cargo.";
  }
  if (/\b(factura|boleta|expensa|expensas|servicio)\b/.test(text)) {
    return "Dale. Mandame la factura/boleta y la registro.";
  }

  return "Te leo 👋 ¿Querés subir comprobante, enviar factura o hacer un reclamo?";
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
