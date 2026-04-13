import { NextRequest, NextResponse } from "next/server";
import { exchangeMsCodeForTokens, encryptMsRefreshToken } from "@/lib/microsoft-oauth";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * GET /api/auth/microsoft-email/callback?code=xxx&state=ownerId
 *
 * Microsoft redirects here after the owner authorizes.
 * Email config is stored at account level (OwnerProfile), not per workspace.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const ownerId = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(buildPage("error", "Cancelaste la autorización. Podés intentar de nuevo desde Ajustes."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code || !ownerId) {
    return new NextResponse(buildPage("error", "Faltan parámetros. Intentá de nuevo."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const { refreshToken, email } = await exchangeMsCodeForTokens(code);

    await prisma.ownerProfile.upsert({
      where: { ownerId },
      create: {
        ownerId,
        emailProvider: "outlook-oauth",
        emailAddress: email,
        emailRefreshToken: encryptMsRefreshToken(refreshToken),
        emailConnectedAt: new Date(),
      },
      update: {
        emailProvider: "outlook-oauth",
        emailAddress: email,
        emailRefreshToken: encryptMsRefreshToken(refreshToken),
        emailEncryptedPassword: null,
        imapHost: null,
        imapPort: null,
        emailConnectedAt: new Date(),
      },
    });

    const ownerProfile = await prisma.ownerProfile.findUnique({
      where: { ownerId },
      select: { phone: true },
    });
    if (ownerProfile?.phone) {
      try {
        await sendWhatsApp({
          to: ownerProfile.phone,
          body: `✅ *Outlook conectado*\n\nTu email *${email}* quedó vinculado a tu cuenta. Ahora puedo buscar facturas en tu correo.\n\nProbá: "Buscame la última factura de Edenor"`,
        });
      } catch {
        // Best-effort
      }
    }

    return new NextResponse(buildPage("success", `Outlook ${email} conectado`), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("[microsoft-oauth-callback] Error:", err);
    return new NextResponse(
      buildPage("error", `Error conectando Outlook: ${err instanceof Error ? err.message : "desconocido"}`),
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

function buildPage(type: "success" | "error", message: string): string {
  const isSuccess = type === "success";
  const emoji = isSuccess ? "✅" : "❌";
  const title = isSuccess ? "¡Conectado!" : "Error";
  const color = isSuccess ? "#059669" : "#dc2626";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Casita — ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #f2f2f7; padding: 1rem;
    }
    .card {
      background: #fff; border-radius: 20px; padding: 2.5rem 2rem;
      max-width: 400px; width: 100%; text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .emoji { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; font-weight: 800; color: #1c1c1e; margin-bottom: 0.5rem; }
    p { font-size: 0.95rem; color: #6b7280; line-height: 1.6; margin-bottom: 1.5rem; }
    .status { color: ${color}; font-weight: 600; }
    .back {
      display: inline-block; padding: 0.75rem 1.5rem; background: #059669;
      color: #fff; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${title}</h1>
    <p class="status">${message}</p>
    <p>${isSuccess ? "Ya podés volver a WhatsApp y pedirme que busque facturas." : "Volvé a Ajustes e intentá de nuevo."}</p>
    <a href="${process.env.OAUTH_REDIRECT_BASE ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/settings" class="back">
      Ir a Ajustes
    </a>
  </div>
</body>
</html>`;
}
