"use client";

import { useState } from "react";

type Props = {
  workspaceId: string;
  enabled: boolean;
  onSaved: () => void;
};

export function WhatsAppSettings({ workspaceId, enabled, onSaved }: Props) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: boolean) {
    setBusy(true);
    setMsg(null);
    setIsEnabled(next);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/whatsapp-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      setMsg(next ? "Recordatorios por WhatsApp activados." : "WhatsApp desactivado.");
      onSaved();
    } catch (err) {
      setIsEnabled(!next);
      setMsg(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280", lineHeight: 1.5, letterSpacing: "-0.01em" }}>
        {isEnabled
          ? "Tus inquilinos reciben recordatorios de vencimiento por WhatsApp."
          : "Activá recordatorios y avisos de vencimiento por WhatsApp para tus inquilinos."}
      </p>

      {/* Status + toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          display: "flex",
          background: "rgba(118,118,128,0.12)",
          borderRadius: "9px",
          padding: "2px",
          gap: "2px",
          opacity: busy ? 0.6 : 1,
          flex: 1,
        }}>
          {[
            { value: true, label: "Activado" },
            { value: false, label: "Desactivado" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              disabled={busy}
              onClick={() => save(opt.value)}
              style={{
                flex: 1,
                height: "34px",
                border: "none",
                borderRadius: "7px",
                fontSize: "0.82rem",
                fontWeight: isEnabled === opt.value ? 600 : 400,
                background: isEnabled === opt.value ? "#ffffff" : "transparent",
                color: isEnabled === opt.value ? "#1c1c1e" : "#636366",
                cursor: busy ? "not-allowed" : "pointer",
                transition: "background 0.15s, box-shadow 0.15s",
                boxShadow: isEnabled === opt.value
                  ? "0 1px 3px rgba(0,0,0,0.12), 0 0.5px 1px rgba(0,0,0,0.08)"
                  : "none",
                letterSpacing: "-0.01em",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <p style={{ margin: 0, fontSize: "0.73rem", color: msg.includes("Error") || msg.includes("pudo") ? "#dc2626" : "#059669", letterSpacing: "-0.01em" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
