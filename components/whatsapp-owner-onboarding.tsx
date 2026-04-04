"use client";

import { useState } from "react";

type Props = {
  workspaceId: string;
  ownerPhone: string | null;
  casitaWhatsAppNumber: string;
  onSaved: () => void;
};

export function WhatsAppOwnerOnboarding({ workspaceId, ownerPhone, casitaWhatsAppNumber, onSaved }: Props) {
  const [phone, setPhone] = useState(ownerPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(!!ownerPhone);

  async function savePhone() {
    if (!phone.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerPhone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error");
      setSaved(true);
      setMsg("Teléfono guardado. Ya podés usar Casita por WhatsApp.");
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const cleanNumber = casitaWhatsAppNumber.replace(/\D/g, "");
  const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent("Hola Casita")}`;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* Banner */}
      <div style={{
        background: "linear-gradient(135deg, #075e54 0%, #128c7e 100%)",
        borderRadius: "12px",
        padding: "1.25rem",
        color: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "1.5rem" }}>💬</span>
          <span style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Casita por WhatsApp
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.92, lineHeight: 1.5 }}>
          Gestioná tus alquileres desde WhatsApp. Consultá estados, creá cobros, enviá recordatorios y más — todo sin abrir el dashboard.
        </p>
      </div>

      {/* Phone input */}
      {!saved ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 500 }}>
            Tu número de WhatsApp
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 11 2472-0369"
              style={{
                flex: 1,
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
            <button
              onClick={savePhone}
              disabled={busy || !phone.trim()}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "none",
                background: "#075e54",
                color: "white",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy || !phone.trim() ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {busy ? "Guardando..." : "Conectar"}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>
            Este número se usa para identificarte como propietario cuando escribís a Casita.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {/* Connected state */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 0.75rem",
            background: "#f0fdf4",
            borderRadius: "8px",
            border: "1px solid #bbf7d0",
          }}>
            <span style={{ color: "#16a34a", fontSize: "0.9rem" }}>✓</span>
            <span style={{ fontSize: "0.8rem", color: "#166534", fontWeight: 500 }}>
              Conectado: {phone}
            </span>
            <button
              onClick={() => { setSaved(false); setMsg(null); }}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "#6b7280",
                fontSize: "0.72rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Cambiar
            </button>
          </div>

          {/* CTA button */}
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              background: "#25d366",
              color: "white",
              fontSize: "0.88rem",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(37,211,102,0.3)",
              transition: "transform 0.1s",
              letterSpacing: "-0.01em",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Abrir Casita en WhatsApp
          </a>

          {/* What you can do */}
          <div style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 0.3rem", fontWeight: 600, color: "#374151" }}>¿Qué podés hacer?</p>
            <div style={{ display: "grid", gap: "0.15rem" }}>
              {[
                "📋 Ver resumen de tus casitas",
                "💰 Crear cobros y verificar pagos",
                "📅 Programar recordatorios",
                "🏠 Crear casitas y dar de alta inquilinos",
                "📄 Subir facturas y buscar en tu email",
                "📩 Enviar bienvenidas y recordatorios",
              ].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {msg && (
        <p style={{
          margin: 0,
          fontSize: "0.73rem",
          color: msg.includes("Error") ? "#dc2626" : "#059669",
        }}>
          {msg}
        </p>
      )}
    </div>
  );
}
