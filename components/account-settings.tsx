"use client";

import { useState } from "react";

type Props = {
  ownerId: string;
  whatsapp: {
    phone: string | null;
    enabled: boolean;
  };
  email: {
    provider: string | null;
    address: string | null;
    connectedAt: string | null;
  };
  googleOAuthEnabled: boolean;
  microsoftOAuthEnabled: boolean;
  mercadoPago?: { enabled: boolean; userId: string | null } | null;
};

export function AccountSettings({ ownerId, whatsapp, email, googleOAuthEnabled, microsoftOAuthEnabled, mercadoPago }: Props) {
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <WhatsAppSection initialPhone={whatsapp.phone} />
      <EmailSection
        ownerId={ownerId}
        initialProvider={email.provider}
        initialAddress={email.address}
        initialConnectedAt={email.connectedAt}
        googleOAuthEnabled={googleOAuthEnabled}
        microsoftOAuthEnabled={microsoftOAuthEnabled}
      />
      <MercadoPagoSection
        initialEnabled={mercadoPago?.enabled ?? false}
        initialUserId={mercadoPago?.userId ?? null}
      />
    </div>
  );
}

/* ── WhatsApp section ──────────────────────────────────────────── */

function WhatsAppSection({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saved, setSaved] = useState(!!initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    if (!phone.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/owner/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setSaved(true);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<WhatsAppIcon />}
        title="WhatsApp"
        badge={saved ? { label: "Conectado", color: "#059669" } : { label: "Sin conectar", color: "#6b7280" }}
      />

      <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#6b7280", lineHeight: 1.5 }}>
        Tu número de WhatsApp para controlar todas tus casitas desde el chat.
        Configuralo una sola vez — aplica a todas las propiedades.
      </p>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setSaved(false); setSuccess(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="+54 9 11 1234-5678"
          style={inputStyle}
        />
        <button
          onClick={save}
          disabled={busy || !phone.trim() || saved}
          style={btnStyle(busy || !phone.trim() || saved)}
        >
          {busy ? "Guardando…" : saved ? "Guardado" : "Guardar"}
        </button>
      </div>

      {success && (
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#059669" }}>
          ✅ Número guardado. Te enviamos un mensaje de bienvenida a WhatsApp.
        </p>
      )}
      {error && (
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#dc2626" }}>{error}</p>
      )}
    </Card>
  );
}

/* ── Email section ─────────────────────────────────────────────── */

function EmailSection({
  ownerId,
  initialProvider,
  initialAddress,
  initialConnectedAt,
  googleOAuthEnabled,
  microsoftOAuthEnabled,
}: {
  ownerId: string;
  initialProvider: string | null;
  initialAddress: string | null;
  initialConnectedAt: string | null;
  googleOAuthEnabled: boolean;
  microsoftOAuthEnabled: boolean;
}) {
  const [connected, setConnected] = useState(!!initialAddress);
  const [address, setAddress] = useState(initialAddress);
  const [provider, setProvider] = useState(initialProvider);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAny = googleOAuthEnabled || microsoftOAuthEnabled;

  const googleUrl = `/api/auth/google-email/start?ownerId=${ownerId}`;
  const microsoftUrl = `/api/auth/microsoft-email/start?ownerId=${ownerId}`;

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/email", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al desconectar");
      setConnected(false);
      setAddress(null);
      setProvider(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setDisconnecting(false);
    }
  }

  const providerLabel = provider === "gmail-oauth" ? "Gmail" : provider === "outlook-oauth" ? "Outlook" : provider ?? "Email";

  return (
    <Card>
      <CardHeader
        icon={<EmailIcon />}
        title="Email para facturas"
        badge={connected ? { label: "Conectado", color: "#059669" } : { label: "Sin conectar", color: "#6b7280" }}
      />

      <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#6b7280", lineHeight: 1.5 }}>
        Conectá tu email para que Casita busque facturas automáticamente (Edenor, Metrogas, AySA, etc.)
        y las asocie a tus cobros. Una sola cuenta para todas tus casitas.
      </p>

      {connected ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            background: "#f0fdf4", borderRadius: "10px", padding: "0.75rem 1rem",
          }}>
            <span style={{ fontSize: "1.1rem" }}>✅</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem", color: "#065f46" }}>
                {providerLabel} · {address}
              </p>
              {initialConnectedAt && (
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>
                  Conectado el {new Date(initialConnectedAt).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={disconnect}
            disabled={disconnecting}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: "8px",
              border: "1.5px solid #fca5a5",
              background: "transparent",
              color: "#dc2626",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: disconnecting ? "not-allowed" : "pointer",
              width: "fit-content",
            }}
          >
            {disconnecting ? "Desconectando…" : "Desconectar email"}
          </button>

          {error && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#dc2626" }}>{error}</p>
          )}
        </div>
      ) : hasAny ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {googleOAuthEnabled && (
            <a href={googleUrl} style={oauthBtnStyle("#4285f4")}>
              <GoogleIcon /> Conectar Gmail
            </a>
          )}
          {microsoftOAuthEnabled && (
            <a href={microsoftUrl} style={oauthBtnStyle("#0078d4")}>
              <MicrosoftIcon /> Conectar Outlook
            </a>
          )}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#9ca3af", fontStyle: "italic" }}>
          OAuth de email no está configurado en el servidor.
        </p>
      )}
    </Card>
  );
}

/* ── Mercado Pago section ──────────────────────────────────────── */

function MercadoPagoSection({
  initialEnabled,
  initialUserId,
}: {
  initialEnabled: boolean;
  initialUserId: string | null;
}) {
  const [connected, setConnected] = useState(initialEnabled);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = initialUserId;

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/mercado-pago/connect", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al desconectar");
      setConnected(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<MercadoPagoIcon />}
        title="Mercado Pago"
        badge={connected ? { label: "Conectado", color: "#059669" } : { label: "Sin conectar", color: "#6b7280" }}
      />

      <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#6b7280", lineHeight: 1.5 }}>
        Conectá tu cuenta de Mercado Pago para habilitar cobros y links de pago automáticos en todas tus casitas.
      </p>

      {connected ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            background: "#f0fdf4", borderRadius: "10px", padding: "0.75rem 1rem",
          }}>
            <span style={{ fontSize: "1.1rem" }}>✅</span>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem", color: "#065f46" }}>
              Cuenta conectada{userId ? ` · ID ${userId}` : ""}
            </p>
          </div>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            style={{
              padding: "0.55rem 1rem", borderRadius: "8px",
              border: "1.5px solid #fca5a5", background: "transparent",
              color: "#dc2626", fontWeight: 600, fontSize: "0.82rem",
              cursor: disconnecting ? "not-allowed" : "pointer", width: "fit-content",
            }}
          >
            {disconnecting ? "Desconectando…" : "Desconectar"}
          </button>
        </div>
      ) : (
        <a
          href="/api/auth/mercado-pago/start"
          style={oauthBtnStyle("#009EE3")}
        >
          <MercadoPagoIcon /> Conectar Mercado Pago
        </a>
      )}

      {error && <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#dc2626" }}>{error}</p>}
    </Card>
  );
}

/* ── Shared sub-components ─────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "16px",
      padding: "1.25rem 1.5rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
      display: "grid",
      gap: "0.25rem",
    }}>
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: { label: string; color: string };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
      {icon}
      <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1c1c1e" }}>{title}</span>
      {badge && (
        <span style={{
          marginLeft: "auto",
          fontSize: "0.72rem",
          fontWeight: 600,
          color: badge.color,
          background: badge.color === "#059669" ? "#f0fdf4" : "#f3f4f6",
          padding: "0.2rem 0.6rem",
          borderRadius: "999px",
        }}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.6rem 0.85rem",
  borderRadius: "10px",
  border: "1.5px solid #e5e7eb",
  fontSize: "0.88rem",
  outline: "none",
  color: "#1c1c1e",
  background: "#fafafa",
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.6rem 1.1rem",
    borderRadius: "10px",
    border: "none",
    background: disabled ? "#e5e7eb" : "#059669",
    color: disabled ? "#9ca3af" : "white",
    fontWeight: 700,
    fontSize: "0.85rem",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s",
  };
}

function oauthBtnStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.6rem 1.1rem",
    borderRadius: "10px",
    background: color,
    color: "white",
    fontWeight: 700,
    fontSize: "0.85rem",
    textDecoration: "none",
    cursor: "pointer",
    transition: "opacity 0.15s",
  };
}

/* ── Icons ─────────────────────────────────────────────────────── */

function WhatsAppIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="#25d366" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="white">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 21 21" fill="white">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

function MercadoPagoIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="24" cy="24" r="24" fill="#009EE3"/>
      <path d="M10 24c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="24" cy="30" r="4" fill="white"/>
    </svg>
  );
}
