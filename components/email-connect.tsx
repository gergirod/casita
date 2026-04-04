"use client";

import { useState } from "react";

type Provider = "gmail" | "outlook" | "yahoo" | "imap";

type Props = {
  workspaceId:     string;
  connectedEmail:  string | null;
  connectedAt:     string | null;   /* ISO string */
  onConnected:     () => void;
  onDisconnected:  () => void;
};

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  {
    id:    "gmail",
    label: "Gmail",
    hint:  "Necesitás una Contraseña de aplicación (no tu contraseña de Gmail). Activá 2FA primero en myaccount.google.com",
  },
  {
    id:    "outlook",
    label: "Outlook",
    hint:  "Generá una Contraseña de aplicación en account.live.com/proofs",
  },
  {
    id:    "yahoo",
    label: "Yahoo",
    hint:  "Generá una Contraseña de aplicación en login.yahoo.com/account/security",
  },
  {
    id:    "imap",
    label: "Otro",
    hint:  "Ingresá los datos IMAP de tu proveedor de email.",
  },
];

const APP_PASSWORD_LINKS: Record<Provider, string> = {
  gmail:   "https://myaccount.google.com/apppasswords",
  outlook: "https://account.live.com/proofs/AppPassword",
  yahoo:   "https://login.yahoo.com/account/security",
  imap:    "",
};

const PROVIDER_UI: Record<Provider, { title: string; mark: string; tint: string; border: string }> = {
  gmail: { title: "Gmail", mark: "G", tint: "#f8f2ef", border: "#f0d6c8" },
  outlook: { title: "Outlook", mark: "O", tint: "#eef4fb", border: "#c9dcef" },
  yahoo: { title: "Yahoo", mark: "Y", tint: "#f4f0fb", border: "#d9cdef" },
  imap: { title: "Otro IMAP", mark: "@", tint: "#f3f7f5", border: "#a7f3d0" },
};

export function EmailConnect({ workspaceId, connectedEmail, connectedAt, onConnected, onDisconnected }: Props) {
  const [open,        setOpen]        = useState(false);
  const [provider,    setProvider]    = useState<Provider>("gmail");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [imapHost,    setImapHost]    = useState("");
  const [imapPort,    setImapPort]    = useState("993");
  const [loading,     setLoading]     = useState(false);
  const [running,     setRunning]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [runInfo,     setRunInfo]     = useState<string | null>(null);
  const [confirmDisc, setConfirmDisc] = useState(false);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!;
  const providerActionLabel =
    provider === "gmail"
      ? "Conectar Gmail"
      : provider === "outlook"
        ? "Conectar Outlook"
        : provider === "yahoo"
          ? "Conectar Yahoo"
          : "Conectar IMAP";

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { emailProvider: provider, emailAddress: email, password };
      if (provider === "imap") {
        body.imapHost = imapHost;
        body.imapPort = parseInt(imapPort, 10);
      }

      const res = await fetch(`/api/workspaces/${workspaceId}/email-connect`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al conectar");
      }

      setOpen(false);
      setPassword("");
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar");
    } finally {
      setLoading(false);
    }
  }

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
      onConnected();
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
        background:   "var(--c-surface)",
        border:       "1.5px solid var(--c-border)",
        borderRadius: "1rem",
        padding:      "1rem 1.2rem",
        display:      "flex",
        flexDirection: "column",
        gap:          "0.6rem",
      }}>
        {/* Header */}
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

        {runInfo && (
          <p style={{ margin: 0, fontSize: "0.74rem", color: "#059669" }}>{runInfo}</p>
        )}

        {error && (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#dc2626" }}>{error}</p>
        )}

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
  if (!open) {
    return (
      <div style={{
        background:   "var(--c-surface)",
        border:       "1.5px dashed var(--c-border)",
        borderRadius: "1rem",
        padding:      "1.2rem",
        display:      "flex",
        flexDirection: "column",
        gap:          "0.75rem",
        alignItems:   "flex-start",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--c-text-body)" }}>
            Automatizar ingesta de facturas
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--c-text-muted)", lineHeight: 1.5 }}>
            Conectá tu email y Casita va a buscar las facturas de tus proveedores automáticamente, leerlas y notificar a tu inquilino.
          </span>
        </div>

        <div style={{
          display: "flex", gap: "0.5rem", flexWrap: "wrap",
          fontSize: "0.73rem", color: "var(--c-text-muted)",
        }}>
          <span>Solo lectura</span>
          <span>·</span>
          <span>Nunca escribe ni borra</span>
          <span>·</span>
          <span>Podés desconectar cuando quieras</span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setOpen(true)}
            className="btn-primary"
            style={{ fontSize: "0.82rem", fontWeight: 700 }}
          >
            Conectar email
          </button>
        </div>
      </div>
    );
  }

  /* ── Connect form ──────────────────────────────────────────── */
  return (
    <div style={{
      background:   "var(--c-surface)",
      border:       "1.5px solid var(--c-accent)",
      borderRadius: "1rem",
      padding:      "1.2rem",
      display:      "flex",
      flexDirection: "column",
      gap:          "1rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--c-text-body)" }}>
            Conectar email
          </p>
          <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--c-text-muted)" }}>
            Usá una Contraseña de aplicación, no tu contraseña normal.
          </p>
        </div>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: "1rem" }}
        >
          Cerrar
        </button>
      </div>

      {/* Provider selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.55rem 0.6rem",
              borderRadius: "0.7rem",
              border: provider === p.id ? "1.6px solid var(--c-accent)" : `1.2px solid ${PROVIDER_UI[p.id].border}`,
              background: provider === p.id ? "var(--c-accent-light)" : "#fff",
              color: provider === p.id ? "var(--c-accent)" : "#254837",
              fontWeight: provider === p.id ? 700 : 600,
              fontSize: "0.79rem",
              cursor:       "pointer",
              textAlign:    "left",
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: "1.35rem",
                height: "1.35rem",
                borderRadius: "0.45rem",
                display: "inline-grid",
                placeItems: "center",
                fontSize: "0.73rem",
                fontWeight: 800,
                background: PROVIDER_UI[p.id].tint,
                border: `1px solid ${PROVIDER_UI[p.id].border}`,
                color: provider === p.id ? "var(--c-accent)" : "#059669",
                flexShrink: 0,
              }}
            >
              {PROVIDER_UI[p.id].mark}
            </span>
            <span>{PROVIDER_UI[p.id].title}</span>
          </button>
        ))}
      </div>

      {/* Hint */}
      <div style={{
        padding: "0.6rem 0.8rem",
        background: "#f0fdf4",
        borderRadius: "0.6rem",
        fontSize: "0.73rem",
        color: "#059669",
        lineHeight: 1.5,
      }}>
        {selectedProvider.hint}
        {APP_PASSWORD_LINKS[provider] && (
          <>
            {" "}
            <a
              href={APP_PASSWORD_LINKS[provider]}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--c-accent)", fontWeight: 700, textDecoration: "none" }}
            >
              Obtener contraseña de aplicación →
            </a>
          </>
        )}
      </div>

      {/* Form fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <input
          type="email"
          placeholder="tucuenta@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "0.6rem 0.8rem", borderRadius: "0.6rem",
            border: "1.5px solid var(--c-border)", background: "var(--c-bg)",
            color: "var(--c-text-body)", fontSize: "0.85rem", outline: "none",
          }}
        />
        <input
          type="password"
          placeholder="Contraseña de aplicación (16 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "0.6rem 0.8rem", borderRadius: "0.6rem",
            border: "1.5px solid var(--c-border)", background: "var(--c-bg)",
            color: "var(--c-text-body)", fontSize: "0.85rem", outline: "none",
          }}
        />

        {provider === "imap" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="imap.tuproveedor.com"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              style={{
                padding: "0.6rem 0.8rem", borderRadius: "0.6rem",
                border: "1.5px solid var(--c-border)", background: "var(--c-bg)",
                color: "var(--c-text-body)", fontSize: "0.85rem", outline: "none",
              }}
            />
            <input
              type="number"
              placeholder="993"
              value={imapPort}
              onChange={(e) => setImapPort(e.target.value)}
              style={{
                padding: "0.6rem 0.8rem", borderRadius: "0.6rem",
                border: "1.5px solid var(--c-border)", background: "var(--c-bg)",
                color: "var(--c-text-body)", fontSize: "0.85rem", outline: "none",
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#dc2626" }}>{error}</p>
      )}

      <p style={{ margin: 0, fontSize: "0.73rem", color: "var(--c-text-muted)" }}>
        Modo seguro: solo lectura. No se modifica ni elimina nada en tu casilla.
      </p>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={handleConnect}
          disabled={loading || !email || !password}
          className="btn-primary"
          style={{
            flex: 1,
            fontWeight: 700,
            fontSize: "0.85rem",
            opacity: loading || !email || !password ? 0.65 : 1,
          }}
        >
          {loading ? "Verificando conexión..." : providerActionLabel}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="btn-secondary"
          style={{ fontSize: "0.85rem" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
