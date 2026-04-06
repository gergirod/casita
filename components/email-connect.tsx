"use client";

import { useState } from "react";

type Props = {
  workspaceId: string;
  connectedEmail: string | null;
  connectedAt: string | null;
  googleOAuthEnabled: boolean;
  microsoftOAuthEnabled: boolean;
  onDisconnected: () => void;
  /** kept for API compatibility with callers that pass it — ignored here */
  onConnected?: () => void;
};

export function EmailConnect({
  workspaceId,
  connectedEmail,
  connectedAt,
  googleOAuthEnabled,
  microsoftOAuthEnabled,
  onDisconnected,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<string | null>(null);
  const [confirmDisc, setConfirmDisc] = useState(false);

  const googleUrl = `/api/auth/google-email/start?workspaceId=${workspaceId}`;
  const microsoftUrl = `/api/auth/microsoft-email/start?workspaceId=${workspaceId}`;

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/email-connect`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo desconectar");
      setConfirmDisc(false);
      onDisconnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    setRunInfo(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/fetch-bills-now`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo ejecutar");
      setRunInfo(
        `Escaneo finalizado: ${data.processed ?? 0} factura(s) cargada(s)` +
        (typeof data.skipped === "number" ? ` · ${data.skipped} proveedor(es) sin cambios` : "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar");
    } finally {
      setRunning(false);
    }
  }

  /* ── Already connected ─────────────────────────────────────── */
  if (connectedEmail) {
    const date = connectedAt
      ? new Date(connectedAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
      : null;

    return (
      <div style={{
        background: "var(--c-surface)",
        border: "1.5px solid var(--c-border)",
        borderRadius: "1rem",
        padding: "1rem 1.2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#22c55e", flexShrink: 0, boxShadow: "0 0 0 2px #bbf7d0",
          }} />
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--c-text-body)" }}>
            Email conectado
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--c-text-body)", fontWeight: 600 }}>
            {connectedEmail}
          </span>
          {date && (
            <span style={{ fontSize: "0.73rem", color: "var(--c-text-muted)" }}>
              Conectado el {date}
            </span>
          )}
        </div>

        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--c-text-muted)", lineHeight: 1.5 }}>
          Casita va a buscar automáticamente las facturas de tus proveedores cada semana
          y va a notificar a tu inquilino cuando aparezca una nueva.
        </p>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "0.55rem",
              border: "1.5px solid var(--c-border)",
              background: "var(--c-bg)",
              color: "var(--c-text-body)",
              fontSize: "0.76rem",
              cursor: running ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {running ? "Buscando..." : "Buscar facturas ahora"}
          </button>
        </div>

        {runInfo && <p style={{ margin: 0, fontSize: "0.74rem", color: "#059669" }}>{runInfo}</p>}
        {error && <p style={{ margin: 0, fontSize: "0.75rem", color: "#dc2626" }}>{error}</p>}

        {confirmDisc ? (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--c-text-muted)" }}>¿Seguro?</span>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              style={{
                padding: "0.3rem 0.8rem", borderRadius: "0.5rem",
                border: "1.5px solid #dc2626", background: "transparent",
                color: "#dc2626", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600,
              }}
            >
              {loading ? "..." : "Sí, desconectar"}
            </button>
            <button
              onClick={() => setConfirmDisc(false)}
              style={{
                padding: "0.3rem 0.8rem", borderRadius: "0.5rem",
                border: "1.5px solid var(--c-border)", background: "transparent",
                color: "var(--c-text-muted)", fontSize: "0.75rem", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDisc(true)}
            style={{
              alignSelf: "flex-start",
              padding: "0.3rem 0.8rem", borderRadius: "0.5rem",
              border: "1.5px solid var(--c-border)", background: "transparent",
              color: "var(--c-text-muted)", fontSize: "0.75rem", cursor: "pointer",
            }}
          >
            Desconectar
          </button>
        )}
      </div>
    );
  }

  /* ── Not connected ─────────────────────────────────────────── */
  const neitherConfigured = !googleOAuthEnabled && !microsoftOAuthEnabled;

  return (
    <div style={{
      background: "var(--c-surface)",
      border: "1.5px dashed var(--c-border)",
      borderRadius: "1rem",
      padding: "1.2rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.85rem",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--c-text-body)" }}>
          Conectar email para buscar facturas
        </span>
        <span style={{ fontSize: "0.78rem", color: "var(--c-text-muted)", lineHeight: 1.5 }}>
          Casita va a buscar las facturas de tus proveedores automáticamente,
          leerlas y notificar a tu inquilino. Solo lectura — nunca escribe ni borra nada.
        </span>
      </div>

      {neitherConfigured ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#b45309", lineHeight: 1.5 }}>
          ⚠️ El administrador aún no configuró los permisos de email. Contactalo para activar esta función.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {googleOAuthEnabled && (
            <a
              href={googleUrl}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.6rem 0.9rem",
                borderRadius: "0.7rem",
                border: "1.5px solid #e2d4cc",
                background: "#fff",
                color: "#1c1c1e",
                fontWeight: 700,
                fontSize: "0.85rem",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <span style={{
                width: "1.4rem", height: "1.4rem", borderRadius: "0.4rem",
                background: "#f8f2ef", border: "1px solid #f0d6c8",
                display: "inline-grid", placeItems: "center",
                fontSize: "0.72rem", fontWeight: 800, color: "#c0392b", flexShrink: 0,
              }}>G</span>
              Conectar con Google
            </a>
          )}

          {microsoftOAuthEnabled && (
            <a
              href={microsoftUrl}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.6rem 0.9rem",
                borderRadius: "0.7rem",
                border: "1.5px solid #c9dcef",
                background: "#fff",
                color: "#1c1c1e",
                fontWeight: 700,
                fontSize: "0.85rem",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <span style={{
                width: "1.4rem", height: "1.4rem", borderRadius: "0.4rem",
                background: "#eef4fb", border: "1px solid #c9dcef",
                display: "inline-grid", placeItems: "center",
                fontSize: "0.72rem", fontWeight: 800, color: "#0078d4", flexShrink: 0,
              }}>O</span>
              Conectar con Outlook
            </a>
          )}
        </div>
      )}

      {error && <p style={{ margin: 0, fontSize: "0.75rem", color: "#dc2626" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--c-text-muted)" }}>
        <span>Solo lectura</span>
        <span>·</span>
        <span>Nunca escribe ni borra</span>
        <span>·</span>
        <span>Podés desconectar cuando quieras</span>
      </div>
    </div>
  );
}
