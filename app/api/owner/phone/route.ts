import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerFromRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

const schema = z.object({
  phone: z.string().min(7),
});

/**
 * POST /api/owner/phone
 *
 * Saves the owner's WhatsApp phone to their OwnerProfile (account-level).
 * If it's the first time connecting, sends a welcome message so they can
 * immediately verify the bot is working.
 */
export async function POST(req: NextRequest) {
  const auth = await getOwnerFromRequest();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Número inválido." }, { status: 400 });
  }

  const phone = parsed.data.phone.trim();

  const existing = await prisma.ownerProfile.findUnique({
    where: { ownerId: auth.user.id },
    select: { phone: true },
  });

  const isFirstTime = !existing?.phone;

  await prisma.ownerProfile.upsert({
    where: { ownerId: auth.user.id },
    create: { ownerId: auth.user.id, phone, whatsappEnabled: true },
    update: { phone, whatsappEnabled: true },
  });

  // Send a welcome message only on first connection.
  if (isFirstTime) {
    void sendWelcomeToOwner(phone).catch((err) => {
      console.error("[owner/phone] Failed to send welcome message:", err?.message ?? err);
    });
  }

  return NextResponse.json({ ok: true, isFirstTime });
}

async function sendWelcomeToOwner(phone: string) {
  const body = [
    "¡Hola! 👋 Bienvenido/a a *Casita*.",
    "Tu asistente de alquileres ya está activo.",
    "",
    "*Qué podés pedirme directamente:*",
    '• "resumen" — ver estado de pagos de todas tus casitas',
    '• "crear casita" — dar de alta una propiedad',
    '• "nuevo inquilino" — registrar un inquilino',
    '• "cobro mensual" — crear expensas, luz, gas, etc.',
    '• "cobro puntual" — un cargo de una sola vez',
    '• "recordatorio" — mandar aviso de pago al inquilino',
    '• "contrato" — consultarme sobre cláusulas del contrato',
    '• "reclamos" — ver reclamos abiertos',
    "• Mandá una foto o PDF y lo proceso como factura o contrato",
    "",
    "También podés escribirme en lenguaje natural — entiendo lo que necesitás 🤙",
  ].join("\n");

  await sendWhatsApp({ to: phone, body });
}
