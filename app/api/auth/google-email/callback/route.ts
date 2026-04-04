import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, encryptRefreshToken } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * GET /api/auth/google-email/callback?code=xxx&state=workspaceId
 *
 * Google redirects here after the owner authorizes.
 * Stores the refresh token and shows a success page.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const workspaceId = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(buildPage("error", "Cancelaste la autorización. Podés intentar de nuevo desde WhatsApp."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code || !workspaceId) {
    return new NextResponse(buildPage("error", "Faltan parámetros. Intentá de nuevo."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerPhone: true, name: true },
  });

  if (!ws) {
    return new NextResponse(buildPage("error", "Workspace no encontrado."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const { refreshToken, email } = await exchangeCodeForTokens(code);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        emailProvider: "gmail-oauth",
        emailAddress: email,
        emailRefreshToken: encryptRefreshToken(refreshToken),
        emailEncryptedPassword: null,
        imapHost: null,
        imapPort: null,
        emailConnectedAt: new Date(),
      },
    });

    if (ws.ownerPhone) {
      try {
        await sendWhatsApp({
          to: ws.ownerPhone,
          body: `✅ *Gmail conectado*\n\nTu email *${email}* quedó vinculado a *${ws.name}*. Ahora puedo buscar facturas en tu correo.\n\nProbá: "Buscame la factura de Edenor"`,
        });
      } catch {
        // WhatsApp notification is best-effort
      }
    }

    return new NextResponse(buildPage("success", `Gmail ${email} conectado a ${ws.name}`), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("[google-oauth-callback] Error:", err);
    return new NextResponse(
      buildPage("error", `Error conectando Gmail: ${err instanceof Error ? err.message : "desconocido"}`),
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
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f2f2f7;
      padding: 1rem;
    }
    .card {
      background: #fff;
      border-radius: 20px;
      padding: 2.5rem 2rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .emoji { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; font-weight: 800; color: #1c1c1e; margin-bottom: 0.5rem; }
    p { font-size: 0.95rem; color: #6b7280; line-height: 1.6; margin-bottom: 1.5rem; }
    .status { color: ${color}; font-weight: 600; }
    .back {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #059669;
      color: #fff;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${title}</h1>
    <p class="status">${message}</p>
    <p>${isSuccess ? "Ya podés volver a WhatsApp y pedirme que busque facturas." : "Volvé a WhatsApp e intentá de nuevo."}</p>
    <a href="https://wa.me/${process.env.NEXT_PUBLIC_TWILIO_WHATSAPP_FROM?.replace("+", "")}" class="back">
      Volver a WhatsApp
    </a>
  </div>
</body>
</html>`;
}
