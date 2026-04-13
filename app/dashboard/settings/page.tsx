import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CasitaLockup } from "@/components/casita-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { AccountSettingsPanel } from "@/components/connect-panel";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/microsoft-oauth";

export default async function SettingsPage() {
  const owner = await requireOwner();

  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { ownerId: owner.id },
    select: {
      phone: true,
      emailProvider: true,
      emailAddress: true,
      emailConnectedAt: true,
      mpAccessTokenEncrypted: true,
      mpUserId: true,
    },
  });

  return (
    <main style={{ minHeight: "100vh", background: "#f2f2f7" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 1.25rem",
          height: "56px",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          gap: "0.75rem",
        }}
      >
        <CasitaLockup size={22} variant="nav" />
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "0.85rem",
            color: "#059669",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M6 1L2 6l4 5" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Inicio
        </Link>
        <div style={{ flex: 1 }} />
        <SignOutButton />
      </header>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1.25rem", display: "grid", gap: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1c1c1e", letterSpacing: "-0.04em", margin: "0 0 0.25rem" }}>
            Ajustes de cuenta
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: 0 }}>
            Configurá tus integraciones una sola vez — aplican a todas tus casitas.
          </p>
        </div>

        <AccountSettingsPanel
          ownerId={owner.id}
          whatsapp={{ phone: ownerProfile?.phone ?? null }}
          email={{
            provider: ownerProfile?.emailProvider ?? null,
            address: ownerProfile?.emailAddress ?? null,
            connectedAt: ownerProfile?.emailConnectedAt?.toISOString() ?? null,
          }}
          googleOAuthEnabled={isGoogleOAuthConfigured()}
          microsoftOAuthEnabled={isMicrosoftOAuthConfigured()}
          mercadoPago={{
            enabled: !!ownerProfile?.mpAccessTokenEncrypted,
            userId: ownerProfile?.mpUserId ?? null,
          }}
        />
      </div>
    </main>
  );
}
