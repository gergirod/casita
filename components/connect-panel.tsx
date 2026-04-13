"use client";

import { useState } from "react";

type Props = {
  ownerId: string;
  whatsapp: { phone: string | null };
  email: { provider: string | null; address: string | null; connectedAt: string | null };
  googleOAuthEnabled: boolean;
  microsoftOAuthEnabled: boolean;
  mercadoPago?: { workspaceId: string; enabled: boolean; userId: string | null } | null;
};

/**
 * Compact connection panel shown on the main dashboard.
 * Shows WhatsApp + Email status as two cards.
 * Expands inline to connect — no extra page needed.
 * Mobile-first design with large touch targets.
 */
export function ConnectPanel({ ownerId, whatsapp, email, googleOAuthEnabled, microsoftOAuthEnabled }: Props) {
  const hasPhone = !!whatsapp.phone;
  const hasEmail = !!email.address;

  // At least one thing to configure? Show the panel
  if (hasPhone && hasEmail) return null; // both connected — no need to show this (can add settings link later)

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", fontWeight: 700, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Conectar integraciones
      </p>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {!hasPhone && <WhatsAppCard />}
        {!hasEmail && (
          <EmailCard
            ownerId={ownerId}
            googleOAuthEnabled={googleOAuthEnabled}
            microsoftOAuthEnabled={microsoftOAuthEnabled}
          />
        )}
      </div>
    </div>
  );
}

/* ── Full account settings (used on /dashboard/settings page) ─── */

export function AccountSettingsPanel({ ownerId, whatsapp, email, googleOAuthEnabled, microsoftOAuthEnabled, mercadoPago }: Props) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <WhatsAppCard initialPhone={whatsapp.phone} />
      <EmailCard
        ownerId={ownerId}
        initialProvider={email.provider}
        initialAddress={email.address}
        initialConnectedAt={email.connectedAt}
        googleOAuthEnabled={googleOAuthEnabled}
        microsoftOAuthEnabled={microsoftOAuthEnabled}
      />
      {mercadoPago && (
        <MercadoPagoCard
          workspaceId={mercadoPago.workspaceId}
          initialEnabled={mercadoPago.enabled}
          initialUserId={mercadoPago.userId}
        />
      )}
    </div>
  );
}

/* ── WhatsApp Card ──────────────────────────────────────────────── */

function WhatsAppCard({ initialPhone }: { initialPhone?: string | null }) {
  const [expanded, setExpanded] = useState(!initialPhone);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(!!initialPhone);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setDone(true);
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const connectedPhone = done ? phone : null;

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={headerBtnStyle}
      >
        <span style={iconCircle("#e8faf0")}>
          <WhatsAppIcon />
        </span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#1c1c1e" }}>WhatsApp</p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: connectedPhone ? "#059669" : "#6b7280", marginTop: "1px" }}>
            {connectedPhone ? connectedPhone : "Sin conectar · tocá para agregar"}
          </p>
        </div>
        <StatusDot connected={!!connectedPhone} />
        <ChevronIcon rotated={expanded} />
      </button>

      {/* Expanded form */}
      {expanded && (
        <div style={{ padding: "0 1rem 1rem", display: "grid", gap: "0.75rem", borderTop: "1px solid #f2f2f7", marginTop: "0" }}>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#6b7280", lineHeight: 1.55 }}>
            Ingresá tu número con código de país para controlar tus casitas desde WhatsApp.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setDone(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              placeholder="+54 9 11 1234-5678"
              style={inputStyle}
              autoFocus
            />
            <button
              onClick={save}
              disabled={busy || !phone.trim() || done}
              style={primaryBtnStyle(busy || !phone.trim() || done)}
            >
              {busy ? "…" : done ? "✓" : "Guardar"}
            </button>
          </div>
          {done && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#059669" }}>
              ✅ ¡Conectado! Te enviamos un mensaje de bienvenida.
            </p>
          )}
          {error && <p style={{ margin: 0, fontSize: "0.78rem", color: "#dc2626" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Email Card ─────────────────────────────────────────────────── */

function EmailCard({
  ownerId,
  initialProvider,
  initialAddress,
  initialConnectedAt,
  googleOAuthEnabled,
  microsoftOAuthEnabled,
}: {
  ownerId: string;
  initialProvider?: string | null;
  initialAddress?: string | null;
  initialConnectedAt?: string | null;
  googleOAuthEnabled: boolean;
  microsoftOAuthEnabled: boolean;
}) {
  const [expanded, setExpanded] = useState(!initialAddress);
  const [address, setAddress] = useState(initialAddress ?? null);
  const [provider, setProvider] = useState(initialProvider ?? null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAny = googleOAuthEnabled || microsoftOAuthEnabled;
  const googleUrl = `/api/auth/google-email/start?ownerId=${ownerId}`;
  const microsoftUrl = `/api/auth/microsoft-email/start?ownerId=${ownerId}`;
  const providerLabel = provider === "gmail-oauth" ? "Gmail" : provider === "outlook-oauth" ? "Outlook" : "Email";

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/email", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al desconectar");
      setAddress(null);
      setProvider(null);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={headerBtnStyle}
      >
        <span style={iconCircle("#f0f0f5")}>
          <EmailIcon />
        </span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#1c1c1e" }}>Email para facturas</p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: address ? "#059669" : "#6b7280", marginTop: "1px" }}>
            {address ? `${providerLabel} · ${address}` : "Sin conectar · tocá para conectar"}
          </p>
        </div>
        <StatusDot connected={!!address} />
        <ChevronIcon rotated={expanded} />
      </button>

      {/* Expanded form */}
      {expanded && (
        <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid #f2f2f7", display: "grid", gap: "0.75rem" }}>
          {address ? (
            <>
              <div style={{
                marginTop: "0.75rem",
                background: "#f0fdf4",
                borderRadius: "10px",
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}>
                <span style={{ fontSize: "1rem" }}>✅</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.82rem", color: "#065f46" }}>{address}</p>
                  {initialConnectedAt && (
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#6b7280" }}>
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
                  fontSize: "0.8rem",
                  cursor: disconnecting ? "not-allowed" : "pointer",
                  width: "fit-content",
                }}
              >
                {disconnecting ? "Desconectando…" : "Desconectar"}
              </button>
            </>
          ) : hasAny ? (
            <>
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#6b7280", lineHeight: 1.55 }}>
                Conectá tu email para que Casita busque facturas automáticamente (Edenor, Metrogas, AySA…). Una sola vez para todas tus casitas.
              </p>
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
            </>
          ) : (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#9ca3af", fontStyle: "italic" }}>
              OAuth de email no configurado. Contactá al soporte.
            </p>
          )}
          {error && <p style={{ margin: 0, fontSize: "0.78rem", color: "#dc2626" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Mercado Pago Card ──────────────────────────────────────────── */

function MercadoPagoCard({
  workspaceId,
  initialEnabled,
  initialUserId,
}: {
  workspaceId: string;
  initialEnabled: boolean;
  initialUserId: string | null;
}) {
  const [expanded, setExpanded] = useState(!initialEnabled);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initialEnabled);
  const [userId, setUserId] = useState(initialUserId);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  async function connect() {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/mercado-pago/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al conectar");
      setDone(true);
      setUserId(String(data.mpUserId));
      setExpanded(false);
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/mercado-pago/connect`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al desconectar");
      setDone(false);
      setUserId(null);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div style={cardStyle}>
      <button onClick={() => setExpanded(!expanded)} style={headerBtnStyle}>
        <span style={iconCircle("#fff7ed")}>
          <MercadoPagoIcon />
        </span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#1c1c1e" }}>Mercado Pago</p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: done ? "#059669" : "#6b7280", marginTop: "1px" }}>
            {done ? `Conectado${userId ? ` · ID ${userId}` : ""}` : "Sin conectar · tocá para agregar"}
          </p>
        </div>
        <StatusDot connected={done} />
        <ChevronIcon rotated={expanded} />
      </button>

      {expanded && (
        <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid #f2f2f7", display: "grid", gap: "0.75rem" }}>
          {done ? (
            <>
              <div style={{ marginTop: "0.75rem", background: "#f0fdf4", borderRadius: "10px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1rem" }}>✅</span>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "0.82rem", color: "#065f46" }}>
                  Cuenta conectada{userId ? ` (ID: ${userId})` : ""}
                </p>
              </div>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                style={{ padding: "0.55rem 1rem", borderRadius: "8px", border: "1.5px solid #fca5a5", background: "transparent", color: "#dc2626", fontWeight: 600, fontSize: "0.8rem", cursor: disconnecting ? "not-allowed" : "pointer", width: "fit-content" }}
              >
                {disconnecting ? "Desconectando…" : "Desconectar"}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#6b7280", lineHeight: 1.55 }}>
                Pegá tu <strong>Access Token</strong> de Mercado Pago para habilitar cobros y links de pago automáticos.
                Lo encontrás en <a href="https://www.mercadopago.com.ar/developers/panel" target="_blank" rel="noreferrer" style={{ color: "#059669" }}>developers.mercadopago.com</a> → tu app → Credenciales de prueba o producción.
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
                  placeholder="APP_USR-..."
                  style={inputStyle}
                  autoFocus
                />
                <button
                  onClick={connect}
                  disabled={busy || !token.trim()}
                  style={primaryBtnStyle(busy || !token.trim())}
                >
                  {busy ? "…" : "Conectar"}
                </button>
              </div>
            </>
          )}
          {error && <p style={{ margin: 0, fontSize: "0.78rem", color: "#dc2626" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
};

const headerBtnStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.9rem 1rem",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  minHeight: "64px",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.7rem 0.9rem",
  borderRadius: "10px",
  border: "1.5px solid #e5e7eb",
  fontSize: "0.9rem",
  outline: "none",
  color: "#1c1c1e",
  background: "#fafafa",
  minHeight: "44px",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.7rem 1.1rem",
    borderRadius: "10px",
    border: "none",
    background: disabled ? "#e5e7eb" : "#059669",
    color: disabled ? "#9ca3af" : "white",
    fontWeight: 700,
    fontSize: "0.88rem",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    minHeight: "44px",
    minWidth: "80px",
    transition: "background 0.15s",
  };
}

function oauthBtnStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.7rem 1.1rem",
    borderRadius: "10px",
    background: color,
    color: "white",
    fontWeight: 700,
    fontSize: "0.85rem",
    textDecoration: "none",
    minHeight: "44px",
  };
}

function iconCircle(bg: string): React.CSSProperties {
  return {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

/* ── Sub-components ─────────────────────────────────────────────── */

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span style={{
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: connected ? "#059669" : "#d1d5db",
      flexShrink: 0,
    }} />
  );
}

function ChevronIcon({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ flexShrink: 0, transition: "transform 0.2s", transform: rotated ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="M4 6l4 4 4-4" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Icons ──────────────────────────────────────────────────────── */

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

function MercadoPagoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#009EE3"/>
      <path d="M10 24c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="24" cy="30" r="4" fill="white"/>
    </svg>
  );
}
