"use client";

import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { CasitaLockup } from "./casita-logo";

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Esperá unos minutos antes de volver a intentar.";
  if (m.includes("invalid email") || m.includes("unable to validate"))
    return "El email ingresado no es válido.";
  if (m.includes("email not confirmed"))
    return "El email no está confirmado. Revisá tu casilla.";
  if (m.includes("user not found") || m.includes("no user found"))
    return "No encontramos ese email. Verificá que esté bien escrito.";
  if (m.includes("network") || m.includes("fetch"))
    return "Error de conexión. Verificá tu internet e intentá de nuevo.";
  return "Algo salió mal. Intentá de nuevo en unos minutos.";
}

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) setError(translateAuthError(authError.message));
    else setSent(true);
    setIsLoading(false);
  }

  if (sent) {
    return (
      <div style={{ width: "100%", maxWidth: "22rem", textAlign: "center", display: "grid", gap: "1.25rem" }}>
        <div
          style={{
            width: "3.75rem",
            height: "3.75rem",
            borderRadius: "1.1rem",
            background: "#ecfdf5",
            border: "1.5px solid #a7f3d0",
            display: "grid",
            placeItems: "center",
            margin: "0 auto",
            fontSize: "1.7rem",
          }}
        />
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            Revisá tu email
          </h2>
          <p style={{ color: "#374151", fontSize: "0.88rem", lineHeight: 1.65 }}>
            Enviamos un enlace mágico a{" "}
            <strong style={{ color: "#111827" }}>{email}</strong>.
            Hacé clic en el enlace para entrar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSent(false); setEmail(""); }}
          style={{ background: "none", border: "none", color: "#059669", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600 }}
        >
          Usar otro email
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSignIn}
      style={{ width: "100%", maxWidth: "22rem", display: "grid", gap: "1.5rem" }}
    >
      {/* Logo — visible solo en desktop (el mobile lo muestra la página) */}
      <CasitaLockup size={26} variant="form" />

      <div>
        <h2
          style={{
            fontSize: "1.55rem",
            fontWeight: 800,
            color: "#111827",
            letterSpacing: "-0.03em",
            marginBottom: "0.35rem",
          }}
        >
          Entrar a Casita
        </h2>
        <p style={{ fontSize: "0.88rem", color: "#374151", lineHeight: 1.6 }}>
          Entrá en segundos para ver qué está vencido, qué falta reclamar y qué
          comprobantes te quedan por verificar.
        </p>
      </div>

      <div style={{ display: "grid", gap: "0.45rem" }}>
        <label
          htmlFor="email"
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "#374151",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Email del propietario
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
          placeholder="vos@casita.app"
          required
          autoComplete="email"
        />
      </div>

      <button type="submit" disabled={isLoading} className="btn-primary w-full">
        {isLoading ? "Enviando..." : "Recibir enlace para entrar →"}
      </button>

      {error && (
        <p
          style={{
            fontSize: "0.84rem",
            color: "#dc2626",
            background: "#fef2f2",
            border: "1px solid #f5c0d0",
            borderRadius: "0.6rem",
            padding: "0.65rem 0.85rem",
          }}
        >
          {error}
        </p>
      )}

      <p
        style={{
          fontSize: "0.72rem",
          color: "#9ca3af",
          textAlign: "center",
          borderTop: "1px solid #deeee7",
          paddingTop: "1rem",
        }}
      >
        Enlace seguro · expira en 1 hora · sin contraseña
      </p>
    </form>
  );
}
