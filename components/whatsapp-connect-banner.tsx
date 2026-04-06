"use client";

import { useState } from "react";

type Props = {
  casitaWhatsAppNumber: string; // e.g. "+14155238886"
  sandboxJoinCode?: string;     // e.g. "join shine-perfect"
};

/**
 * Banner shown on the main dashboard when the owner hasn't connected their
 * WhatsApp yet. Saves the phone to OwnerProfile (account-level) and triggers
 * a welcome message so they can verify the bot immediately.
 */
export function WhatsAppConnectBanner({ casitaWhatsAppNumber, sandboxJoinCode }: Props) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanNumber = casitaWhatsAppNumber.replace(/\D/g, "");
  const waLink = sandboxJoinCode
    ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(sandboxJoinCode)}`
    : `https://wa.me/${cleanNumber}?text=${encodeURIComponent("Hola Casita")}`;

  async function connect() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #075e54 0%, #128c7e 100%)",
        borderRadius: "18px",
        padding: "1.25rem 1.5rem",
        marginBottom: "1.5rem",
        display: "grid",
        gap: "0.75rem",
        color: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.3rem" }}>✅</span>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>¡WhatsApp conectado!</span>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.9, lineHeight: 1.55 }}>
          Te mandamos un mensaje de bienvenida al <strong>{phone}</strong>.{" "}
          {sandboxJoinCode && (
            <>Si todavía no lo recibiste, abrí WhatsApp y enviá <strong>{sandboxJoinCode}</strong> al número de Casita.</>
          )}
        </p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "rgba(255,255,255,0.18)",
            color: "white",
            fontSize: "0.82rem",
            fontWeight: 600,
            padding: "0.55rem 1rem",
            borderRadius: "8px",
            textDecoration: "none",
            width: "fit-content",
            backdropFilter: "blur(4px)",
          }}
        >
          <WhatsAppIcon /> Abrir chat de Casita
        </a>
      </div>
    );
  }

  return (
    <div style={{
      background: "linear-gradient(135deg, #075e54 0%, #128c7e 100%)",
      borderRadius: "18px",
      padding: "1.25rem 1.5rem",
      marginBottom: "1.5rem",
      display: "grid",
      gap: "1rem",
      color: "white",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <WhatsAppIcon size={22} />
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.02em" }}>
            Manejá tus casitas por WhatsApp
          </p>
          <p style={{ margin: 0, fontSize: "0.77rem", opacity: 0.85, lineHeight: 1.45 }}>
            Consultá estados, creá cobros y enviá recordatorios sin abrir el dashboard.
          </p>
        </div>
      </div>

      {/* Phone input */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
          placeholder="+54 9 11 1234-5678"
          style={{
            flex: 1,
            padding: "0.65rem 0.85rem",
            borderRadius: "10px",
            border: "none",
            fontSize: "0.88rem",
            outline: "none",
            background: "rgba(255,255,255,0.15)",
            color: "white",
            caretColor: "white",
          }}
        />
        <button
          onClick={connect}
          disabled={busy || !phone.trim()}
          style={{
            padding: "0.65rem 1.1rem",
            borderRadius: "10px",
            border: "none",
            background: busy || !phone.trim() ? "rgba(255,255,255,0.25)" : "#25d366",
            color: "white",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: busy || !phone.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
        >
          {busy ? "Guardando..." : "Conectar"}
        </button>
      </div>

      {/* Sandbox hint */}
      {sandboxJoinCode && (
        <p style={{ margin: 0, fontSize: "0.73rem", opacity: 0.8, lineHeight: 1.5 }}>
          Antes de ingresar tu número, abrí WhatsApp y enviá{" "}
          <strong style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.15)", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
            {sandboxJoinCode}
          </strong>{" "}
          al{" "}
          <a href={`https://wa.me/${cleanNumber}`} target="_blank" rel="noopener noreferrer"
            style={{ color: "white", fontWeight: 600 }}>
            {casitaWhatsAppNumber}
          </a>{" "}
          para activar el sandbox de Twilio.
        </p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#fca5a5" }}>{error}</p>
      )}
    </div>
  );
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
